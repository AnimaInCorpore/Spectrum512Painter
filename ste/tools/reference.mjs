import { rgbToOklab } from '../../js/vendor/jscolorquantizer/quantizers/core.js';
import { getSpectrum512ColorSlotIndex as slotAt } from '../../js/imaging/spectrum512-slots.js';

export const labs = Array.from({ length: 4096 }, (_, id) => rgbToOklab([(id >> 8) * 17, ((id >> 4) & 15) * 17, (id & 15) * 17]).map(v => Math.round(v * 127)));
export const steWord = id => ((id & 0xeee) >> 1) | ((id & 0x111) << 3);
export const weight = (a, b) => Math.floor(64 * a * b / (a + b));
export const distance = (a, b) => labs[a].reduce((sum, v, i) => sum + (v - labs[b][i]) ** 2, 0);

function color(id, count = 1) {
	return { id, count, sums: [id >> 8, (id >> 4) & 15, id & 15].map(v => v * count) };
}

function merge(a, b) {
	a.count += b.count;
	a.sums = a.sums.map((v, i) => v + b.sums[i]);
	const values = a.sums.map(v => Math.floor((v + Math.floor(a.count / 2)) / a.count));
	a.id = (values[0] << 8) | (values[1] << 4) | values[2];
}

function fillSlots(line, options = {}) {
	const slots = options.checkpoint ? structuredClone(options.checkpoint) : Array.from({ length: 48 }, (_, i) => color(0, i === 0 || i === 32 ? 2 : 0));
	for (let x = options.startX || 0; x < 320; x++) {
		if (x % 32 === 0) options.onCheckpoint?.(x, structuredClone(slots));
		const incoming = color(line[x]), active = Array.from({ length: 16 }, (_, i) => slotAt(x, i));
		let placed = false;
		for (const index of active) {
			if (slots[index].id === incoming.id) {
				slots[index].count++;
				slots[index].sums = slots[index].sums.map((v, i) => v + incoming.sums[i]);
				placed = true; break;
			}
			if (slots[index].count === 0) { slots[index] = incoming; placed = true; break; }
		}
		if (placed) continue;
		let best = Infinity, bestA = -1, bestB = -1;
		const candidates = [-1, ...active];
		for (let i = 0; i < candidates.length - 1; i++) {
			for (let j = i + 1; j < candidates.length; j++) {
				const a = candidates[i], b = candidates[j];
				if (a === 32 || b === 32) continue;
				const ca = a < 0 ? incoming : slots[a], cb = slots[b];
				const cost = distance(ca.id, cb.id) * weight(ca.count, cb.count);
				if (cost < best) { best = cost; bestA = a; bestB = b; }
			}
		}
		if (bestA < 0) merge(slots[bestB], incoming);
		else {
			const keep = Math.min(bestA, bestB), free = Math.max(bestA, bestB);
			merge(slots[keep], slots[free]); slots[free] = incoming;
		}
	}
	return slots.map(c => c.id);
}

export function convertLine(line, options) {
	const slots = fillSlots(line, options), planar = Buffer.alloc(160), rgb = new Uint8Array(960);
	for (let x = 0; x < 320; x++) {
		let best = Infinity, index = 0;
		for (let i = 0; i < 16; i++) {
			const d = distance(line[x], slots[slotAt(x, i)]);
			if (d < best) { best = d; index = i; }
		}
		const id = slots[slotAt(x, index)];
		rgb.set([(id >> 8) * 17, ((id >> 4) & 15) * 17, (id & 15) * 17], x * 3);
		for (let plane = 0; plane < 4; plane++) if (index & (1 << plane)) {
			const offset = (x >> 4) * 8 + plane * 2;
			planar.writeUInt16BE(planar.readUInt16BE(offset) | (0x8000 >> (x & 15)), offset);
		}
	}
	return { slots, planar, rgb };
}

// Coordinate-anchored error-pair Checks dithering; no vertical state.
export function quantizeImage(image, originX = 0, originY = 0) {
	const result = new Uint16Array(image.width * image.height);
	for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
		const source = Array.from(image.rgba.subarray((x + y * image.width) * 4, (x + y * image.width) * 4 + 3));
		const q = v => Math.max(0, Math.min(15, Math.round(v / 17)));
		const a = source.map(q), b = source.map((v, i) => q(2 * v - a[i] * 17));
		const id = c => (c[0] << 8) | (c[1] << 4) | c[2];
		const light = c => rgbToOklab(c.map(v => v * 17))[0];
		let dark = a, bright = b;
		if (light(a) > light(b) || (light(a) === light(b) && id(a) > id(b))) [dark, bright] = [b, a];
		result[x + y * image.width] = id(((x + originX + y + originY) & 1) ? bright : dark);
	}
	return result;
}
