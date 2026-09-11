import { distance, steWord } from './reference.mjs';
import { getSpectrum512ColorSlotIndex as slotAt } from '../../js/imaging/spectrum512-slots.js';

const fromSte = new Map(Array.from({ length: 4096 }, (_, id) => [steWord(id), id]));

function closestBackground(id, background) {
	const distances = Uint32Array.from({ length: 4096 }, (_, color) => distance(id, color));
	const costs = new Uint32Array(200 * 320), registers = new Uint8Array(200 * 320);
	for (let y = 1; y < 200; y++) for (let x = 0; x < 320; x++) {
		let best = Infinity, index = 0;
		for (let register = 0; register < 10; register++) {
			const cost = distances[background[y * 48 + slotAt(x, register)]];
			if (cost < best) { best = cost; index = register; }
		}
		costs[y * 320 + x] = best;
		registers[y * 320 + x] = index;
	}
	return { costs, registers };
}

// Build-time only: each pixel may use the ten background registers actually
// accessible at its screen coordinate, or its original dedicated sprite color.
export function createBackgroundReuse(backgroundPalettes, spritePalettes, spriteIds, indices, mask) {
	const background = Uint16Array.from({ length: 200 * 48 }, (_, i) => i < 48 ? 0 : fromSte.get(backgroundPalettes.readUInt16BE((i - 48) * 2)));
	const dedicated = Uint16Array.from({ length: 32 * 6 }, (_, i) => fromSte.get(spritePalettes.readUInt16BE(i * 2)));
	const pixels = [];
	const nearest = new Map();
	for (let i = 0; i < 1024; i++) {
		if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
		const id = spriteIds[i], sy = i >> 5, sx = i & 31;
		if (!nearest.has(id)) nearest.set(id, closestBackground(id, background));
		pixels.push({ i, sy, sx, baseline: indices[i], error: distance(id, dedicated[sy * 6 + indices[i] - 10]), ...nearest.get(id) });
	}
	return { pixels, background, dedicated };
}

export function reuseIndex(pixel, x, y) {
	const position = (y + pixel.sy) * 320 + x + pixel.sx;
	// Strict improvement preserves dedicated colors on ties, minimizing churn.
	return pixel.costs[position] < pixel.error ? pixel.registers[position] : pixel.baseline;
}

function encodePatch(words, patterns, patternIds) {
	const patch = [];
	for (let group = 0; group < 96; group++) {
		const planes = words.slice(group * 4, group * 4 + 4);
		if (!planes.some(Boolean)) continue;
		const key = Array.from(planes).join(',');
		if (!patternIds.has(key)) { patternIds.set(key, patterns.length); patterns.push(planes); }
		patch.push(group, patternIds.get(key));
	}
	if (patterns.length > 131072) throw Error('Reuse dictionary exceeds 17-bit pattern IDs');
	const buffer = Buffer.alloc(patch.length / 2 * 3 + 1);
	for (let i = 0; i < patch.length; i += 2) {
		buffer[i / 2 * 3] = patch[i] | ((patch[i + 1] >>> 16) << 7);
		buffer.writeUInt16BE(patch[i + 1] & 65535, i / 2 * 3 + 1);
	}
	buffer[buffer.length - 1] = 255;
	return buffer;
}

function compilePatterns(patterns) {
	// Fixed 16-byte 68000 routines: two EORI.L operations, then JMP (A5).
	// A power-of-two stride replaces a runtime multiply with a shift.
	const code = Buffer.alloc(patterns.length * 16);
	patterns.forEach((planes, i) => {
		const offset = i * 16;
		code.writeUInt16BE(0x0a91, offset);
		code.writeUInt16BE(planes[0], offset + 2);
		code.writeUInt16BE(planes[1], offset + 4);
		code.writeUInt16BE(0x0aa9, offset + 6);
		code.writeUInt16BE(planes[2], offset + 8);
		code.writeUInt16BE(planes[3], offset + 10);
		code.writeUInt16BE(4, offset + 12);
		code.writeUInt16BE(0x4ed5, offset + 14);
	});
	return code;
}

export function buildReusePatches(reuse) {
	const offsets = Buffer.alloc(168 * 289 * 4), streams = [], unique = new Map();
	const patterns = [], patternIds = new Map();
	let size = 0, oldError = 0, newError = 0, reused = 0;
	for (let y = 1; y <= 168; y++) for (let x = 0; x <= 288; x++) {
		const words = new Uint16Array(32 * 12);
		for (const pixel of reuse.pixels) {
			const position = (y + pixel.sy) * 320 + x + pixel.sx;
			oldError += pixel.error;
			newError += Math.min(pixel.error, pixel.costs[position]);
			const index = reuseIndex(pixel, x, y), changed = pixel.baseline ^ index;
			if (!changed) continue;
			reused++;
			const sx = (x & 15) + pixel.sx, bit = 0x8000 >> (sx & 15);
			for (let plane = 0; plane < 4; plane++) if (changed & (1 << plane)) words[pixel.sy * 12 + (sx >> 4) * 4 + plane] ^= bit;
		}
		const buffer = encodePatch(words, patterns, patternIds);
		const key = buffer.toString('base64');
		if (!unique.has(key)) { unique.set(key, size); streams.push(buffer); size += buffer.length; }
		offsets.writeUInt32BE(unique.get(key), ((y - 1) * 289 + x) * 4);
	}
	console.log(`Background reuse: error ${oldError} -> ${newError} (${(100 * (1 - newError / oldError)).toFixed(2)}% lower); ${reused} improved pixels across all positions.`);
	console.log(`Reuse patches: ${offsets.length} byte index + ${size} bytes, ${unique.size} unique streams.`);
	const code = compilePatterns(patterns);
	console.log(`Reuse dictionary: ${patterns.length} patterns, ${code.length} bytes of 68000 code.`);
	return { offsets, patches: Buffer.concat(streams), code };
}
