function setMenuEntryEnabled(entry, enabled) {
	if (!entry) {
		return;
	}
	entry.classList.toggle('disabled', !enabled);
	entry.setAttribute('aria-disabled', String(!enabled));
}

function isTextEditingTarget(target) {
	if (!target || typeof target !== 'object') {
		return false;
	}
	const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
	if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
		return true;
	}
	return Boolean(target.isContentEditable);
}

function hasUndoModifier(event) {
	return Boolean(event && (event.ctrlKey || event.metaKey)) && !event.altKey;
}

function normalizeKey(event) {
	return (event && typeof event.key === 'string' ? event.key : '').toLowerCase();
}

function isUndoShortcut(event) {
	return hasUndoModifier(event) && normalizeKey(event) === 'z' && !event.shiftKey;
}

function isRedoShortcut(event) {
	if (!hasUndoModifier(event)) {
		return false;
	}
	const key = normalizeKey(event);
	if (key === 'z' && event.shiftKey) {
		return true;
	}
	return key === 'y' && !event.shiftKey;
}

export function initUndoRedoControls({
	undoMenuItem,
	redoMenuItem,
	onUndo,
	onRedo,
	canUndo,
	canRedo
}) {
	const refresh = () => {
		const undoEnabled = typeof canUndo === 'function' ? Boolean(canUndo()) : false;
		const redoEnabled = typeof canRedo === 'function' ? Boolean(canRedo()) : false;
		setMenuEntryEnabled(undoMenuItem, undoEnabled);
		setMenuEntryEnabled(redoMenuItem, redoEnabled);
	};

	const tryUndo = () => {
		if (typeof onUndo !== 'function') {
			return;
		}
		onUndo();
	};

	const tryRedo = () => {
		if (typeof onRedo !== 'function') {
			return;
		}
		onRedo();
	};

	if (undoMenuItem) {
		undoMenuItem.addEventListener('click', () => {
			if (undoMenuItem.classList.contains('disabled')) {
				return;
			}
			tryUndo();
		});
	}

	if (redoMenuItem) {
		redoMenuItem.addEventListener('click', () => {
			if (redoMenuItem.classList.contains('disabled')) {
				return;
			}
			tryRedo();
		});
	}

	const onKeyDown = event => {
		if (event.defaultPrevented || isTextEditingTarget(event.target)) {
			return;
		}
		if (isUndoShortcut(event)) {
			event.preventDefault();
			tryUndo();
			return;
		}
		if (isRedoShortcut(event)) {
			event.preventDefault();
			tryRedo();
		}
	};

	document.addEventListener('keydown', onKeyDown);
	refresh();

	return {
		refresh,
		dispose() {
			document.removeEventListener('keydown', onKeyDown);
		}
	};
}
