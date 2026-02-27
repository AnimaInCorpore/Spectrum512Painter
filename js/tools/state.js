export function createToolState(initialTool = 'pencil') {
	let activeTool = initialTool;
	let foregroundColor = [0, 0, 0, 255];
	let backgroundColor = [255, 255, 255, 255];

	return {
		getActiveTool() {
			return activeTool;
		},
		setActiveTool(toolId) {
			if (!toolId) {
				return;
			}
			activeTool = toolId;
		},
		getForegroundColor() {
			return [...foregroundColor];
		},
		setForegroundColor(color) {
			if (!Array.isArray(color) || color.length < 3) {
				return;
			}
			foregroundColor = [color[0], color[1], color[2], 255];
		},
		getBackgroundColor() {
			return [...backgroundColor];
		},
		setBackgroundColor(color) {
			if (!Array.isArray(color) || color.length < 3) {
				return;
			}
			backgroundColor = [color[0], color[1], color[2], 255];
		}
	};
}
