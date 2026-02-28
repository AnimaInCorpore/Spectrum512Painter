export function canvasPointFromMouse(event, canvas) {
	const rect = canvas.getBoundingClientRect();
	const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
	const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
	return {
		x: Math.floor((event.clientX - rect.left) * scaleX),
		y: Math.floor((event.clientY - rect.top) * scaleY)
	};
}

export function constrainToLine(start, end) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);

	// Snap to horizontal, vertical, or diagonal.
	if (absDx > absDy * 2) {
		return { x: end.x, y: start.y };
	}
	if (absDy > absDx * 2) {
		return { x: start.x, y: end.y };
	}
	const length = Math.max(absDx, absDy);
	return {
		x: start.x + Math.sign(dx || 1) * length,
		y: start.y + Math.sign(dy || 1) * length
	};
}

export function constrainTo45Deg(start, end) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const angle = Math.atan2(dy, dx);
	const step = Math.PI / 4;
	const snapped = Math.round(angle / step) * step;
	const length = Math.sqrt(dx * dx + dy * dy);
	return {
		x: Math.round(start.x + Math.cos(snapped) * length),
		y: Math.round(start.y + Math.sin(snapped) * length)
	};
}

export function constrainToSquare(start, end) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const size = Math.max(Math.abs(dx), Math.abs(dy));
	const signX = dx < 0 ? -1 : 1;
	const signY = dy < 0 ? -1 : 1;
	return {
		x: start.x + signX * size,
		y: start.y + signY * size
	};
}

export function hasMeaningfulDelta(start, end) {
	if (!start || !end) {
		return false;
	}
	return start.x !== end.x || start.y !== end.y;
}
