import { inBounds, writePixel } from './pixels.js';

function normalizeSize(size) {
	return Math.max(1, Math.round(size || 1));
}

function stampBounds(x, y, size) {
	const brushSize = normalizeSize(size);
	const startX = Math.round(x - (brushSize - 1) / 2);
	const startY = Math.round(y - (brushSize - 1) / 2);
	return {
		startX,
		startY,
		brushSize
	};
}

export function paintColorStamp(canvas, ctx, color, x, y, size = 1) {
	const { startX, startY, brushSize } = stampBounds(x, y, size);
	for (let oy = 0; oy < brushSize; oy += 1) {
		for (let ox = 0; ox < brushSize; ox += 1) {
			const px = startX + ox;
			const py = startY + oy;
			if (!inBounds(canvas, px, py)) {
				continue;
			}
			writePixel(ctx, px, py, color[0], color[1], color[2], 255);
		}
	}
}
