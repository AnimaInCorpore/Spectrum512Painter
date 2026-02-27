import { constrainTo45Deg } from '../helpers/geometry.js';
import { drawLine, writePixel } from '../helpers/pixels.js';

function drawLineWithColor(api, from, to, color) {
	drawLine(api.canvas, api.context, from.x, from.y, to.x, to.y, (x, y) => {
		writePixel(api.context, x, y, color[0], color[1], color[2], 255);
	});
}

export function createLineTool() {
	return {
		onPointerDown({ point, api }) {
			return {
				start: { ...point },
				last: { ...point },
				color: api.foregroundColor
			};
		},
		onPointerMove({ point, session, event }) {
			if (!session) {
				return;
			}
			session.last = event.shiftKey ? constrainTo45Deg(session.start, point) : { ...point };
		},
		onPointerUp({ api, session, event, point }) {
			if (!session) {
				return;
			}
			const endPoint = event.shiftKey ? constrainTo45Deg(session.start, point) : point;
			drawLineWithColor(api, session.start, endPoint, session.color);
		}
	};
}
