import { drawLine, inBounds, writePixel } from '../helpers/pixels.js';

function eraseAt(ctx, color, x, y) {
	writePixel(ctx, x, y, color[0], color[1], color[2], 255);
}

export function createEraserTool() {
	return {
		onPointerDown({ api, point }) {
			const session = { last: { ...point }, color: api.backgroundColor };
			if (inBounds(api.canvas, point.x, point.y)) {
				eraseAt(api.context, session.color, point.x, point.y);
			}
			return session;
		},
		onPointerMove({ api, point, session }) {
			if (!session) {
				return;
			}
			drawLine(api.canvas, api.context, session.last.x, session.last.y, point.x, point.y, (x, y) => {
				eraseAt(api.context, session.color, x, y);
			});
			session.last = { ...point };
		},
		onDoubleClick({ api }) {
			const rect = api.getVisibleRect();
			const color = api.backgroundColor;
			api.context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
			api.context.fillRect(rect.x, rect.y, rect.width, rect.height);
		}
	};
}
