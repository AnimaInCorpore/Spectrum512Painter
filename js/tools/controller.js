import { canvasPointFromMouse } from './helpers/geometry.js';

export function createToolController({ canvas, toolState, toolRegistry, context, getVisibleRect }) {
	let activeSession = null;
	let activeTool = null;

	const api = {
		canvas,
		context,
		getVisibleRect
	};

	const resolveTool = () => {
		const toolId = toolState.getActiveTool();
		return toolRegistry[toolId] || null;
	};

	const onMouseDown = event => {
		if (event.button !== 0) {
			return;
		}
		activeTool = resolveTool();
		if (!activeTool || typeof activeTool.onPointerDown !== 'function') {
			return;
		}
		const point = canvasPointFromMouse(event, canvas);
		activeSession = activeTool.onPointerDown({ api, event, point }) || null;
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	};

	const onMouseMove = event => {
		if (!activeTool || typeof activeTool.onPointerMove !== 'function') {
			return;
		}
		const point = canvasPointFromMouse(event, canvas);
		activeTool.onPointerMove({ api, event, point, session: activeSession });
	};

	const onMouseUp = event => {
		if (activeTool && typeof activeTool.onPointerUp === 'function') {
			const point = canvasPointFromMouse(event, canvas);
			activeTool.onPointerUp({ api, event, point, session: activeSession });
		}
		activeSession = null;
		activeTool = null;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	};

	const onDoubleClick = event => {
		const tool = resolveTool();
		if (!tool || typeof tool.onDoubleClick !== 'function') {
			return;
		}
		const point = canvasPointFromMouse(event, canvas);
		tool.onDoubleClick({ api, event, point });
	};

	canvas.addEventListener('mousedown', onMouseDown);
	canvas.addEventListener('dblclick', onDoubleClick);

	return {
		dispose() {
			canvas.removeEventListener('mousedown', onMouseDown);
			canvas.removeEventListener('dblclick', onDoubleClick);
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		}
	};
}
