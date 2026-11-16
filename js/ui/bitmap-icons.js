import { patternBitAt } from '../tools/helpers/patterns.js';

const INK = [0, 0, 0, 255];
const PAPER = [255, 255, 255, 255];

function createCanvas(width, height) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

function paintPixels(width, height, isInk, { transparentPaper = false } = {}) {
	const canvas = createCanvas(width, height);
	const context = canvas.getContext('2d');
	const image = context.createImageData(width, height);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const ink = isInk(x, y);
			if (!ink && transparentPaper) {
				continue;
			}
			const color = ink ? INK : PAPER;
			image.data.set(color, (y * width + x) * 4);
		}
	}
	context.putImageData(image, 0, 0);
	return canvas.toDataURL('image/png');
}

/**
 * Renders a '#'/'.' bitmap (an array of equal-length strings) to a PNG data URL.
 */
export function bitmapToDataUrl(rows, options = {}) {
	const height = rows.length;
	const width = height > 0 ? rows[0].length : 0;
	return paintPixels(width, height, (x, y) => rows[y].charCodeAt(x) === 35, options);
}

/**
 * Renders a fill pattern swatch (black ink on white paper) to a PNG data URL.
 */
export function patternSwatchDataUrl(pattern, width, height) {
	return paintPixels(width, height, (x, y) => patternBitAt(pattern, x, y) === 1);
}

/**
 * Shows a bitmap on an element as an unscaled, pixel-exact background image.
 */
export function applyBitmap(element, rows, options = {}) {
	if (!element || !Array.isArray(rows) || rows.length === 0) {
		return;
	}
	element.style.backgroundImage = `url(${bitmapToDataUrl(rows, options)})`;
	element.style.width = `${rows[0].length}px`;
	element.style.height = `${rows.length}px`;
}
