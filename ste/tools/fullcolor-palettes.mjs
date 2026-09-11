import { BALL_TINTS, shadedColor } from './colored-sprites.mjs';
import { distance } from './reference.mjs';

export function nearestRgb12(rgb) {
	const c = rgb.map(v => Math.max(0, Math.min(15, Math.round(v * 15))));
	return c[0] << 8 | c[1] << 4 | c[2];
}

export function sourceColors(background, sprite, mask) {
	const backgroundIds = Uint16Array.from({ length: 64000 }, (_, i) => nearestRgb12(Array.from(background.rgba.subarray(i * 4, i * 4 + 3), v => v / 255)));
	const sprites = BALL_TINTS.map(() => new Uint16Array(1024));
	// Retain each tinted source pixel at STE precision; no spatial dithering.
	for (let ball = 0; ball < 8; ball++) for (let i = 0; i < 1024; i++) {
		sprites[ball][i] = nearestRgb12(shadedColor(sprite, i, BALL_TINTS[ball][1]));
	}
	const histogram = ids => {
		const counts = new Map();
		ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
		return counts;
	};
	return { backgroundIds, sprites, backgroundCounts: histogram(backgroundIds), spriteCounts: sprites.map(ids => histogram(Array.from(ids).filter((_, i) => mask[i >> 3] & (128 >> (i & 7))))) };
}

// Give each present hue a stable representative and reserve black / highlight.
// The other entries minimize weighted background + original sprite color error.
export function sharedFullPalette(sources, activeMask) {
	const counts = new Map(sources.backgroundCounts);
	const palette = [0, 0xeee];
	for (let ball = 0; ball < 8; ball++) if (activeMask & (1 << ball)) {
		palette.push(nearestRgb12(BALL_TINTS[ball][1].map(v => v * .7)));
		for (const [id, count] of sources.spriteCounts[ball]) counts.set(id, (counts.get(id) || 0) + count * 38);
	}
	const fixed = palette.length, colors = [...counts.keys()];
	const errors = colors.map(id => Math.min(...palette.map(p => distance(id, p))));
	while (palette.length < 16) {
		let best = 0;
		for (let i = 1; i < colors.length; i++) if (errors[i] * counts.get(colors[i]) > errors[best] * counts.get(colors[best])) best = i;
		palette.push(colors[best]);
		colors.forEach((id, i) => errors[i] = Math.min(errors[i], distance(id, colors[best])));
	}
	for (let pass = 0; pass < 4; pass++) {
		const sums = palette.map(() => [0, 0, 0, 0]);
		for (const id of colors) {
			const slot = nearestSlot(id, palette), weight = counts.get(id), sum = sums[slot];
			sum[0] += (id >> 8) * weight; sum[1] += ((id >> 4) & 15) * weight; sum[2] += (id & 15) * weight; sum[3] += weight;
		}
		for (let slot = fixed; slot < 16; slot++) if (sums[slot][3]) palette[slot] = nearestRgb12(sums[slot].slice(0, 3).map(v => v / sums[slot][3] / 15));
	}
	return palette;
}

export function nearestSlot(id, palette) {
	let slot = 0, error = Infinity;
	for (let i = 0; i < palette.length; i++) { const next = distance(id, palette[i]); if (next < error) { slot = i; error = next; } }
	return slot;
}
