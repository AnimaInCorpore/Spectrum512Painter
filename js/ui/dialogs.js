import { ALERT_ICONS } from '../config/gem-icons.js';
import { applyBitmap } from './bitmap-icons.js';

// GEM forms and alerts: a centred, shadowed box without a title bar. The default button
// has a thick frame and answers Return; Escape picks the cancel button when there is one.
// Clicks outside the box are ignored while it is open, as in GEM's modal form handling.

let activeForm = null;

function createButton(label, { isDefault }) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'gem-button';
	button.classList.toggle('default', isDefault);
	button.textContent = label;
	return button;
}

function trapKeys(event) {
	if (!activeForm) {
		return;
	}
	if (event.key === 'Enter') {
		event.preventDefault();
		activeForm.choose(activeForm.defaultIndex);
	} else if (event.key === 'Escape' && activeForm.cancelIndex !== null) {
		event.preventDefault();
		activeForm.choose(activeForm.cancelIndex);
	} else if (event.key !== 'Tab' && event.key !== ' ') {
		event.preventDefault();
	}
	// Keep menu and tool shortcuts away while a form is up.
	event.stopPropagation();
}

window.addEventListener('keydown', trapKeys, true);

/**
 * Shows a modal GEM form and resolves with the index of the button that closed it.
 */
export function showForm({ body, buttons = ['OK'], defaultIndex = 0, cancelIndex = null, className = '' }) {
	if (activeForm) {
		activeForm.choose(activeForm.cancelIndex ?? activeForm.defaultIndex);
	}

	return new Promise(resolve => {
		const overlay = document.createElement('div');
		overlay.className = 'gem-form-overlay';
		const form = document.createElement('div');
		form.className = `gem-form ${className}`.trim();
		form.setAttribute('role', 'dialog');
		form.setAttribute('aria-modal', 'true');
		form.appendChild(body);

		const buttonRow = document.createElement('div');
		buttonRow.className = 'gem-form-buttons';
		const buttonElements = buttons.map((label, index) => {
			const button = createButton(label, { isDefault: index === defaultIndex });
			button.addEventListener('click', () => choose(index));
			buttonRow.appendChild(button);
			return button;
		});
		form.appendChild(buttonRow);
		overlay.appendChild(form);

		const choose = index => {
			if (activeForm !== state) {
				return;
			}
			activeForm = null;
			overlay.remove();
			resolve(index);
		};
		const state = { choose, defaultIndex, cancelIndex };
		activeForm = state;

		document.body.appendChild(overlay);
		const focusTarget = buttonElements[defaultIndex] || buttonElements[0];
		if (focusTarget) {
			focusTarget.focus();
		}
	});
}

/**
 * GEM form_alert: an icon ('note', 'question' or 'stop'), up to five short lines of
 * text and one to three buttons.
 */
export function showAlert({ icon = 'note', lines = [], buttons = ['OK'], defaultIndex = 0, cancelIndex = null }) {
	const body = document.createElement('div');
	body.className = 'gem-alert-body';

	const iconElement = document.createElement('div');
	iconElement.className = 'gem-alert-icon';
	applyBitmap(iconElement, ALERT_ICONS[icon] || ALERT_ICONS.note);
	body.appendChild(iconElement);

	const text = document.createElement('div');
	text.className = 'gem-alert-text';
	lines.forEach(line => {
		const row = document.createElement('div');
		row.textContent = line;
		text.appendChild(row);
	});
	body.appendChild(text);

	return showForm({ body, buttons, defaultIndex, cancelIndex, className: 'gem-alert' });
}

/**
 * Wires the Desk menu info entry to the static info box content in the page.
 */
export function initInfoBox({ menuItem, template }) {
	if (!menuItem || !template) {
		return;
	}
	menuItem.addEventListener('click', () => {
		const body = template.content.firstElementChild.cloneNode(true);
		showForm({ body, buttons: ['OK'], defaultIndex: 0, cancelIndex: 0, className: 'gem-info-box' });
	});
}
