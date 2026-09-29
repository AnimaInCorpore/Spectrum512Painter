export function initGemMenus({ menuRoot, menuSelector = '.gem-menu', menuEntrySelector = '.gem-menu-entry' }) {
	if (!menuRoot) {
		return { closeMenus: () => {} };
	}

	const menus = Array.from(menuRoot.querySelectorAll(menuSelector));
	let openMenu = null;

	const closeMenus = () => {
		menus.forEach(menu => menu.classList.remove('open'));
		openMenu = null;
	};

	const openMenuPanel = menu => {
		if (openMenu === menu) {
			return;
		}
		closeMenus();
		menu.classList.add('open');
		openMenu = menu;
	};

	menus.forEach(menu => {
		const trigger = menu.querySelector('.gem-menubar-item');
		if (!trigger) {
			return;
		}

		trigger.addEventListener('click', event => {
			event.stopPropagation();
			openMenuPanel(menu);
		});

		menu.addEventListener('mouseenter', () => openMenuPanel(menu));
	});

	// GEM drops menus on mouse-over; leaving the bar closes them.
	menuRoot.addEventListener('mouseleave', closeMenus);

	document.querySelectorAll(menuEntrySelector).forEach(entry => {
		entry.addEventListener('click', event => {
			event.stopPropagation();
			if (entry.classList.contains('disabled')) {
				return;
			}
			closeMenus();
		});
	});

	document.addEventListener('click', event => {
		if (!menuRoot.contains(event.target)) {
			closeMenus();
		}
	});

	document.addEventListener('keydown', event => {
		if (event.key === 'Escape') {
			closeMenus();
		}
	});

	return { closeMenus };
}
