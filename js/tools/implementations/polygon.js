import { constrainToSquare } from '../helpers/geometry.js';
import { createCanvasPreviewSession, renderCanvasPreview } from '../helpers/preview.js';
import { paintColorStamp } from '../helpers/stroke.js';
import { drawRegularPolygonOutline } from '../helpers/shapes.js';

const DEFAULT_POLYGON_SIDES = 5;

function paintShapePixel(api, color, lineSize, x, y) {
	paintColorStamp(api.canvas, api.context, color, x, y, lineSize);
}

function resolvePolygonEndPoint(start, point, event) {
	if (event && event.shiftKey) {
		return constrainToSquare(start, point);
	}
	return point;
}

export function createPolygonTool() {
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
			session.last = resolvePolygonEndPoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				drawRegularPolygonOutline(api.canvas, api.context, session.start, session.last, (x, y) => {
					paintShapePixel(api, session.color, session.lineSize, x, y);
				}, { sides: DEFAULT_POLYGON_SIDES });
			});
		},
		onPointerUp({ api, session, point, event }) {
			if (!session) {
				return;
			}
			const endPoint = resolvePolygonEndPoint(session.start, point, event);
			renderCanvasPreview(api, session.preview, () => {
				drawRegularPolygonOutline(api.canvas, api.context, session.start, endPoint, (x, y) => {
					paintShapePixel(api, session.color, session.lineSize, x, y);
				}, { sides: DEFAULT_POLYGON_SIDES });
			});
		}
	};
}
