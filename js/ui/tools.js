export function initToolSelection(root = document, { onToolChange } = {}) {
	const toolButtons = Array.from(root.querySelectorAll('.gem-tool-btn'));

	const notifySelectedTool = button => {
		if (typeof onToolChange === 'function' && button && button.dataset.tool) {
			onToolChange(button.dataset.tool);
		}
	};

	const initialButton = toolButtons.find(button => button.classList.contains('active'));
	notifySelectedTool(initialButton);

	toolButtons.forEach(button => {
		button.addEventListener('click', function() {
			toolButtons.forEach(otherButton => otherButton.classList.remove('active'));
			button.classList.add('active');
			notifySelectedTool(button);
		});
	});
}
