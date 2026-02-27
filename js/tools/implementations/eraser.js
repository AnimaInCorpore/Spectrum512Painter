import { drawLine, inBounds, writePixel } from '../helpers/pixels.js';

function eraseAt(ctx, x, y) {
	writePixel(ctx, x, y, 255, 255, 255, 255);
}

export function createEraserTool() {
	return {
		onPointerDown({ api, point }) {
			const session = { last: { ...point } };
			if (inBounds(api.canvas, point.x, point.y)) {
				eraseAt(api.context, point.x, point.y);
			}
			return session;
		},
		onPointerMove({ api, point, session }) {
			if (!session) {
				return;
			}
			drawLine(api.canvas, api.context, session.last.x, session.last.y, point.x, point.y, (x, y) => {
				eraseAt(api.context, x, y);
			});
			session.last = { ...point };
		},
		onDoubleClick({ api }) {
			const rect = api.getVisibleRect();
			api.context.fillStyle = '#ffffff';
			api.context.fillRect(rect.x, rect.y, rect.width, rect.height);
		}
	};
}
