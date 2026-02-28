import { inBounds, readPixel } from '../helpers/pixels.js';

function toOpaqueColor(sampled) {
	return [sampled[0], sampled[1], sampled[2], 255];
}

export function createFaucetTool() {
	return {
		onPointerDown({ api, point, event }) {
			if (!inBounds(api.canvas, point.x, point.y)) {
				return null;
			}
			const sampled = readPixel(api.context, point.x, point.y);
			const color = toOpaqueColor(sampled);
			if (event && event.altKey) {
				api.setBackgroundColor(color);
			} else {
				api.setForegroundColor(color);
			}
			return null;
		}
	};
}
