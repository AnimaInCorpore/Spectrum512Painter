import { constrainTo45Deg } from '../helpers/geometry.js';
import { createCanvasPreviewSession, renderCanvasPreview } from '../helpers/preview.js';
import { paintColorStamp } from '../helpers/stroke.js';
import { drawPieSliceOutline } from '../helpers/shapes.js';

function paintShapePixel(api, color, lineSize, x, y) {
	paintColorStamp(api.canvas, api.context, color, x, y, lineSize);
}

function resolvePieSliceEdgePoint(start, point, event) {
	if (event && event.shiftKey) {
		return constrainTo45Deg(start, point);
	}
	return point;
}

export function createPieSliceTool() {
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
			session.last = resolvePieSliceEdgePoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				drawPieSliceOutline(api.canvas, api.context, session.start, session.last, (x, y) => {
					paintShapePixel(api, session.color, session.lineSize, x, y);
				});
			});
		},
		onPointerUp({ api, session, point, event }) {
			if (!session) {
				return;
			}
			const edgePoint = resolvePieSliceEdgePoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				drawPieSliceOutline(api.canvas, api.context, session.start, edgePoint, (x, y) => {
					paintShapePixel(api, session.color, session.lineSize, x, y);
				});
			});
		}
	};
}
