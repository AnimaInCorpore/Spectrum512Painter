export function createToolState(initialTool = 'pencil') {
	let activeTool = initialTool;
	let foregroundColor = [0, 0, 0, 255];
	let backgroundColor = [255, 255, 255, 255];
	let lineSize = 1;
	let shapeFillMode = false;
	const listeners = new Set();

	const notify = payload => {
		listeners.forEach(listener => {
			try {
				listener(payload);
			} catch (_error) {
				// Listener failures must not break tool updates.
			}
		});
	};

	const colorsMatch = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
	const clampLineSize = size => Math.max(1, Math.min(8, Math.round(size || 1)));

	return {
		getActiveTool() {
			return activeTool;
		},
		setActiveTool(toolId) {
			if (!toolId) {
				return;
			}
			activeTool = toolId;
			notify({ type: 'activeTool', value: activeTool });
		},
		getForegroundColor() {
			return [...foregroundColor];
		},
		setForegroundColor(color) {
			if (!Array.isArray(color) || color.length < 3) {
				return;
			}
			const nextColor = [color[0], color[1], color[2], 255];
			if (colorsMatch(foregroundColor, nextColor)) {
				return;
			}
			foregroundColor = nextColor;
			notify({ type: 'foregroundColor', value: [...foregroundColor] });
		},
		getBackgroundColor() {
			return [...backgroundColor];
		},
		setBackgroundColor(color) {
			if (!Array.isArray(color) || color.length < 3) {
				return;
			}
			const nextColor = [color[0], color[1], color[2], 255];
			if (colorsMatch(backgroundColor, nextColor)) {
				return;
			}
			backgroundColor = nextColor;
			notify({ type: 'backgroundColor', value: [...backgroundColor] });
		},
		getLineSize() {
			return lineSize;
		},
		setLineSize(size) {
			const nextSize = clampLineSize(size);
			if (nextSize === lineSize) {
				return;
			}
			lineSize = nextSize;
			notify({ type: 'lineSize', value: lineSize });
		},
		getShapeFillMode() {
			return shapeFillMode;
		},
		setShapeFillMode(enabled) {
			const next = Boolean(enabled);
			if (next === shapeFillMode) {
				return;
			}
			shapeFillMode = next;
			notify({ type: 'shapeFillMode', value: shapeFillMode });
		},
		subscribe(listener) {
			if (typeof listener !== 'function') {
				return () => {};
			}
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
	};
}
