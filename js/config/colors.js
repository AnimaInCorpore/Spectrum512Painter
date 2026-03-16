function hsvToRgb(h, s, v) {
	const hue = ((h % 360) + 360) % 360;
	const chroma = v * s;
	const hPrime = hue / 60;
	const x = chroma * (1 - Math.abs((hPrime % 2) - 1));
	let r1 = 0;
	let g1 = 0;
	let b1 = 0;

	if (hPrime >= 0 && hPrime < 1) {
		r1 = chroma;
		g1 = x;
	} else if (hPrime < 2) {
		r1 = x;
		g1 = chroma;
	} else if (hPrime < 3) {
		g1 = chroma;
		b1 = x;
	} else if (hPrime < 4) {
		g1 = x;
		b1 = chroma;
	} else if (hPrime < 5) {
		r1 = x;
		b1 = chroma;
	} else {
		r1 = chroma;
		b1 = x;
	}

	const m = v - chroma;
	return [
		Math.round((r1 + m) * 255),
		Math.round((g1 + m) * 255),
		Math.round((b1 + m) * 255)
	];
}

function buildRampRow(rowIndex, width, rowCount) {
	const colors = [];
	const maxX = Math.max(1, width - 1);
	const maxY = Math.max(1, rowCount - 1);

	if (rowIndex === 0) {
		for (let x = 0; x < width; x += 1) {
			const gray = Math.round((x / maxX) * 255);
			colors.push([gray, gray, gray]);
		}
		return colors;
	}

	const hue = ((rowIndex - 1) / maxY) * 360;
	for (let x = 0; x < width; x += 1) {
		const value = 0.08 + (x / maxX) * 0.92;
		colors.push(hsvToRgb(hue, 1, Math.min(1, value)));
	}

	return colors;
}

function buildGem256Palette() {
	const width = 16;
	const rows = 16;
	const colors = [];
	for (let row = 0; row < rows; row += 1) {
		colors.push(...buildRampRow(row, width, rows));
	}
	return colors;
}

export const GEM_256_COLORS = buildGem256Palette();
