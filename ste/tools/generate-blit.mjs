// Assets of the Blitter ball demo (blit.s): SPACE.TGA converted to Spectrum 512 twice with the converter of
// jscolorquantizer (UpdateSpectrum512RectangleST2, STE, checker 4) and the line palettes refined by the brute force
// optimizer of the painter, once with all 16 registers and once with only registers 0-9, a 32x32 ball with 6 colors
// in registers 10-15, and its Blitter routines (stefastbobs2 compiler).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { readPng, writePng } from './png.mjs';
import { getSpectrum512ColorSlotIndex as slotAt } from '../../js/imaging/spectrum512-slots.js';
import { optimizeSpectrum512LineSlotsBruteForceBatch } from '../../js/imaging/spectrum512-bruteforce.js';
import { rgbToOklab } from '../../js/vendor/jscolorquantizer/quantizers/core.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
mkdirSync('assets', { recursive: true });
const quantizer = '../jscolorquantizer/modules/quantizers/spectrum512.js';
const compiler = process.env.BLITTER_COMPILER || '../../stefastbobs2/tools/blitter_sprite_compiler.js';
const W = 320, H = 200, BALL_REGISTER = 10;
const model = await import('../' + quantizer);
const steWord = id => ((id & 0xeee) >> 1) | ((id & 0x111) << 3);

// The converter limited to the first `registers` color indices (Spectrum layout, 3 entries per register and line).
function converter(registers) {
	const source = readFileSync(quantizer, 'utf8').replace(/\r\n/g, '\n');
	let code = source.slice(source.indexOf('export function UpdateSpectrum512RectangleST2')).replace('export function', 'function');
	const edits = [
		['ColorIndex = 15; ColorIndex >= 0', 'ColorIndex = K - 1; ColorIndex >= 0', 2],
		['if(ColorIndex >= 0)', 'if(ColorIndex >= 0 && ColorIndex < K)', 2],
		['ColorIndex < 16; ColorIndex++', 'ColorIndex < K; ColorIndex++', 3],
		['var Order = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 ];', 'var Order = Array.from({ length: K }, (_, i) => i);', 1],
		['Position1 < 15;', 'Position1 < K - 1;', 1],
		['Position2 < 16;', 'Position2 < K;', 1]];
	for (const [from, to, count] of edits) {
		if (code.split(from).length - 1 !== count) throw Error(`converter source changed: ${from}`);
		code = code.replaceAll(from, to);
	}
	return new Function('K', code + '\nreturn UpdateSpectrum512RectangleST2;')(registers);
}

// SPACE.TGA (24 bit, first line at the top) -> grid colors with the STE checker dither (4).
const tga = readFileSync('../jscolorquantizer/atari/SPACE.TGA');
if (tga[2] !== 2 || tga[16] !== 24 || tga.readUInt16LE(12) !== W || tga.readUInt16LE(14) !== H || !(tga[17] & 32)) throw Error('SPACE.TGA format');
const pixels = tga.subarray(18 + tga[0]);
const level = v => Math.round(Math.min(255, Math.max(0, v)) * 15 / 255);

const rgbOf = id => [(id >> 8) * 17, ((id >> 4) & 15) * 17, (id & 15) * 17];
const oklabs = new Map();
const oklabOf = id => { if (!oklabs.has(id)) oklabs.set(id, rgbToOklab(rgbOf(id))); return oklabs.get(id); };

