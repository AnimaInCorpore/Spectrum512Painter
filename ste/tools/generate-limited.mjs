import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPng, writePng } from './png.mjs';
import { quantizeImage, distance, steWord, convertLine } from './reference.mjs';
import { getSpectrum512ColorSlotIndex as slotAt } from '../../js/imaging/spectrum512-slots.js';
import { compileSprite } from './compile-sprite.mjs';
import { createBackgroundReuse, buildReusePatches, reuseIndex } from './background-reuse.mjs';
import { compileRestores } from './compile-restores.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

function choosePalette(ids, size) {
	const frequencies = new Map();
	for (const id of ids) frequencies.set(id, (frequencies.get(id) || 0) + 1);
	const colors = [...frequencies.keys()].sort((a, b) => frequencies.get(b) - frequencies.get(a));
	if (colors.length <= size) return colors;
	const selected = [colors[0]];
	while (selected.length < size) {
		let best = -1, bestScore = -1;
		for (const id of colors) {
			if (selected.includes(id)) continue;
			const score = Math.min(...selected.map(p => distance(id, p))) * Math.sqrt(frequencies.get(id));
			if (score > bestScore) { best = id; bestScore = score; }
		}
		selected.push(best);
	}
	return selected;
}

function nearestIndex(id, palette) {
	let index = 0, best = Infinity;
	for (let i = 0; i < palette.length; i++) {
		const cost = distance(id, palette[i]);
		if (cost < best) { best = cost; index = i; }
	}
	return index;
}

function encodePixel(screen, x, y, index) {
	if (index < 0 || index > 15) throw Error('Invalid planar palette index');
	for (let plane = 0; plane < 4; plane++) {
		const offset = y * 160 + (x >> 4) * 8 + plane * 2;
		const bit = 0x8000 >> (x & 15);
		screen.writeUInt16BE((screen.readUInt16BE(offset) & ~bit) | (index & (1 << plane) ? bit : 0), offset);
	}
}

const background = readPng('../img/sprite-demo/space-320x200.png');
const sprite = readPng('../img/sprite-demo/sprite-32x32.png');
const source = quantizeImage(background), spriteIds = quantizeImage(sprite, 144, 84);
const screen = Buffer.alloc(32000), palettes = Buffer.alloc(201 * 96);
const backgroundScreen = Buffer.alloc(32000), backgroundPalettes = Buffer.alloc(201 * 96);
const spriteIndices = Buffer.alloc(1024);
const spritePalettes = Buffer.alloc(32 * 12);
for (let sy = 0; sy < 32; sy++) {
	const opaque = Array.from(spriteIds.subarray(sy * 32, sy * 32 + 32)).filter((_, sx) => sprite.rgba[(sy * 32 + sx) * 4 + 3]);
	const palette = choosePalette(opaque, 6);
	while (palette.length < 6) palette.push(0);
	palette.forEach((id, i) => spritePalettes.writeUInt16BE(steWord(id), sy * 12 + i * 2));
	for (let sx = 0; sx < 32; sx++) spriteIndices[sy * 32 + sx] = 10 + nearestIndex(spriteIds[sy * 32 + sx], palette);
}
const preview = new Uint8Array(320 * 200 * 3);
let oldError = 0, newError = 0;

// Match the established slide.s stream: source row 1 starts at palette byte 0.
// The ten background registers can now differ across all three raster writes.
// Six sprite registers stay the same through the row. Row 0 is synchronization.
for (let y = 1; y < 200; y++) {
	const bgPalette = choosePalette(source.subarray(y * 320, (y + 1) * 320), 10);
	while (bgPalette.length < 10) bgPalette.push(0);
	const line = source.subarray(y * 320, (y + 1) * 320);
	const greedy = convertLine(line, { registerCount: 10 });
	const baseline = Array.from({ length: 48 }, (_, i) => i % 16 < 10 ? bgPalette[i % 16] : 0);
	const error = slots => Array.from(line).reduce((sum, id, x) => sum + Math.min(...Array.from({ length: 10 }, (_, i) => distance(id, slots[slotAt(x, i)]))), 0);
	const baselineError = error(baseline), greedyError = error(greedy.slots);
	const backgroundSlots = greedyError <= baselineError ? greedy.slots : baseline;
	oldError += baselineError;
	newError += Math.min(baselineError, greedyError);
	const sy = y - 84, opaque = [];
	if (sy >= 0 && sy < 32) {
		for (let sx = 0; sx < 32; sx++) {
			const i = sy * 32 + sx;
			if (sprite.rgba[i * 4 + 3]) opaque.push(spriteIds[i]);
		}
	}
	const spritePalette = choosePalette(opaque, 6);
	while (spritePalette.length < 6) spritePalette.push(0);
	const palette = backgroundSlots.map((id, i) => i % 16 >= 10 ? spritePalette[i % 16 - 10] : id);
	for (let x = 0; x < 320; x++) {
		let index = nearestIndex(source[y * 320 + x], Array.from({ length: 10 }, (_, i) => backgroundSlots[slotAt(x, i)]));
		encodePixel(backgroundScreen, x, y, index);
		if (sy >= 0 && sy < 32 && x >= 144 && x < 176) {
			const i = sy * 32 + x - 144;
			if (sprite.rgba[i * 4 + 3]) index = 10 + nearestIndex(spriteIds[i], spritePalette);
		}
		encodePixel(screen, x, y, index);
		const id = palette[slotAt(x, index)];
		preview.set([(id >> 8) * 17, ((id >> 4) & 15) * 17, (id & 15) * 17], (y * 320 + x) * 3);
	}
	palette.forEach((id, i) => palettes.writeUInt16BE(steWord(id), (y - 1) * 96 + i * 2));
	backgroundSlots.forEach((id, i) => backgroundPalettes.writeUInt16BE(i % 16 < 10 ? steWord(id) : 0, (y - 1) * 96 + i * 2));
}

