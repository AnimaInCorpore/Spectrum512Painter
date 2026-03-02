import { constrainToSquare } from '../helpers/geometry.js';
import { paintPatternStamp, resolvePatternMask } from '../helpers/patterns.js';
import { createCanvasPreviewSession, renderCanvasPreview } from '../helpers/preview.js';
import { paintColorStamp } from '../helpers/stroke.js';
import { drawRoundedRectangleOutline, fillRoundedRectangle } from '../helpers/shapes.js';

const DEFAULT_CORNER_RADIUS = 4;

function paintShapePixel(api, color, lineSize, x, y) {
	paintColorStamp(api.canvas, api.context, color, x, y, lineSize);
}

function paintPatternPixel(api, pattern, foregroundColor, backgroundColor, x, y) {
	paintPatternStamp(api.canvas, api.context, pattern, foregroundColor, backgroundColor, x, y, 1);
}

function resolveRoundedRectangleEndPoint(start, point, event) {
	if (event && event.shiftKey) {
		return constrainToSquare(start, point);
	}
	return point;
}

export function createRoundedRectangleTool() {
	return {
		onPointerDown({ point, api }) {
			return {
				start: { ...point },
				last: { ...point },
				color: api.foregroundColor,
				backgroundColor: api.backgroundColor,
				pattern: resolvePatternMask(api.activePatternIndex),
				lineSize: api.lineSize,
				shapeFillMode: api.shapeFillMode,
				preview: createCanvasPreviewSession(api)
			};
		},
		onPointerMove({ api, point, session, event }) {
			if (!session) {
				return;
			}
			session.last = resolveRoundedRectangleEndPoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				if (session.shapeFillMode) {
					fillRoundedRectangle(api.canvas, session.start, session.last, (x, y) => {
						paintPatternPixel(api, session.pattern, session.color, session.backgroundColor, x, y);
					}, { radius: DEFAULT_CORNER_RADIUS });
					return;
				}
				drawRoundedRectangleOutline(api.canvas, api.context, session.start, session.last, (x, y) => {
					paintShapePixel(api, session.color, session.lineSize, x, y);
				}, { radius: DEFAULT_CORNER_RADIUS });
			});
		},
		onPointerUp({ api, session, point, event }) {
			if (!session) {
				return;
			}
			const endPoint = resolveRoundedRectangleEndPoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				if (session.shapeFillMode) {
					fillRoundedRectangle(api.canvas, session.start, endPoint, (x, y) => {
						paintPatternPixel(api, session.pattern, session.color, session.backgroundColor, x, y);
					}, { radius: DEFAULT_CORNER_RADIUS });
					return;
				}
				drawRoundedRectangleOutline(api.canvas, api.context, session.start, endPoint, (x, y) => {
					paintShapePixel(api, session.color, session.lineSize, x, y);
				}, { radius: DEFAULT_CORNER_RADIUS });
			});
		}
	};
}