// One line: the converter's palette refined by the brute force optimizer (the border slots 0 and 32 stay black),
// then every pixel gets its nearest visible entry (the first color index on a tie).
function refineLine(grid, slotColors, registers) {
	const lineData = new Uint8ClampedArray(W * 4);
	for (let x = 0; x < W; x++) { lineData.set(rgbOf(grid[x]), x * 4); lineData[x * 4 + 3] = 255; }
	const initialSlots = Array.from(slotColors, id => { const [red, green, blue] = rgbOf(id); return { red, green, blue }; });
	const [slots] = optimizeSpectrum512LineSlotsBruteForceBatch({ lines: [{ lineData, initialSlots }], width: W, colorCount: registers, lockedSlots: [0, 32] });
	const colors = slots.map(c => (level(c.red) << 8) | (level(c.green) << 4) | level(c.blue));
	const indices = new Uint8Array(W);
	for (let x = 0; x < W; x++) {
		const target = oklabOf(grid[x]);
		let best = Infinity;
		for (let index = 0; index < registers; index++) {
			const c = oklabOf(colors[slotAt(x, index)]);
			const d = (target[0] - c[0]) ** 2 + (target[1] - c[1]) ** 2 + (target[2] - c[2]) ** 2;
			if (d < best) { best = d; indices[x] = index; }
		}
	}
	return { colors, indices };
}

function convert(registers) {
	const state = model.CreateSpectrum512StateST2(W, H, 4);
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		const o = (x + y * W) * 3, d = ((x ^ y) & 1) ? 4 : -4;
		state.GridColors[x + y * W] = (level(pixels[o + 2] + d) << 8) | (level(pixels[o + 1] + d) << 4) | level(pixels[o] + d);
	}
	converter(registers)(state, 0, 1, W, H);
	const screen = Buffer.alloc(32000), palettes = Buffer.alloc(199 * 96);
	let error = 0;
	for (let y = 1; y < H; y++) {
		const grid = state.GridColors.subarray(y * W, y * W + W);
		const line = refineLine(grid, state.SlotColors.subarray(y * 48, y * 48 + 48), registers);
		for (let x = 0; x < W; x++) {
			const index = line.indices[x], shown = line.colors[slotAt(x, index)];
			error += Math.sqrt((state.LabL[grid[x]] - state.LabL[shown]) ** 2 + (state.LabA[grid[x]] - state.LabA[shown]) ** 2 + (state.LabB[grid[x]] - state.LabB[shown]) ** 2);
			for (let p = 0; p < 4; p++) if (index & (1 << p)) {
				const o = y * 160 + (x >> 4) * 8 + p * 2;
				screen.writeUInt16BE(screen.readUInt16BE(o) | (0x8000 >> (x & 15)), o);
			}
		}
		for (let slot = 0; slot < 48; slot++) palettes.writeUInt16BE(steWord(line.colors[slot]), ((y - 1) * 48 + slot) * 2);
	}
	return { screen, palettes, error: error / (W * (H - 1)) };
}

// The ball: 6 STE colors in registers 10-15, sorted by lightness, with a checker dither. A pixel takes the mix (the
// average in linear light) of two neighbouring shades where that mix is nearer to its color than any single shade:
// the darker shade on even sprite pixels ((x + y) even), the lighter on odd ones. The pattern belongs to the sprite
// and moves with it. The shades start from k-means in OKLab and are then chosen for the dithered result: one shade at
// a time is replaced by the color of the ball's pixels that lowers the total error most, until nothing improves.
const sprite = readPng('../img/sprite-demo/sprite-32x32.png');
const id = (r, g, b) => (level(r) << 8) | (level(g) << 4) | level(b);
const opaque = [];
for (let i = 0; i < 1024; i++) if (sprite.rgba[i * 4 + 3] === 255) opaque.push(i);
const linear = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const gamma = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const labDistance = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const targets = new Map(opaque.map(i => [i, rgbToOklab([sprite.rgba[i * 4], sprite.rgba[i * 4 + 1], sprite.rgba[i * 4 + 2]])]));
const byLightness = colors => [...colors].sort((a, b) => oklabOf(a)[0] - oklabOf(b)[0] || a - b);
const mixOf = (a, b) => rgbToOklab(rgbOf(a).map((v, channel) => gamma((linear(v) + linear(rgbOf(b)[channel])) / 2)));

