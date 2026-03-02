import { constrainToLine } from '../helpers/geometry.js';
import { resolvePatternMask, paintPatternStamp } from '../helpers/patterns.js';
import { drawLine, inBounds } from '../helpers/pixels.js';

function paintAt(api, session, x, y) {
	paintPatternStamp(
		api.canvas,
		api.context,
		session.pattern,
		session.foregroundColor,
		session.backgroundColor,
		x,
		y,
		session.lineSize
	);
}

export function createFreehandTool() {
	return {
		onPointerDown({ api, point }) {
			const session = {
				start: { ...point },
				last: { ...point },
				lineSize: api.lineSize,
				pattern: resolvePatternMask(api.activePatternIndex),
				foregroundColor: api.foregroundColor,
				backgroundColor: api.backgroundColor
			};
			if (inBounds(api.canvas, point.x, point.y)) {
				paintAt(api, session, point.x, point.y);
			}
			return session;
		},
		onPointerMove({ api, point, session, event }) {
			if (!session) {
				return;
			}
			const next = event.shiftKey ? constrainToLine(session.start, point) : point;
			drawLine(api.canvas, api.context, session.last.x, session.last.y, next.x, next.y, (x, y) => {
				paintAt(api, session, x, y);
			});
			session.last = { ...next };
		},
		onPointerUp() {}
	};
}
