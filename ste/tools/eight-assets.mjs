import { distance, steWord } from './reference.mjs';

export function closestIndex(id, palette) {
	let best = Infinity, index = 0;
	palette.forEach((color, i) => { const error = distance(id, color); if (error < best) { best = error; index = i; } });
	return index;
}

// One palette for the whole ball permits any number of overlapping scanlines.
export function sharedPalette(ids, mask) {
	const counts = new Map();
	ids.forEach((id, i) => { if (mask[i >> 3] & (128 >> (i & 7))) counts.set(id, (counts.get(id) || 0) + 1); });
	const colors = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
	let palette = [colors[0]];
	while (palette.length < 6) {
		const next = colors.filter(id => !palette.includes(id)).sort((a, b) =>
			distance(b, palette[closestIndex(b, palette)]) * counts.get(b) - distance(a, palette[closestIndex(a, palette)]) * counts.get(a))[0];
		palette.push(next ?? 0);
	}
	for (let pass = 0; pass < 12; pass++) {
		const groups = palette.map(() => []);
		colors.forEach(id => groups[closestIndex(id, palette)].push(id));
		const next = groups.map((group, i) => group.length ? group.reduce((best, candidate) => {
			const error = id => group.reduce((sum, member) => sum + distance(id, member) * counts.get(member), 0);
			return error(candidate) < error(best) ? candidate : best;
		}, group[0]) : palette[i]);
		if (next.every((id, i) => id === palette[i])) break;
		palette = next;
	}
	return palette;
}

export function shiftedSprite(indices, mask) {
	const shifted = Buffer.alloc(16 * 960);
	for (let shift = 0; shift < 16; shift++) for (let y = 0; y < 32; y++) for (let group = 0; group < 3; group++) {
		let keep = 65535;
		const planes = [0, 0, 0, 0];
		for (let bit = 0; bit < 16; bit++) {
			const x = group * 16 + bit - shift, i = y * 32 + x;
			if (x < 0 || x >= 32 || !(mask[i >> 3] & (128 >> (i & 7)))) continue;
			keep &= ~(32768 >> bit);
			for (let p = 0; p < 4; p++) if (indices[i] & (1 << p)) planes[p] |= 32768 >> bit;
		}
		[keep, ...planes].forEach((word, i) => shifted.writeUInt16BE(word, shift * 960 + y * 30 + group * 10 + i * 2));
	}
	return shifted;
}

export function paletteRows(palette, rows = 32, banks = 1) {
	const result = Buffer.alloc(rows * banks * 12);
	for (let i = 0; i < rows * banks; i++) palette.forEach((id, p) => result.writeUInt16BE(steWord(id), i * 12 + p * 2));
	return result;
}

// Keep the six logical indices used by the pre-shifted sprite, but optimize
// their STE colors independently for each source row. This lets the raster
// palette follow the ball's highlights without rebuilding planar pixels.
export function rowPalettes(ids, mask, globalPalette) {
	const result = Buffer.alloc(32 * 12);
	for (let row = 0; row < 32; row++) for (let slot = 0; slot < 6; slot++) {
		const members = [];
		for (let x = 0; x < 32; x++) {
			const i = row * 32 + x;
			if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
			if (closestIndex(ids[i], globalPalette) === slot) members.push(ids[i]);
		}
		let best = globalPalette[slot];
		if (members.length) best = members.reduce((candidate, id) => {
			const cost = value => members.reduce((sum, member) => sum + distance(value, member), 0);
			return cost(id) < cost(candidate) ? id : candidate;
		}, members[0]);
		result.writeUInt16BE(steWord(best), row * 12 + slot * 2);
	}
	return result;
}

// Independent six-color palettes for each source row. Unlike rowPalettes,
// this does not inherit the global six-way grouping, so raw-fidelity drawing
// can map each original 12-bit source pixel directly at runtime.
export function independentRowPalettes(ids, mask) {
	const result = Buffer.alloc(32 * 12);
	for (let row = 0; row < 32; row++) {
		const rowIds = ids.subarray(row * 32, row * 32 + 32), rowMask = Buffer.alloc(4);
		for (let x = 0; x < 32; x++) if (mask[(row * 32 + x) >> 3] & (128 >> (x & 7))) rowMask[x >> 3] |= 128 >> (x & 7);
		sharedPalette(rowIds, rowMask).forEach((id, slot) => result.writeUInt16BE(steWord(id), row * 12 + slot * 2));
	}
	return result;
}

export function paletteLookup(ids, mask, rowPalettesSte) {
	const fromSte = new Map(Array.from({ length: 4096 }, (_, id) => [steWord(id), id]));
	const palettes = Array.from({ length: 32 }, (_, row) => Array.from({ length: 6 }, (_, slot) => fromSte.get(rowPalettesSte.readUInt16BE(row * 12 + slot * 2))));
	const result = Buffer.alloc(32 * 4096);
	for (let row = 0; row < 32; row++) for (let id = 0; id < 4096; id++) result[row * 4096 + id] = closestIndex(id, palettes[row]);
	return result;
}

export function opaquePixels(ids, mask) {
	const result = Buffer.alloc([...Array(ids.length).keys()].filter(i => mask[i >> 3] & (128 >> (i & 7))).length * 4);
	let offset = 0;
	for (let i = 0; i < ids.length; i++) if (mask[i >> 3] & (128 >> (i & 7))) {
		result[offset++] = i >> 5;
		result[offset++] = i & 31;
		result.writeUInt16BE(ids[i], offset);
		offset += 2;
	}
	return result;
}
