import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reuseReference } from './verify-background-reuse.mjs';
import { INITIAL_BALLS, advanceBalls, scatterBalls } from './eight-model.mjs';

export function eightReference() {
	const background = readFileSync('assets/limited-background.bin');
	const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
	const dedicated = readFileSync('assets/eight-sprite-indices.bin');
	const globalPalette = readFileSync('assets/eight-sprite-stream.bin').subarray(0, 12);
	const rowPalettes = readFileSync('assets/eight-row-palettes.bin');
	const reuse = reuseReference({ prefix: 'eight', improvementFactor: 2 });
	function paint(screen, x, y, indices) {
		for (let i = 0; i < 1024; i++) {
			if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
			const px = x + (i & 31), py = y + (i >> 5), bit = 32768 >> (px & 15);
			for (let plane = 0; plane < 4; plane++) {
				const offset = py * 160 + (px >> 4) * 8 + plane * 2;
				screen.writeUInt16BE((screen.readUInt16BE(offset) & ~bit) | (indices[i] & (1 << plane) ? bit : 0), offset);
			}
		}
	}
	const routines = readFileSync('assets/eight-sprite-code.s', 'utf8').split(/sprite_draw_\d+:\n/).slice(1).map(body =>
		[...body.matchAll(/(move|andi|ori)\.l #\$([0-9a-f]+),(\d+)\(a1\)/g)].map(([, op, bits, offset]) => [op, parseInt(bits, 16), Number(offset)]));
	assert.equal(routines.length, 16);
	function compiled(screen, x, y, borrowing) {
		const base = y * 160 + (x >> 4) * 8;
		for (const [op, bits, displacement] of routines[x & 15]) {
			const offset = base + displacement, old = screen.readUInt32BE(offset);
			screen.writeUInt32BE((op === 'move' ? bits : op === 'andi' ? old & bits : old | bits) >>> 0, offset);
		}
		if (borrowing) reuse.apply(screen, x, y);
	}
	function compose(balls, borrowing = true, machineCode = false) {
		const screen = Buffer.from(background);
		for (const [x, y] of balls) {
			assert.ok(x >= 0 && x <= 288 && y >= 1 && y <= 168);
			if (machineCode) compiled(screen, x, y, borrowing);
			else paint(screen, x, y, borrowing ? reuse.choose(x, y) : dedicated);
		}
		return screen;
	}
	function paletteStream(balls, adaptive = true) {
		const stream = Buffer.alloc(202 * 36);
		for (let line = 0; line < 202; line++) {
			let row = -1;
			if (adaptive) for (const [, y] of balls) {
				if (line >= y && line < y + 32) row = line - y;
			}
			const palette = row >= 0 ? rowPalettes.subarray(row * 12, row * 12 + 12) : globalPalette;
			for (let bank = 0; bank < 3; bank++) palette.copy(stream, line * 36 + bank * 12);
		}
		return stream;
	}
	return { compose, paletteStream };
}

export function expectedBalls(frame) {
	const balls = structuredClone(INITIAL_BALLS);
	for (let i = 2; i <= frame; i++) {
		if (i === 101) scatterBalls(balls);
		else if (i !== 181) advanceBalls(balls);
	}
	return balls;
}

export function verifyEightAssets(reference) {
	const cases = [INITIAL_BALLS, Array.from({ length: 8 }, (_, i) => [140 + i, 80 + i, 1, 1])];
	for (let x = 0; x <= 288; x++) cases.push([[x, 1], [288 - x, 168]]);
	for (let y = 1; y <= 168; y++) cases.push([[0, y], [144, y], [288, y], [(y * 73) % 289, y]]);
	for (const frame of [30, 100, 101, 180, 181, 260]) cases.push(expectedBalls(frame));
	for (const balls of cases) for (const borrowing of [true, false]) {
		assert.ok(reference.compose(balls, borrowing).equals(reference.compose(balls, borrowing, true)), 'Eight-ball blitter/reuse mismatch');
	}
	console.log(`Verified ${cases.length} edge, overlap and scatter scenes in both color modes.`);
}
