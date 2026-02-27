import { constrainTo45Deg } from '../helpers/geometry.js';
import { drawLine, writePixel } from '../helpers/pixels.js';

function drawBlackLine(api, from, to) {
	drawLine(api.canvas, api.context, from.x, from.y, to.x, to.y, (x, y) => {
		writePixel(api.context, x, y, 0, 0, 0, 255);
	});
}

export function createLineTool() {
	return {
		onPointerDown({ point }) {
			return {
				start: { ...point },
				last: { ...point }
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
			drawBlackLine(api, session.start, endPoint);
		}
	};
}
