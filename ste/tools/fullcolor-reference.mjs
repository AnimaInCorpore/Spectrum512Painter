import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { steWord } from './reference.mjs';
import { nearestSlot } from './fullcolor-palettes.mjs';
import { getSpectrum512ColorSlotIndex as slotAt } from '../../js/imaging/spectrum512-slots.js';

export function fullcolorReference() {
	const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
	const background = readFileSync('assets/fullcolor-background.bin'), bgPalettes = readFileSync('assets/fullcolor-background-palettes.bin');
	const source = readFileSync('assets/fullcolor-source.bin'), sprites = readFileSync('assets/fullcolor-sources.bin');
	const familyLookup = readFileSync('assets/fullcolor-families.bin'), familyMasks = readFileSync('assets/fullcolor-family-masks.bin');
	const paletteWords = readFileSync('assets/fullcolor-palettes.bin');
	const fromSte = new Map(Array.from({ length: 4096 }, (_, id) => [steWord(id), id]));
	const palettes = Array.from({ length: familyMasks.length }, (_, family) => Array.from({ length: 16 }, (_, i) => fromSte.get(paletteWords.readUInt16BE(family * 32 + i * 2))));
	const maps = palettes.map(palette => Uint8Array.from({ length: 4096 }, (_, id) => nearestSlot(id, palette)));
	function lineFamilies(balls, previous = []) {
		const masks = new Uint8Array(200);
		const add = list => list.forEach(([, y], ball) => {
			if (y < 1 || y > 168) return;
			for (let sy = 0; sy < 32; sy++) if (mask.readUInt32BE(sy * 4)) masks[y + sy] |= 1 << ball;
		});
		add(balls);
		add(previous);
		return masks.map(active => familyLookup[active]);
	}
	function put(screen, x, y, index) {
		const bit = 32768 >> (x & 15);
		for (let p = 0; p < 4; p++) {
			const offset = y * 160 + (x >> 4) * 8 + p * 2;
			screen.writeUInt16BE((screen.readUInt16BE(offset) & ~bit) | (index & (1 << p) ? bit : 0), offset);
		}
	}
	function compose(balls, previous = []) {
		const families = lineFamilies(balls, previous), screen = Buffer.from(background), stream = Buffer.from(bgPalettes);
		for (let y = 1; y < 200; y++) if (families[y]) {
			const family = families[y], map = maps[family];
			for (let x = 0; x < 320; x++) put(screen, x, y, map[source.readUInt16BE((y * 320 + x) * 2)]);
			for (let bank = 0; bank < 3; bank++) paletteWords.copy(stream, (y - 1) * 96 + bank * 32, family * 32, family * 32 + 32);
		}
		balls.forEach(([x, y], ball) => {
			for (let i = 0; i < 1024; i++) if (mask[i >> 3] & (128 >> (i & 7))) {
				const py = y + (i >> 5), id = sprites.readUInt16BE((ball * 1024 + i) * 2);
				put(screen, x + (i & 31), py, maps[families[py]][id]);
			}
		});
		return { screen, stream, families };
	}
	function rgb({ screen, stream }) {
		const result = Buffer.alloc(320 * 200 * 3);
		for (let y = 1; y < 200; y++) for (let x = 0; x < 320; x++) {
			let index = 0;
			for (let p = 0; p < 4; p++) if (screen.readUInt16BE(y * 160 + (x >> 4) * 8 + p * 2) & (32768 >> (x & 15))) index |= 1 << p;
			const id = fromSte.get(stream.readUInt16BE((y - 1) * 96 + slotAt(x, index) * 2));
			result.set([id >> 8, (id >> 4) & 15, id & 15].map(v => v * 17), (y * 320 + x) * 3);
		}
		return result;
	}
	function verifyRows() {
		const indices = readFileSync('assets/fullcolor-sprite-index.bin'), rows = readFileSync('assets/fullcolor-sprite-rows.bin');
		for (let active = 0; active < 256; active++) assert.equal(familyMasks[familyLookup[active]] & active, active);
		for (let family = 1; family < palettes.length; family++) for (let ball = 0; ball < 8; ball++) if (familyMasks[family] & (1 << ball)) {
			for (let sy = 0; sy < 32; sy++) {
				const offset = indices.readUInt32BE(((family * 8 + ball) * 32 + sy) * 4);
				for (let x = 0; x < 32; x++) if (mask.readUInt32BE(sy * 4) & (0x80000000 >>> x)) {
					let index = 0;
					for (let p = 0; p < 4; p++) if (rows.readUInt32BE(offset + p * 4) & (0x80000000 >>> x)) index |= 1 << p;
					assert.equal(index, maps[family][sprites.readUInt16BE((ball * 1024 + sy * 32 + x) * 2)]);
				}
			}
		}
		console.log('Verified every cached sprite row against nearest STE source colors, and all 256 hue-mask selections.');
	}
	return { compose, rgb, verifyRows };
}
