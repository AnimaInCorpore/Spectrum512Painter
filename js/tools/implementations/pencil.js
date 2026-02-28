import { constrainToLine } from '../helpers/geometry.js';
import { drawLine, inBounds, readPixel, writePixel } from '../helpers/pixels.js';

function isBlack(pixel) {
	return pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0;
}

function togglePixel(ctx, x, y) {
	const source = readPixel(ctx, x, y);
	const toWhite = isBlack(source);
	const next = toWhite ? 255 : 0;
	writePixel(ctx, x, y, next, next, next, 255);
}

export function createPencilTool() {
	return {
		onPointerDown({ api, point }) {
			const session = {
				start: { ...point },
				last: { ...point }
			};
			if (inBounds(api.canvas, point.x, point.y)) {
				togglePixel(api.context, point.x, point.y);
			}
			return session;
		},
		onPointerMove({ api, point, session, event }) {
			if (!session) {
				return;
			}
			const next = event.shiftKey ? constrainToLine(session.start, point) : point;
			drawLine(api.canvas, api.context, session.last.x, session.last.y, next.x, next.y, (x, y) => {
				togglePixel(api.context, x, y);
			});
			session.last = { ...next };
		},
		onPointerUp() {}
	};
}
