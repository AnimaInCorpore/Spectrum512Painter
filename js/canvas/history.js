function normalizeMaxEntries(value) {
	const rounded = Number.isFinite(value) ? Math.round(value) : 32;
	return Math.max(1, rounded);
}

function clonePixels(pixels) {
	if (!(pixels instanceof Uint8ClampedArray)) {
		return null;
	}
	return new Uint8ClampedArray(pixels);
}

function cloneBitmapState(state) {
	if (!state || !Number.isFinite(state.width) || !Number.isFinite(state.height)) {
		return null;
	}
	const pixels = clonePixels(state.pixels);
	if (!pixels) {
		return null;
	}
	return {
		width: Math.max(1, Math.round(state.width)),
		height: Math.max(1, Math.round(state.height)),
		pixels
	};
}

function bitmapStatesEqual(left, right) {
	if (!left || !right) {
		return false;
	}
	if (left.width !== right.width || left.height !== right.height) {
		return false;
	}
	if (!left.pixels || !right.pixels || left.pixels.length !== right.pixels.length) {
		return false;
	}
	for (let i = 0; i < left.pixels.length; i += 1) {
		if (left.pixels[i] !== right.pixels[i]) {
			return false;
		}
	}
	return true;
}

function buildSnapshot(undoStack, redoStack) {
	return {
		canUndo: undoStack.length > 0,
		canRedo: redoStack.length > 0,
		undoCount: undoStack.length,
		redoCount: redoStack.length
	};
}

export function createHistoryManager({
	maxEntries = 32,
	captureState,
	applyState,
	onChange
} = {}) {
	const historyLimit = normalizeMaxEntries(maxEntries);
	let undoStack = [];
	let redoStack = [];
	let transactionStart = null;

	const emitChange = () => {
		if (typeof onChange !== 'function') {
			return;
		}
		onChange(buildSnapshot(undoStack, redoStack));
	};

	const beginTransaction = () => {
		if (typeof captureState !== 'function') {
			transactionStart = null;
			return;
		}
		transactionStart = cloneBitmapState(captureState());
	};

	const endTransaction = () => {
		if (!transactionStart || typeof captureState !== 'function') {
			transactionStart = null;
			return { committed: false, afterState: null };
		}

		const before = transactionStart;
		const after = cloneBitmapState(captureState());
		transactionStart = null;

		if (!after || bitmapStatesEqual(before, after)) {
			return { committed: false, afterState: after };
		}

		undoStack.push({ before, after });
		if (undoStack.length > historyLimit) {
			undoStack = undoStack.slice(undoStack.length - historyLimit);
		}
		redoStack = [];
		emitChange();
		return { committed: true, afterState: after };
	};

	const cancelTransaction = () => {
		transactionStart = null;
	};

	const clear = () => {
		undoStack = [];
		redoStack = [];
		transactionStart = null;
		emitChange();
	};

	const undo = () => {
		if (undoStack.length === 0 || typeof applyState !== 'function') {
			return false;
		}
		const entry = undoStack.pop();
		applyState(entry.before);
		redoStack.push(entry);
		transactionStart = null;
		emitChange();
		return true;
	};

	const redo = () => {
		if (redoStack.length === 0 || typeof applyState !== 'function') {
			return false;
		}
		const entry = redoStack.pop();
		applyState(entry.after);
		undoStack.push(entry);
		transactionStart = null;
		emitChange();
		return true;
	};

	emitChange();

	return {
		beginTransaction,
		endTransaction,
		cancelTransaction,
		clear,
		undo,
		redo,
		canUndo() {
			return undoStack.length > 0;
		},
		canRedo() {
			return redoStack.length > 0;
		},
		getSnapshot() {
			return buildSnapshot(undoStack, redoStack);
		}
	};
}
