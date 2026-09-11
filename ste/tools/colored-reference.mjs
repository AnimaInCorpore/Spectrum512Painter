import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INITIAL_BALLS, advanceBalls, scatterBalls } from './eight-model.mjs';

export function coloredReference() {
	const background = readFileSync('assets/limited-background.bin');
	const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
	const indices = readFileSync('assets/colored-sprite-indices.bin');
	const code = readFileSync('assets/colored-sprite-code.s', 'utf8');
	const routines = new Map([...code.matchAll(/color(\d)_draw_(\d+):\n([\s\S]*?)\trts/g)].map(([, ball, shift, body]) => [
		`${ball}:${shift}`, [...body.matchAll(/(move|andi|ori)\.l #\$([0-9a-f]+),(\d+)\(a1\)/g)]
			.map(([, op, bits, offset]) => [op, parseInt(bits, 16), Number(offset)])
	]));
	assert.equal(routines.size, 128);
	function compose(balls, compiled = false) {
		const screen = Buffer.from(background);
		balls.forEach(([x, y], ball) => {
			assert.ok(x >= 0 && x <= 288 && y >= 1 && y <= 168);
			if (compiled) {
				for (const [op, bits, displacement] of routines.get(`${ball}:${x & 15}`)) {
					const offset = y * 160 + (x >> 4) * 8 + displacement, old = screen.readUInt32BE(offset);
					screen.writeUInt32BE((op === 'move' ? bits : op === 'andi' ? old & bits : old | bits) >>> 0, offset);
				}
				return;
			}
			for (let i = 0; i < 1024; i++) {
				if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
				const px = x + (i & 31), py = y + (i >> 5), bit = 32768 >> (px & 15);
				const index = indices[ball * 1024 + i];
				assert.ok(index >= 10 && index <= 15);
				for (let plane = 0; plane < 4; plane++) {
					const offset = py * 160 + (px >> 4) * 8 + plane * 2;
					screen.writeUInt16BE((screen.readUInt16BE(offset) & ~bit) | (index & (1 << plane) ? bit : 0), offset);
				}
			}
		});
		return screen;
	}
	return { compose };
}

export function coloredPositions(frame) {
	const balls = structuredClone(INITIAL_BALLS);
	for (let n = 2; n <= frame; n++) {
		if (n === 101) scatterBalls(balls);
		else advanceBalls(balls);
	}
	return balls;
}

export function verifyColoredBlitters(reference) {
	const cases = [INITIAL_BALLS, Array.from({ length: 8 }, () => [144, 84])];
	for (let x = 0; x <= 288; x++) cases.push(Array.from({ length: 8 }, (_, i) => [i & 1 ? x : 288 - x, 1 + i * 23]));
	for (let y = 1; y <= 168; y++) cases.push(Array.from({ length: 8 }, (_, i) => [Math.min(i * 48, 288), y]));
	for (const frame of [30, 100, 101, 160]) cases.push(coloredPositions(frame));
	for (const balls of cases) assert.ok(reference.compose(balls).equals(reference.compose(balls, true)), 'Colored compiled blitter mismatch');
	console.log(`Verified all eight colors in ${cases.length} edge, alignment and overlap scenes.`);
}
