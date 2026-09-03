// Primitives describing the Spectrum 512 per-line slot layout. Shared by the converter and
// the brute-force slot optimizer so the layout is defined exactly once.

export const SLOT_COUNT = 48;
export const LOGICAL_COLOR_COUNT = 16;

/**
 * Maps a logical color index (0..15) at pixel column `x` onto one of the 48 physical
 * Spectrum 512 slots. Each logical color is served by three slots across the scanline,
 * switching at the positions where the ST reloads its palette registers.
 */
export function getSpectrum512ColorSlotIndex(x, colorIndex) {
	let temp = 10 * colorIndex;

	if (colorIndex & 1) {
		temp -= 5;
	} else {
		temp += 1;
	}

	if (x < temp) {
		return colorIndex;
	}
	if (x >= temp + 160) {
		return colorIndex + 32;
	}
	return colorIndex + 16;
}

export function clampColor(value) {
	if (value < 0) {
		return 0;
	}
	if (value > 255) {
		return 255;
	}
	return value;
}
