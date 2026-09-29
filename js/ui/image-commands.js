import { flipHorizontal, flipVertical, invertColors, clearToWhite } from '../imaging/transforms.js';

const COMMANDS = [
	{ id: 'menu-file-new', transform: clearToWhite, key: 'n', confirm: 'Discard the current picture and start a new one?' },
	{ id: 'menu-block-flip-h', transform: flipHorizontal, key: 'h' },
	{ id: 'menu-block-flip-v', transform: flipVertical, key: 'j' },
	{ id: 'menu-block-invert', transform: invertColors, key: 'i' },
	{ id: 'menu-block-clear', transform: clearToWhite, key: null, confirm: 'Clear the whole picture?' }
];

function isTextTarget(target) {
	const tag = target && typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
	return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function initImageCommands({ applyTransform, confirmAlert }) {
	const run = async command => {
		if (command.confirm && confirmAlert && !(await confirmAlert(command.confirm))) {
			return;
		}
		applyTransform(command.transform);
	};

	COMMANDS.forEach(command => {
		const { id } = command;
		const entry = document.getElementById(id);
		if (!entry) {
			return;
		}
		entry.addEventListener('click', () => {
			if (!entry.classList.contains('disabled')) {
				run(command);
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
			run(command);
		}
	});
}