// Register (10-15) of sprite pixel i for the sorted shades, and its error.
function ballShade(colors, i, checker) {
	const target = targets.get(i);
	let best = Infinity, index = 0;
	colors.forEach((c, k) => { const d = labDistance(target, oklabOf(c)); if (d < best) { best = d; index = k; } });
	if (checker) for (let k = 0; k + 1 < colors.length; k++) {
		const d = labDistance(target, mixOf(colors[k], colors[k + 1]));
		if (d < best) { best = d; index = ((i & 31) + (i >> 5)) & 1 ? k + 1 : k; }
	}
	return { register: BALL_REGISTER + index, error: best };
}
const ballError = (colors, checker) => opaque.reduce((sum, i) => sum + ballShade(colors, i, checker).error, 0);

const pixelIds = opaque.map(i => id(sprite.rgba[i * 4], sprite.rgba[i * 4 + 1], sprite.rgba[i * 4 + 2]));
let kmeans = byLightness(pixelIds).filter((_, n, all) => n === Math.floor((Math.floor(n * 6 / all.length) + 0.5) * all.length / 6));
const nearestCenter = c => kmeans.reduce((best, center, k) => labDistance(oklabOf(c), oklabOf(center)) < labDistance(oklabOf(c), oklabOf(kmeans[best])) ? k : best, 0);
for (let round = 0; round < 20; round++) {
	const sums = kmeans.map(() => [0, 0, 0, 0]);
	for (const c of pixelIds) { const s = sums[nearestCenter(c)]; s[0] += c >> 8; s[1] += (c >> 4) & 15; s[2] += c & 15; s[3]++; }
	kmeans = kmeans.map((c, k) => sums[k][3] ? (Math.round(sums[k][0] / sums[k][3]) << 8) | (Math.round(sums[k][1] / sums[k][3]) << 4) | Math.round(sums[k][2] / sums[k][3]) : c);
}
kmeans = byLightness(new Set(kmeans));
if (kmeans.length !== 6) throw Error('The ball needs 6 different colors');
const candidates = [...new Set(pixelIds)];
let centers = kmeans, centersError = ballError(centers, true);
for (let improved = true; improved;) {
	improved = false;
	for (let k = 0; k < 6; k++) for (const c of candidates) {
		if (centers.includes(c)) continue;
		const trial = byLightness(centers.map((old, n) => n === k ? c : old)), error = ballError(trial, true);
		if (error < centersError - 1e-9) { centers = trial; centersError = error; improved = true; }
	}
}
const ballIndex = new Map(opaque.map(i => [i, ballShade(centers, i, true).register]));

// Background palettes with the ball colors in all three entries of registers 10-15.
function withBall(palettes) {
	const result = Buffer.from(palettes);
	for (let line = 0; line < 199; line++) for (let k = 0; k < 6; k++) for (const third of [0, 16, 32])
		result.writeUInt16BE(steWord(centers[k]), (line * 48 + third + BALL_REGISTER + k) * 2);
	return result;
}

const full = convert(16), limited = convert(10);

