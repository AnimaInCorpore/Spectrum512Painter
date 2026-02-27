import { floodFill } from '../helpers/pixels.js';

export function createFillTool() {
	return {
		onPointerDown({ api, point }) {
			floodFill(api.canvas, api.context, point.x, point.y, [0, 0, 0, 255]);
			return null;
		}
	};
}
