import { constrainTo45Deg } from '../helpers/geometry.js';
import { drawLine } from '../helpers/pixels.js';
import { createCanvasPreviewSession, renderCanvasPreview } from '../helpers/preview.js';
import { paintColorStamp } from '../helpers/stroke.js';

function drawLineWithColor(api, from, to, color, lineSize) {
	drawLine(api.canvas, api.context, from.x, from.y, to.x, to.y, (x, y) => {
		paintColorStamp(api.canvas, api.context, color, x, y, lineSize);
	});
}

function resolveLineEndPoint(start, point, event) {
	return event.shiftKey ? constrainTo45Deg(start, point) : point;
}

export function createLineTool() {
	return {
		onPointerDown({ point, api }) {
			return {
				start: { ...point },
				last: { ...point },
				color: api.foregroundColor,
				lineSize: api.lineSize,
				preview: createCanvasPreviewSession(api)
			};
		},
		onPointerMove({ api, point, session, event }) {
			if (!session) {
				return;
			}
			session.last = resolveLineEndPoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				drawLineWithColor(api, session.start, session.last, session.color, session.lineSize);
			});
		},
		onPointerUp({ api, session, event, point }) {
			if (!session) {
				return;
			}
			const endPoint = resolveLineEndPoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				drawLineWithColor(api, session.start, endPoint, session.color, session.lineSize);
			});
		}
	};
}