// The files of the demo, and the ball routines from the compiler: registers 10-15 hold the ball colors in the
// Degas palette, the others colors the ball does not use, so every ball pixel maps to its own register.
function writeAssets() {
	writeFileSync('assets/blit-full-screen.bin', full.screen);
	writeFileSync('assets/blit-full-palettes.bin', full.palettes);
	writeFileSync('assets/blit-limited-screen.bin', limited.screen);
	writeFileSync('assets/blit-limited-palettes.bin', withBall(limited.palettes));
	writeFileSync('assets/blit-ball.json', JSON.stringify({ colors: centers, indices: Object.fromEntries(ballIndex) }));

	function writeRgbaPng(path, width, height, rgba) {
		const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
		const crc = data => { let c = 0xffffffff; for (const b of data) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
		const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(body.length + 8);
			out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4); return out; };
		const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
		const raw = Buffer.alloc((width * 4 + 1) * height);
		for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
		writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
	}
	const ballRgba = new Uint8Array(1024 * 4);
	for (const [i, index] of ballIndex) {
		const c = centers[index - BALL_REGISTER];
		ballRgba.set([(c >> 8) * 17, ((c >> 4) & 15) * 17, (c & 15) * 17, 255], i * 4);
	}
	writeRgbaPng('assets/blit-ball.png', 32, 32, ballRgba);
	const views = [null, [kmeans, false], [kmeans, true], [centers, true]], preview = new Uint8Array(views.length * 256 * 256 * 3);
	for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
		const i = (y >> 3) * 32 + (x >> 3);
		if (sprite.rgba[i * 4 + 3] !== 255) continue;
		views.forEach((view, v) => preview.set(view ? rgbOf(view[0][ballShade(view[0], i, view[1]).register - BALL_REGISTER]) : [...sprite.rgba.subarray(i * 4, i * 4 + 3)],
			(y * 256 * views.length + v * 256 + x) * 3));
	}
	writePng('assets/blit-ball-preview.png', 256 * views.length, 256, preview);
	const degas = Buffer.alloc(34);
	const fillers = [0xf00, 0x0f0, 0x00f, 0xff0, 0xf0f, 0x0ff, 0x800, 0x080, 0x008, 0x880].filter(c => !centers.includes(c));
	for (let r = 0; r < 16; r++) degas.writeUInt16BE(steWord(r >= BALL_REGISTER ? centers[r - BALL_REGISTER] : fillers[r]), 2 + r * 2);
	writeFileSync('assets/blit-ball.pi1', degas);
	execFileSync(process.execPath, [compiler, 'assets/blit-ball.png', '--palette=assets/blit-ball.pi1', '--prefix=ball', '--data', '--output=assets/blit-ball.s'], { stdio: 'inherit' });
}

// Expected pictures: the background of a variant with the balls at [[x, y], ...] (ball 0 in front), as RGB.
export function render(variant, balls) {
	const screen = Buffer.from(variant === 'band' ? full.screen : limited.screen);
	const palettes = Buffer.from(variant === 'band' ? full.palettes : withBall(limited.palettes));
	const limitedPalettes = withBall(limited.palettes);
	if (variant === 'band' && balls.length) for (let y = balls[0][1]; y < balls[0][1] + 32; y++) {
		limited.screen.copy(screen, y * 160, y * 160, y * 160 + 160);
		limitedPalettes.copy(palettes, (y - 1) * 96, (y - 1) * 96, y * 96);
	}
	for (const [ballX, ballY] of [...balls].reverse()) for (const [i, index] of ballIndex) {
		const x = ballX + (i & 31), y = ballY + (i >> 5);
		for (let p = 0; p < 4; p++) {
			const o = y * 160 + (x >> 4) * 8 + p * 2, bit = 0x8000 >> (x & 15);
			screen.writeUInt16BE((screen.readUInt16BE(o) & ~bit) | (index & (1 << p) ? bit : 0), o);
		}
	}
	const rgb = new Uint8Array(W * H * 3);
	for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
		let index = 0;
		for (let p = 0; p < 4; p++) if (screen.readUInt16BE(y * 160 + (x >> 4) * 8 + p * 2) & (0x8000 >> (x & 15))) index |= 1 << p;
		const word = palettes.readUInt16BE(((y - 1) * 48 + slotAt(x, index)) * 2);
		const nibble = v => ((v & 7) << 1) | (v >> 3);
		rgb.set([nibble(word >> 8) * 17, nibble((word >> 4) & 15) * 17, nibble(word & 15) * 17], (x + y * W) * 3);
	}
	return { screen, palettes, rgb };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	writeAssets();
	for (const variant of ['band', 'limited']) writePng(`assets/blit-${variant}.png`, W, H, render(variant, [[144, 84]]).rgb);
	console.log(`Mean OKLAB error per pixel: ${full.error.toFixed(3)} with 16 registers, ${limited.error.toFixed(3)} with 10.`);
	console.log(`Ball: k-means ${kmeans.map(c => c.toString(16).padStart(3, '0')).join(' ')}, mean error ${(ballError(kmeans, false) / opaque.length).toFixed(4)}, with checker ${(ballError(kmeans, true) / opaque.length).toFixed(4)}; chosen for the checker ${centers.map(c => c.toString(16).padStart(3, '0')).join(' ')}, ${(centersError / opaque.length).toFixed(4)}.`);
	console.log('Assets written.');
}
