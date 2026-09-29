import { flipHorizontal, flipVertical, invertColors, clearToWhite } from '../imaging/transforms.js';

const COMMANDS = [
	{ id: 'menu-file-new', transform: clearToWhite, key: 'n' },
	{ id: 'menu-block-flip-h', transform: flipHorizontal, key: 'h' },
	{ id: 'menu-block-flip-v', transform: flipVertical, key: 'j' },
	{ id: 'menu-block-invert', transform: invertColors, key: 'i' },
	{ id: 'menu-block-clear', transform: clearToWhite, key: null }
];

function isTextTarget(target) {
	const tag = target && typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
	return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function initImageCommands({ applyTransform }) {
	COMMANDS.forEach(({ id, transform }) => {
		const entry = document.getElementById(id);
		if (!entry) {
			return;
		}
		entry.addEventListener('click', () => {
			if (!entry.classList.contains('disabled')) {
				applyTransform(transform);
			}
		});
	});

	// Ctrl/Cmd shortcuts, mirroring the labels shown in the menus.
	document.addEventListener('keydown', event => {
		if (event.defaultPrevented || isTextTarget(event.target)) {
			return;
		}
		if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
			return;
		}
		const command = COMMANDS.find(c => c.key && c.key === event.key.toLowerCase());
		if (command) {
			event.preventDefault();
			applyTransform(command.transform);
		}
	});
}
