import { constrainToLine } from '../helpers/geometry.js';
import { drawLine, inBounds } from '../helpers/pixels.js';
import { paintColorStamp } from '../helpers/stroke.js';

export function createPencilTool() {
	return {
		onPointerDown({ api, point }) {
			const session = {
				start: { ...point },
				last: { ...point },
				foregroundColor: api.foregroundColor,
				lineSize: api.lineSize
			};
			if (inBounds(api.canvas, point.x, point.y)) {
				paintColorStamp(api.canvas, api.context, session.foregroundColor, point.x, point.y, session.lineSize);
			}
			return session;
		},
		onPointerMove({ api, point, session, event }) {
			if (!session) {
				return;
			}
			const next = event.shiftKey ? constrainToLine(session.start, point) : point;
			drawLine(api.canvas, api.context, session.last.x, session.last.y, next.x, next.y, (x, y) => {
				paintColorStamp(api.canvas, api.context, session.foregroundColor, x, y, session.lineSize);
			});
			session.last = { ...next };
		},
		onPointerUp() {}
	};
}
