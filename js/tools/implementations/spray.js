import { inBounds, writePixel } from '../helpers/pixels.js';

function sprayBurst(api, point, color) {
	const radius = 6;
	for (let i = 0; i < 18; i += 1) {
		const angle = Math.random() * Math.PI * 2;
		const distance = Math.random() * radius;
		const x = Math.round(point.x + Math.cos(angle) * distance);
		const y = Math.round(point.y + Math.sin(angle) * distance);
		if (inBounds(api.canvas, x, y)) {
			writePixel(api.context, x, y, color[0], color[1], color[2], 255);
		}
	}
}

export function createSprayTool() {
	return {
		onPointerDown({ api, point }) {
			const session = { last: { ...point }, timer: null, color: api.foregroundColor };
			sprayBurst(api, point, session.color);
			session.timer = window.setInterval(() => {
				sprayBurst(api, session.last, session.color);
			}, 50);
			return session;
		},
		onPointerMove({ api, point, session }) {
			if (!session) {
				return;
			}
			session.last = { ...point };
			sprayBurst(api, point, session.color);
		},
		onPointerUp({ session }) {
			if (session && session.timer) {
				window.clearInterval(session.timer);
				session.timer = null;
			}
		}
	};
}
