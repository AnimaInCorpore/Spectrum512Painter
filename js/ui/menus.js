import { CHECK_MARK } from '../config/gem-icons.js';
import { bitmapToDataUrl } from './bitmap-icons.js';

// GEM drop-down menus: a menu drops down as soon as the pointer touches its title,
// another title takes over while one is open, and the menu stays down until a command
// is chosen or the user clicks somewhere else. That outside click only closes the menu;
// it never reaches the canvas or other controls underneath.

function installCheckMarkBitmap() {
	document.documentElement.style.setProperty('--gem-check-mark', `url(${bitmapToDataUrl(CHECK_MARK, { transparentPaper: true })})`);
}

export function setMenuEntryChecked(entry, checked) {
	if (!entry) {
		return;
	}
	entry.classList.toggle('checked', Boolean(checked));
	entry.setAttribute('aria-checked', String(Boolean(checked)));
}

export function setMenuEntryEnabled(entry, enabled) {
	if (!entry) {
		return;
	}
	entry.classList.toggle('disabled', !enabled);
	entry.setAttribute('aria-disabled', String(!enabled));
}

export function setMenuEntryLabel(entry, label) {
	if (!entry) {
		return;
	}
	const labelElement = entry.querySelector('.gem-menu-label');
	(labelElement || entry).textContent = label;
}

function swallowNextClick() {
	const swallow = event => {
		event.stopPropagation();
		event.preventDefault();
	};
	window.addEventListener('click', swallow, { capture: true, once: true });
	// A click is only generated if the button is released over the same element; make
	// sure the swallow handler never outlives the gesture that installed it.
	window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 600);
}

export function initGemMenus({ menuRoot, menuSelector = '.gem-menu', menuEntrySelector = '.gem-menu-entry' }) {
	if (!menuRoot) {
		return { closeMenus: () => {} };
	}

	installCheckMarkBitmap();

	const menus = Array.from(menuRoot.querySelectorAll(menuSelector));
	let openMenu = null;

	const closeMenus = () => {
		menus.forEach(menu => menu.classList.remove('open'));
		openMenu = null;
	};

	// Keeps a drop-down on screen when its title sits near the right edge.
	const fitDropdown = menu => {
		const dropdown = menu.querySelector('.gem-dropdown');
		if (!dropdown) {
			return;
		}
		dropdown.style.left = '';
		const overflow = dropdown.getBoundingClientRect().right - document.documentElement.clientWidth;
		if (overflow > 0) {
			dropdown.style.left = `${-Math.ceil(overflow)}px`;
		}
	};

	const openMenuPanel = menu => {
		if (openMenu === menu) {
			return;
		}
		closeMenus();
		menu.classList.add('open');
		openMenu = menu;
		fitDropdown(menu);
	};

	menus.forEach(menu => {
		const trigger = menu.querySelector('.gem-menubar-item');
		if (!trigger) {
			return;
		}
		trigger.addEventListener('pointerenter', event => {
			if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
				openMenuPanel(menu);
			}
		});
		// Touch screens have no hover, so a tap on the title opens it instead.
		trigger.addEventListener('click', event => {
			event.stopPropagation();
			openMenuPanel(menu);
		});
	});

	menuRoot.addEventListener('click', event => {
		const entry = event.target.closest(menuEntrySelector);
		if (!entry || !menuRoot.contains(entry)) {
			return;
		}
		event.stopPropagation();
		if (entry.classList.contains('disabled')) {
			return;
		}
		closeMenus();
	});

	window.addEventListener('mousedown', event => {
		if (!openMenu || menuRoot.contains(event.target)) {
			return;
		}
		closeMenus();
		event.preventDefault();
		event.stopPropagation();
		swallowNextClick();
	}, true);

	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && openMenu) {
			closeMenus();
		}
	});

	return { closeMenus };
}
