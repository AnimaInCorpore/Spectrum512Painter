import { floodFill } from '../helpers/pixels.js';
import { patternColorAt, resolvePatternMask } from '../helpers/patterns.js';

export function createFillTool() {
	return {
		onPointerDown({ api, point }) {
			const pattern = resolvePatternMask(api.activePatternIndex);
			const foreground = api.foregroundColor;
			const background = api.backgroundColor;
			floodFill(api.canvas, api.context, point.x, point.y, (x, y) => (
				patternColorAt(pattern, foreground, background, x, y)
			));
			return null;
		}
	};
}
