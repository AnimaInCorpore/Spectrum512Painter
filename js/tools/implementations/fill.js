import { floodFill } from '../helpers/pixels.js';

export function createFillTool() {
	return {
		onPointerDown({ api, point }) {
			floodFill(api.canvas, api.context, point.x, point.y, api.foregroundColor);
			return null;
		}
	};
}
