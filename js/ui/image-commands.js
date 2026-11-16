import { restrictToRect, flipHorizontal, flipVertical, invertColors, clearToWhite } from '../imaging/transforms.js';

const COMMANDS = [
	{ id: 'menu-block-flip-h', transform: flipHorizontal, key: 'h' },
	{ id: 'menu-block-flip-v', transform: flipVertical, key: 'j' },
	{ id: 'menu-block-invert', transform: invertColors, key: 'i' },
	{ id: 'menu-block-clear', transform: clearToWhite, key: null, confirm: ['Clear the whole picture?'], wholePictureOnly: true }
];

function isTextTarget(target) {
	const tag = target && typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
	return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function initImageCommands({ applyTransform, confirmAlert, selection }) {
	const selectAllEntry = document.getElementById('menu-block-select-all');
	const deselectEntry = document.getElementById('menu-block-deselect');
	const refreshSelectionEntries = rect => {
		if (deselectEntry) {
			deselectEntry.classList.toggle('disabled', !rect);
		}
	};
	if (selection) {
		selection.subscribe(refreshSelectionEntries);
		refreshSelectionEntries(selection.rect);
		if (selectAllEntry) {
			selectAllEntry.addEventListener('click', () => selection.selectAll());
		}
		if (deselectEntry) {
			deselectEntry.addEventListener('click', () => {
				if (!deselectEntry.classList.contains('disabled')) {
					selection.clear();
				}
			});
		}
	}

	const run = async command => {
		const hasSelection = Boolean(selection && selection.rect);
		const needsConfirm = command.confirm && !(command.wholePictureOnly && hasSelection);
		if (needsConfirm && confirmAlert && !(await confirmAlert(command.confirm))) {
			return;
		}
		// The commands act on the selected block only, or on the whole picture without a selection.
		applyTransform(restrictToRect(command.transform, hasSelection ? selection.rect : null));
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

	document.addEventListener('keydown', event => {
		if (!selection || event.defaultPrevented || isTextTarget(event.target)) {
			return;
		}
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
			event.preventDefault();
			selection.selectAll();
		}
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
