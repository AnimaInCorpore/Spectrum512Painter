import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function paintMask(screen, mask, x, y) {
	for (let i = 0; i < 1024; i++) {
		if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
		const px = x + (i & 31), py = y + (i >> 5), bit = 0x8000 >> (px & 15);
		for (let plane = 0; plane < 4; plane++) {
			const offset = py * 160 + (px >> 4) * 8 + plane * 2;
			screen.writeUInt16BE(screen.readUInt16BE(offset) | bit, offset);
		}
	}
}

export function verifyRestores() {
	const background = readFileSync('assets/limited-background.bin');
	const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
	const routines = readFileSync('assets/limited-restore-code.s', 'utf8').split(/restore_overlap_\d+:\n/).slice(1);
	assert.equal(routines.length, 144);
	let index = 0;
	for (const dx of [-6, 0, 6]) for (const dy of [-4, 0, 4]) for (let shift = 0; shift < 16; shift++) {
		const oldX = 144 + shift, oldY = 84, base = oldY * 160 + (oldX >> 4) * 8;
		const actual = Buffer.from(background), expected = Buffer.from(background);
		paintMask(actual, mask, oldX, oldY);
		for (const line of routines[index++].trim().split('\n')) {
			if (line.trim() === 'rts') continue;
			const match = line.match(/move\.l (\d+)\(a0\),(\d+)\(a1\)/);
			assert.ok(match, `Unknown restore instruction: ${line}`);
			assert.equal(match[1], match[2]);
			const offset = base + Number(match[1]);
			background.copy(actual, offset, offset, offset + 4);
		}
		paintMask(actual, mask, oldX + dx, oldY + dy);
		paintMask(expected, mask, oldX + dx, oldY + dy);
		assert.ok(actual.equals(expected), `Overlap restore failed: dx=${dx}, dy=${dy}, shift=${shift}`);
	}
	console.log('Verified all 144 overlap-restoration routines.');
}
