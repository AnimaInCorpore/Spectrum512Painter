import { constrainToLine } from '../helpers/geometry.js';
import { drawLine, inBounds, readPixel, writePixel } from '../helpers/pixels.js';

function invertPixel(ctx, x, y) {
	const current = readPixel(ctx, x, y);
	const isBlack = current[0] < 128 && current[1] < 128 && current[2] < 128;
	const value = isBlack ? 255 : 0;
	writePixel(ctx, x, y, value, value, value, 255);
}

export function createPencilTool() {
	return {
		onPointerDown({ api, point }) {
			const session = {
				start: { ...point },
				last: { ...point }
			};
			if (inBounds(api.canvas, point.x, point.y)) {
				invertPixel(api.context, point.x, point.y);
			}
			return session;
		},
		onPointerMove({ api, point, session, event }) {
			if (!session) {
				return;
			}
			const next = event.shiftKey ? constrainToLine(session.start, point) : point;
			drawLine(api.canvas, api.context, session.last.x, session.last.y, next.x, next.y, (x, y) => {
				invertPixel(api.context, x, y);
			});
			session.last = { ...next };
		},
		onPointerUp() {}
	};
}
