function buildRgbCubePalette() {
	const levels = [0, 51, 102, 153, 204, 255];
	const colors = [];
	for (let r = 0; r < levels.length; r += 1) {
		for (let g = 0; g < levels.length; g += 1) {
			for (let b = 0; b < levels.length; b += 1) {
				colors.push([levels[r], levels[g], levels[b]]);
			}
		}
	}
	return colors;
}

function buildGrayRampPalette(steps) {
	const colors = [];
	for (let i = 0; i < steps; i += 1) {
		const value = Math.round((i / Math.max(1, steps - 1)) * 255);
		colors.push([value, value, value]);
	}
	return colors;
}

function buildGem256Palette() {
	const cube = buildRgbCubePalette();
	const grays = buildGrayRampPalette(40);
	return cube.concat(grays);
}

export const GEM_256_COLORS = buildGem256Palette();
