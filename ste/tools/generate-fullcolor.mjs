import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPng } from './png.mjs';
import { convertLine, steWord } from './reference.mjs';
import { sourceColors, sharedFullPalette, nearestSlot } from './fullcolor-palettes.mjs';
import { rowDrawers } from './fullcolor-drawers.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
for (let y = 0; y < 32; y++) if (Boolean(mask.readUInt32BE(y * 4)) !== (y >= 1 && y <= 29)) throw Error('Update the runtime opaque-row extent for the new mask');
const drawers = rowDrawers(mask);
writeFileSync('assets/fullcolor-shift-masks.bin', drawers.masks);
writeFileSync('assets/fullcolor-drawers.s', drawers.code);
const sources = sourceColors(readPng('../img/sprite-demo/space-320x200.png'), readPng('../img/sprite-demo/sprite-32x32.png'), mask);
const families = Array.from({ length: 256 }, (_, active) => active).filter(active => active.toString(2).replaceAll('0', '').length <= 3 || active === 255);
const palettes = families.map(active => sharedFullPalette(sources, active));
writeFileSync('assets/fullcolor-families.bin', Buffer.from(Array.from({ length: 256 }, (_, active) => families.includes(active) ? families.indexOf(active) : families.length - 1)));
writeFileSync('assets/fullcolor-family-masks.bin', Buffer.from(families));
const words = values => { const b = Buffer.alloc(values.length * 2); values.forEach((v, i) => b.writeUInt16BE(v, i * 2)); return b; };
writeFileSync('assets/fullcolor-palettes.bin', words(palettes.flat().map(steWord)));
writeFileSync('assets/fullcolor-source.bin', words(Array.from(sources.backgroundIds)));
writeFileSync('assets/fullcolor-sources.bin', words(sources.sprites.flatMap(ids => Array.from(ids))));
const baseline = Buffer.alloc(32000), baselinePalettes = Buffer.alloc(202 * 96);
for (let y = 1; y < 200; y++) {
	const line = convertLine(sources.backgroundIds.subarray(y * 320, y * 320 + 320));
	line.planar.copy(baseline, y * 160);
	words(line.slots.map(steWord)).copy(baselinePalettes, (y - 1) * 96);
}
writeFileSync('assets/fullcolor-background.bin', baseline);
writeFileSync('assets/fullcolor-background-palettes.bin', baselinePalettes);

// Cache whole background images for each palette family. The STE copies only
// required rows. Sprite rows are deduplicated and shifted at draw time.
const backgrounds = Buffer.alloc(families.length * 32000);
const rowRecords = [], rowIds = new Map(), spriteIndex = Buffer.alloc(families.length * 8 * 32 * 4);
function intern(buffer, list, ids) {
	const key = buffer.toString('hex');
	if (!ids.has(key)) { ids.set(key, list.length); list.push(buffer); }
	return ids.get(key);
}
const opaqueRow = y => mask.readUInt32BE(y * 4);
for (let family = 0; family < families.length; family++) {
	const active = families[family], palette = palettes[family];
	const map = Uint8Array.from({ length: 4096 }, (_, id) => nearestSlot(id, palette));
	for (let y = 0; y < 200; y++) for (let group = 0; group < 20; group++) {
		const block = Buffer.alloc(8);
		if (!active || !y) baseline.copy(block, 0, y * 160 + group * 8, y * 160 + group * 8 + 8);
		else for (let bit = 0; bit < 16; bit++) {
			const index = map[sources.backgroundIds[y * 320 + group * 16 + bit]];
			for (let p = 0; p < 4; p++) if (index & (1 << p)) block.writeUInt16BE(block.readUInt16BE(p * 2) | (32768 >> bit), p * 2);
		}
		block.copy(backgrounds, family * 32000 + y * 160 + group * 8);
	}
	for (let ball = 0; ball < 8; ball++) if (active & (1 << ball)) for (let row = 0; row < 32; row++) {
		const record = Buffer.alloc(16);
		for (let x = 0; x < 32; x++) if (opaqueRow(row) & (0x80000000 >>> x)) {
			const index = map[sources.sprites[ball][row * 32 + x]];
			for (let p = 0; p < 4; p++) if (index & (1 << p)) record.writeUInt32BE((record.readUInt32BE(p * 4) | (0x80000000 >>> x)) >>> 0, p * 4);
		}
		const id = intern(record, rowRecords, rowIds);
		spriteIndex.writeUInt32BE(id * 16, ((family * 8 + ball) * 32 + row) * 4);
	}
}
writeFileSync('assets/fullcolor-backgrounds.bin', backgrounds);
writeFileSync('assets/fullcolor-sprite-index.bin', spriteIndex);
writeFileSync('assets/fullcolor-sprite-rows.bin', Buffer.concat(rowRecords));
console.log(`Full-color tables: ${families.length} palette families, ${backgrounds.length} background bytes, ${rowRecords.length} sprite rows (${rowRecords.length * 16} bytes).`);
console.log(`Total prepared row data: ${backgrounds.length + spriteIndex.length + rowRecords.length * 16} bytes. No dithering.`);
