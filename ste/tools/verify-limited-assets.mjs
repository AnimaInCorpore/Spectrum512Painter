import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reuseReference } from './verify-background-reuse.mjs';
import { verifyRestores } from './verify-restores.mjs';

// Interpret the generated straight-line blitters independently of the generator.
// Real instruction encoding/execution is additionally exercised by Hatari.
export function verifyLimitedAssets() {
	const background = readFileSync('assets/limited-background.bin');
	const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
	const routines = readFileSync('assets/limited-sprite-code.s', 'utf8').split(/sprite_draw_\d+:\n/).slice(1);
	const reuse = reuseReference();
	assert.equal(routines.length, 16);
	const positions = [];
	for (let x = 0; x <= 288; x++) for (const y of [1, 168]) positions.push([x, y]);
	for (let y = 1; y <= 168; y++) for (const x of [0, 144, 288, (y * 73) % 289]) positions.push([x, y]);
	for (const [x, y] of positions) {
		const borrowed = reuse.choose(x, y);
		const actual = Buffer.from(background), expected = Buffer.from(background);
		const base = y * 160 + (x >> 4) * 8;
		for (const instruction of routines[x & 15].trim().split('\n')) {
			if (instruction.trim() === 'rts') continue;
			const match = instruction.match(/(move|andi|ori)\.l #\$([0-9a-f]+),(\d+)\(a1\)/);
			assert.ok(match, `Unknown instruction: ${instruction}`);
			const [, op, hex, displacement] = match;
			const offset = base + Number(displacement), bits = parseInt(hex, 16);
			const previous = actual.readUInt32BE(offset);
			actual.writeUInt32BE((op === 'move' ? bits : op === 'andi' ? previous & bits : previous | bits) >>> 0, offset);
		}
		reuse.apply(actual, x, y);
		for (let sy = 0; sy < 32; sy++) for (let sx = 0; sx < 32; sx++) {
			const i = sy * 32 + sx;
			if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
			const bit = 0x8000 >> ((x + sx) & 15);
			for (let p = 0; p < 4; p++) {
				const offset = (y + sy) * 160 + ((x + sx) >> 4) * 8 + p * 2;
				expected.writeUInt16BE((expected.readUInt16BE(offset) & ~bit) | (borrowed[i] & (1 << p) ? bit : 0), offset);
			}
		}
		assert.ok(actual.equals(expected), `Blitter mismatch at ${x},${y}`);
	}
	const basePalette = readFileSync('assets/limited-background-palettes.bin');
	const colors = readFileSync('assets/limited-sprite-palettes.bin');
	const spriteStream = readFileSync('assets/limited-sprite-stream.bin');
	const bgStream = readFileSync('assets/limited-background-stream.bin');
	for (let y = 1; y <= 168; y++) {
		const expected = Buffer.from(basePalette);
		for (let sy = 0; sy < 32; sy++) for (let bank = 0; bank < 3; bank++) {
			colors.copy(expected, (y + sy - 1) * 96 + bank * 32 + 20, sy * 12, sy * 12 + 12);
		}
		const actual = Buffer.alloc(expected.length), start = (201 - y) * 36;
		for (let row = 0; row < 201; row++) for (let bank = 0; bank < 3; bank++) {
			bgStream.copy(actual, row * 96 + bank * 32, row * 60 + bank * 20, row * 60 + bank * 20 + 20);
			spriteStream.copy(actual, row * 96 + bank * 32 + 20, start + row * 36 + bank * 12, start + row * 36 + bank * 12 + 12);
		}
		assert.ok(expected.equals(actual), `Palette mismatch at y=${y}`);
	}
	console.log(`Verified blitters and background reuse at ${positions.length} edge/interior positions, and all 168 palette windows.`);
	verifyRestores();
}
