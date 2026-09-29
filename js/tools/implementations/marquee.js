// Rectangle select: drag to define a selection, click to deselect.
export function createMarqueeTool({ selection }) {
	return {
		mutatesCanvas: false,
		onPointerDown({ point }) {
			selection.clear();
			return { start: { ...point }, moved: false };
		},
		onPointerMove({ point, session }) {
			if (!session) {
				return;
			}
			session.moved = session.moved || point.x !== session.start.x || point.y !== session.start.y;
			if (session.moved) {
				selection.setFromPoints(session.start, point);
			}
		},
		onPointerUp({ point, session }) {
			if (session && session.moved) {
				selection.setFromPoints(session.start, point);
			}
		}
	};
}