// Independent sources preserve every palette-write cycle while sharing the
// background and selecting a vertical window in a zero-padded sprite stream.
const compactBackground = Buffer.alloc(201 * 60);
for (let row = 0; row < 201; row++) for (let bank = 0; bank < 3; bank++) {
	backgroundPalettes.copy(compactBackground, row * 60 + bank * 20, row * 96 + bank * 32, row * 96 + bank * 32 + 20);
}
const spriteStream = Buffer.alloc(432 * 36);
for (let row = 0; row < 32; row++) for (let bank = 0; bank < 3; bank++) {
	spritePalettes.copy(spriteStream, (200 + row) * 36 + bank * 12, row * 12, row * 12 + 12);
}
writeFileSync('assets/limited-background-stream.bin', compactBackground);
writeFileSync('assets/limited-sprite-stream.bin', spriteStream);
console.log(`Background fixed-point Oklab squared error: ${oldError} -> ${newError} (${(100 * (1 - newError / oldError)).toFixed(1)}% lower).`);

const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
writeFileSync('assets/limited-restore-code.s', compileRestores(mask));
const reuse = createBackgroundReuse(backgroundPalettes, spritePalettes, spriteIds, spriteIndices, mask);
const patches = buildReusePatches(reuse);
writeFileSync('assets/limited-reuse-index.bin', patches.offsets);
writeFileSync('assets/limited-reuse-patches.bin', patches.patches);
writeFileSync('assets/limited-reuse-code.bin', patches.code);
writePng('assets/limited-dedicated.png', 320, 200, preview);
for (const pixel of reuse.pixels) {
	const x = 144 + pixel.sx, y = 84 + pixel.sy, index = reuseIndex(pixel, 144, 84);
	encodePixel(screen, x, y, index);
	const id = index < 10 ? reuse.background[y * 48 + slotAt(x, index)] : reuse.dedicated[pixel.sy * 6 + index - 10];
	preview.set([(id >> 8) * 17, ((id >> 4) & 15) * 17, (id & 15) * 17], (y * 320 + x) * 3);
}

// Sixteen shifts, 32 rows, three groups per row: keep mask + four plane words.
// Transparent groups are skipped by the 68000 without touching screen memory.
const shifted = Buffer.alloc(16 * 32 * 30);
for (let shift = 0; shift < 16; shift++) for (let sy = 0; sy < 32; sy++) {
	for (let group = 0; group < 3; group++) {
		let mask = 0xffff;
		const planes = [0, 0, 0, 0];
		for (let bit = 0; bit < 16; bit++) {
			const sx = group * 16 + bit - shift;
			if (sx < 0 || sx >= 32 || !sprite.rgba[(sy * 32 + sx) * 4 + 3]) continue;
			const pixel = 0x8000 >> bit;
			mask &= ~pixel;
			const index = spriteIndices[sy * 32 + sx];
			for (let p = 0; p < 4; p++) if (index & (1 << p)) planes[p] |= pixel;
		}
		[mask, ...planes].forEach((word, i) => shifted.writeUInt16BE(word, shift * 960 + sy * 30 + group * 10 + i * 2));
	}
}
writeFileSync('assets/limited-background.bin', backgroundScreen);
writeFileSync('assets/limited-background-palettes.bin', backgroundPalettes);
writeFileSync('assets/limited-sprite-shifts.bin', shifted);
writeFileSync('assets/limited-sprite-code.s', compileSprite(shifted));
writeFileSync('assets/limited-sprite-palettes.bin', spritePalettes);
writeFileSync('assets/limited-sprite-indices.bin', spriteIndices);

writeFileSync('assets/limited-screen.bin', screen);
writeFileSync('assets/limited-palettes.bin', palettes);
writePng('assets/limited.png', 320, 200, preview);
console.log('Generated 10 background / 6 sprite register preview.');
