export function createToolState(initialTool = 'pencil') {
	let activeTool = initialTool;

	return {
		getActiveTool() {
			return activeTool;
		},
		setActiveTool(toolId) {
			if (!toolId) {
				return;
			}
			activeTool = toolId;
		}
	};
}
