import { constrainToLine } from '../helpers/geometry.js';
import { drawLine, inBounds, writePixel } from '../helpers/pixels.js';

function paintPixel(ctx, color, x, y) {
	writePixel(ctx, x, y, color[0], color[1], color[2], 255);
}

export function createPencilTool() {
	return {
		onPointerDown({ api, point }) {
			const session = {
				start: { ...point },
				last: { ...point },
				color: api.foregroundColor
			};
			if (inBounds(api.canvas, point.x, point.y)) {
				paintPixel(api.context, session.color, point.x, point.y);
			}
			return session;
		},
		onPointerMove({ api, point, session, event }) {
			if (!session) {
				return;
			}
			const next = event.shiftKey ? constrainToLine(session.start, point) : point;
			drawLine(api.canvas, api.context, session.last.x, session.last.y, next.x, next.y, (x, y) => {
				paintPixel(api.context, session.color, x, y);
			});
			session.last = { ...next };
		},
		onPointerUp() {}
	};
}
