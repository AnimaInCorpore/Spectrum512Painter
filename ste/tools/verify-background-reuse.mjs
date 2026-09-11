import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPng } from './png.mjs';
import { distance, quantizeImage, steWord } from './reference.mjs';
import { getSpectrum512ColorSlotIndex as slotAt } from '../../js/imaging/spectrum512-slots.js';

export function reuseReference({ prefix = 'limited', improvementFactor = 1 } = {}) {
	const read = name => readFileSync(`assets/${name === 'background-palettes' ? 'limited' : prefix}-${name}.bin`);
	const indices = read('sprite-indices'), background = read('background-palettes'), sprite = read('sprite-palettes');
	const source = quantizeImage(readPng('../img/sprite-demo/sprite-32x32.png'), 144, 84);
	const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
	const decoded = new Map(Array.from({ length: 4096 }, (_, i) => [steWord(i), i]));
	const distances = new Map();
	for (const id of source) if (!distances.has(id)) distances.set(id, Uint32Array.from({ length: 4096 }, (_, i) => distance(id, i)));
	const offsets = read('reuse-index'), patches = read('reuse-patches'), code = read('reuse-code');
	assert.equal(offsets.length, 168 * 289 * 4);
	assert.equal(code.length % 16, 0);
	for (let p = 0; p < code.length; p += 16) {
		assert.equal(code.readUInt16BE(p), 0x0a91);
		assert.equal(code.readUInt16BE(p + 6), 0x0aa9);
		assert.equal(code.readUInt16BE(p + 12), 4);
		assert.equal(code.readUInt16BE(p + 14), 0x4ed5);
	}
	function choose(x, y) {
		const result = Buffer.from(indices);
		for (let i = 0; i < 1024; i++) {
			if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
			const sy = i >> 5, screenX = x + (i & 31), costs = distances.get(source[i]);
			const original = costs[decoded.get(sprite.readUInt16BE(sy * 12 + (indices[i] - 10) * 2))];
			let best = original;
			for (let register = 0; register < 10; register++) {
				const word = background.readUInt16BE((y + sy - 1) * 96 + slotAt(screenX, register) * 2);
				const error = costs[decoded.get(word)];
				if (error < best && error * improvementFactor < original) { best = error; result[i] = register; }
			}
		}
		return result;
	}
	function apply(screen, x, y) {
		let p = offsets.readUInt32BE(((y - 1) * 289 + x) * 4);
		const base = y * 160 + (x >> 4) * 8;
		let previousGroup = -1;
		while (patches[p] !== 255) {
			assert.ok(p + 2 < patches.length);
			const tag = patches[p++], group = tag & 127;
			assert.ok(group > previousGroup && group < 96);
			previousGroup = group;
			const pattern = ((tag >> 7) * 65536 + patches.readUInt16BE(p)) * 16;
			p += 2;
			const target = base + (group / 3 | 0) * 160 + (group % 3) * 8;
			for (let pair = 0; pair < 2; pair++) {
				const offset = target + pair * 4;
				screen.writeUInt32BE((screen.readUInt32BE(offset) ^ code.readUInt32BE(pattern + pair * 6 + 2)) >>> 0, offset);
			}
		}
	}
	return { choose, apply };
}
