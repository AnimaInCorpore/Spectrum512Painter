import { constrainToSquare } from '../helpers/geometry.js';
import { createCanvasPreviewSession, renderCanvasPreview } from '../helpers/preview.js';
import { paintColorStamp } from '../helpers/stroke.js';
import { drawRectangleOutline, fillRectangle } from '../helpers/shapes.js';

function paintShapePixel(api, color, lineSize, x, y) {
	paintColorStamp(api.canvas, api.context, color, x, y, lineSize);
}

function resolveRectangleEndPoint(start, point, event) {
	if (event && event.shiftKey) {
		return constrainToSquare(start, point);
	}
	return point;
}

export function createRectangleTool() {
	return {
		onPointerDown({ point, api }) {
			return {
				start: { ...point },
				last: { ...point },
				color: api.foregroundColor,
				lineSize: api.lineSize,
				shapeFillMode: api.shapeFillMode,
				preview: createCanvasPreviewSession(api)
			};
		},
		onPointerMove({ api, point, session, event }) {
			if (!session) {
				return;
			}
			session.last = resolveRectangleEndPoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				if (session.shapeFillMode) {
					fillRectangle(api.canvas, session.start, session.last, (x, y) => {
						paintShapePixel(api, session.color, 1, x, y);
					});
					return;
				}
				drawRectangleOutline(api.canvas, api.context, session.start, session.last, (x, y) => {
					paintShapePixel(api, session.color, session.lineSize, x, y);
				});
			});
		},
		onPointerUp({ api, session, point, event }) {
			if (!session) {
				return;
			}
			const endPoint = resolveRectangleEndPoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				if (session.shapeFillMode) {
					fillRectangle(api.canvas, session.start, endPoint, (x, y) => {
						paintShapePixel(api, session.color, 1, x, y);
					});
					return;
				}
				drawRectangleOutline(api.canvas, api.context, session.start, endPoint, (x, y) => {
					paintShapePixel(api, session.color, session.lineSize, x, y);
				});
			});
		}
	};
}
