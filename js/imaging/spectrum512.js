import { RemapSpectrum512Image7 } from '../../jscolorquantizer/modules/quantizers/spectrum512.js';
import { createSpectrumCanvas } from './spectrum.js';

export const SPECTRUM512_TARGETS = {
	st512: { bitsPerColor: 3, label: '512 (ST)' },
	ste4096: { bitsPerColor: 4, label: '4096 (STE)' },
	ste32768: { bitsPerColor: 5, label: '32768 (STE Enhanced)' }
};

export const FLOYD_STEINBERG_DITHER_PRESETS = {
	floydSteinberg: {
		label: 'Floyd-Steinberg',
		pattern: [0, 0, 0, 7.0 / 16.0, 0, 0, 3.0 / 16.0, 5.0 / 16.0, 1.0 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg85: {
		label: 'Floyd-Steinberg (85%)',
		pattern: [0, 0, 0, 7.0 * 0.85 / 16.0, 0, 0, 3.0 * 0.85 / 16.0, 5.0 * 0.85 / 16.0, 1.0 * 0.85 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg75: {
		label: 'Floyd-Steinberg (75%)',
		pattern: [0, 0, 0, 7.0 * 0.75 / 16.0, 0, 0, 3.0 * 0.75 / 16.0, 5.0 * 0.75 / 16.0, 1.0 * 0.75 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg50: {
		label: 'Floyd-Steinberg (50%)',
		pattern: [0, 0, 0, 7.0 * 0.5 / 16.0, 0, 0, 3.0 * 0.5 / 16.0, 5.0 * 0.5 / 16.0, 1.0 * 0.5 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	falseFloydSteinberg: {
		label: 'False Floyd-Steinberg',
		pattern: [0, 0, 0, 3.0 / 8.0, 0, 0, 0, 3.0 / 8.0, 2.0 / 8.0, 0, 0, 0, 0, 0, 0]
	}
};

const DEFAULT_BITS_PER_COLOR = SPECTRUM512_TARGETS.ste4096.bitsPerColor;
const DEFAULT_DITHER_PATTERN = FLOYD_STEINBERG_DITHER_PRESETS.floydSteinberg.pattern;

function cloneCanvas(sourceCanvas) {
	const canvas = document.createElement('canvas');
	canvas.width = sourceCanvas.width;
	canvas.height = sourceCanvas.height;
	canvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
	return canvas;
}

export function createSpectrum512ConvertedCanvas(source, options = {}) {
	const bitsPerColor = Number.isFinite(options.bitsPerColor)
		? options.bitsPerColor
		: DEFAULT_BITS_PER_COLOR;
	const ditherPattern = options.ditherPattern || DEFAULT_DITHER_PATTERN;

	const resizedCanvas = createSpectrumCanvas(source);
	const convertedCanvas = cloneCanvas(resizedCanvas);
	const imageInfos = {};

	RemapSpectrum512Image7(convertedCanvas, imageInfos, bitsPerColor, ditherPattern);

	return convertedCanvas;
}
