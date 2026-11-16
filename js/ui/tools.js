import { TOOL_ICONS } from '../config/gem-icons.js';
import { applyBitmap } from './bitmap-icons.js';

// GEM Draw toolbox: a latched radio group of icon cells; the selected cell is shown inverted.

function decorateToolButton(button) {
	const icon = button.querySelector('.gem-tool-icon');
	const rows = TOOL_ICONS[button.dataset.tool];
	if (icon && rows) {
		applyBitmap(icon, rows);
	}
	button.setAttribute('aria-label', button.title || button.dataset.tool);
}

export function initToolSelection(root = document, { onToolChange } = {}) {
	const toolButtons = Array.from(root.querySelectorAll('.gem-tool-btn'));
	toolButtons.forEach(decorateToolButton);

	const select = button => {
		toolButtons.forEach(other => {
			const active = other === button;
			other.classList.toggle('active', active);
			other.setAttribute('aria-pressed', String(active));
		});
		if (typeof onToolChange === 'function' && button && button.dataset.tool) {
			onToolChange(button.dataset.tool);
		}
	};

	const initialButton = toolButtons.find(button => button.classList.contains('active')) || toolButtons[0] || null;
	if (initialButton) {
		select(initialButton);
	}

	toolButtons.forEach(button => {
		button.addEventListener('click', () => select(button));
	});
}
