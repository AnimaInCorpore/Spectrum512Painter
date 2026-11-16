// Control-key shortcuts for menu commands, shown as "^O" style in the menus like GEM Draw.

function isTextEditingTarget(target) {
	if (!target) {
		return false;
	}
	const tagName = target.tagName ? target.tagName.toLowerCase() : '';
	return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || Boolean(target.isContentEditable);
}

/**
 * @param {Array<{ key: string, entry: HTMLElement }>} bindings Ctrl/Cmd + key activates the entry.
 */
export function initMenuShortcuts(bindings) {
	const byKey = new Map(bindings.filter(binding => binding.entry).map(binding => [binding.key.toLowerCase(), binding.entry]));

	document.addEventListener('keydown', event => {
		if (event.defaultPrevented || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey)) {
			return;
		}
		if (isTextEditingTarget(event.target)) {
			return;
		}
		const entry = byKey.get((event.key || '').toLowerCase());
		if (!entry) {
			return;
		}
		event.preventDefault();
		if (!entry.classList.contains('disabled')) {
			entry.click();
		}
	});
}
