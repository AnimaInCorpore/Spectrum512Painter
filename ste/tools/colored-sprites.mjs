// A shared six-register palette keeps every ball stable at arbitrary overlaps.
// Spatial mixing supplies additional apparent hues and intermediate shading.
export const BALL_PALETTE = [0x111, 0xfff, 0xf33, 0x3d4, 0x35f, 0xfd3];
export const BALL_TINTS = [
	['Ruby', [1, .20, .20]], ['Emerald', [.20, .87, .27]],
	['Sapphire', [.20, .33, 1]], ['Gold', [1, .87, .20]],
	['Orange', [1, .51, .20]], ['Violet', [.62, .25, .67]],
	['Turquoise', [.20, .61, .67]], ['Silver', [.87, .87, .87]]
];
const rgb = id => [id >> 8, (id >> 4) & 15, id & 15].map(v => v / 15);
const palette = BALL_PALETTE.map(rgb);
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function shadedColor(image, pixel, tint) {
	const light = (image.rgba[pixel * 4] + image.rgba[pixel * 4 + 1] + image.rgba[pixel * 4 + 2]) / (3 * 255);
	const highlight = Math.pow(Math.max(0, (light - .60) / .40), 3) * .85;
	return tint.map(v => light * (v * (1 - highlight) + highlight));
}

// Build-time ordered dithering. Accumulated color error builds a 16-sample
// mixture, allowing e.g. red + yellow + shadow to retain an orange hue.
// Sorting by brightness gives a consistent sprite-local threshold pattern.
function ditherIndex(target, x, y) {
	const mixture = [], residual = [0, 0, 0];
	const colors = Math.max(...target) - Math.min(...target) < .02 ? 2 : 6;
	for (let sample = 0; sample < 16; sample++) {
		let best = Infinity, selected = 0;
		for (let color = 0; color < colors; color++) {
			const error = target.reduce((sum, v, c) => sum + (v + residual[c] - palette[color][c]) ** 2, 0);
			if (error < best) { best = error; selected = color; }
		}
		mixture.push(selected);
		for (let c = 0; c < 3; c++) residual[c] += target[c] - palette[selected][c];
	}
	const light = index => palette[index].reduce((sum, v, c) => sum + v * [.2126, .7152, .0722][c], 0);
	mixture.sort((a, b) => light(a) - light(b));
	return mixture[bayer[(y & 3) * 4 + (x & 3)]] + 10;
}

export function coloredSprites(image, mask) {
	return BALL_TINTS.map(([, tint]) => {
		const indices = Buffer.alloc(1024);
		for (let i = 0; i < 1024; i++) if (mask[i >> 3] & (128 >> (i & 7))) {
			indices[i] = ditherIndex(shadedColor(image, i, tint), i & 31, i >> 5);
		}
		return indices;
	});
}
