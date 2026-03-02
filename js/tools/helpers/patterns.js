import { PATTERN_MASKS } from '../../config/patterns.js';
import { inBounds, writePixel } from './pixels.js';

function normalizePatternDimension(value, fallback) {
	const size = Math.max(1, Math.round(value || fallback));
	return Number.isFinite(size) ? size : fallback;
}

function normalizePattern(pattern) {
	if (!pattern || !Array.isArray(pattern.rows) || pattern.rows.length === 0) {
		return PATTERN_MASKS[0];
	}
	const height = normalizePatternDimension(pattern.height, pattern.rows.length);
	const width = normalizePatternDimension(pattern.width, pattern.rows[0] ? pattern.rows[0].length : 1);
	return { width, height, rows: pattern.rows };
}

function normalizePatternIndex(index) {
	const maxIndex = Math.max(0, PATTERN_MASKS.length - 1);
	if (!Number.isFinite(index)) {
		return 0;
	}
	return Math.max(0, Math.min(maxIndex, Math.round(index)));
}

export function resolvePatternMask(index) {
	const pattern = PATTERN_MASKS[normalizePatternIndex(index)];
	return normalizePattern(pattern);
}

export function patternBitAt(pattern, x, y) {
	const normalized = normalizePattern(pattern);
	const rowIndex = ((Math.round(y) % normalized.height) + normalized.height) % normalized.height;
	const columnIndex = ((Math.round(x) % normalized.width) + normalized.width) % normalized.width;
	const row = normalized.rows[rowIndex];
	if (!row || columnIndex >= row.length) {
		return 0;
	}
	return row.charCodeAt(columnIndex) === 49 ? 1 : 0;
}

export function patternColorAt(pattern, foregroundColor, backgroundColor, x, y) {
	return patternBitAt(pattern, x, y) ? foregroundColor : backgroundColor;
}

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

export function paintPatternStamp(canvas, ctx, pattern, foregroundColor, backgroundColor, x, y, size = 1) {
	const { startX, startY, brushSize } = stampBounds(x, y, size);
	for (let oy = 0; oy < brushSize; oy += 1) {
		for (let ox = 0; ox < brushSize; ox += 1) {
			const px = startX + ox;
			const py = startY + oy;
			if (!inBounds(canvas, px, py)) {
				continue;
			}
			const color = patternColorAt(pattern, foregroundColor, backgroundColor, px, py);
			writePixel(ctx, px, py, color[0], color[1], color[2], 255);
		}
	}
}
