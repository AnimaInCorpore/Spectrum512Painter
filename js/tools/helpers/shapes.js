import { drawLine, inBounds } from './pixels.js';

const TWO_PI = Math.PI * 2;

function roundPoint(point) {
	return {
		x: Math.round(point.x),
		y: Math.round(point.y)
	};
}

function drawPoint(canvas, x, y, drawAt) {
	if (inBounds(canvas, x, y)) {
		drawAt(x, y);
	}
}

function drawSegment(canvas, ctx, from, to, drawAt) {
	drawLine(canvas, ctx, from.x, from.y, to.x, to.y, drawAt);
}

function clampRoundedRadius(bounds, radius) {
	const maxRadiusX = Math.floor((bounds.width - 1) / 2);
	const maxRadiusY = Math.floor((bounds.height - 1) / 2);
	const maxRadius = Math.max(0, Math.min(maxRadiusX, maxRadiusY));
	return Math.max(0, Math.min(Math.round(radius), maxRadius));
}

function drawRoundedCorner(canvas, cx, cy, radius, corner, drawAt) {
	let x = radius;
	let y = 0;
	let error = 1 - radius;

	while (x >= y) {
		if (corner === 'top-left') {
			drawPoint(canvas, cx - x, cy - y, drawAt);
			drawPoint(canvas, cx - y, cy - x, drawAt);
		} else if (corner === 'top-right') {
			drawPoint(canvas, cx + x, cy - y, drawAt);
			drawPoint(canvas, cx + y, cy - x, drawAt);
		} else if (corner === 'bottom-left') {
			drawPoint(canvas, cx - x, cy + y, drawAt);
			drawPoint(canvas, cx - y, cy + x, drawAt);
		} else {
			drawPoint(canvas, cx + x, cy + y, drawAt);
			drawPoint(canvas, cx + y, cy + x, drawAt);
		}

		y += 1;
		if (error < 0) {
			error += 2 * y + 1;
		} else {
			x -= 1;
			error += 2 * (y - x) + 1;
		}
	}
}

function pointOnEllipse(center, radiusX, radiusY, angle) {
	return {
		x: Math.round(center.x + Math.cos(angle) * radiusX),
		y: Math.round(center.y + Math.sin(angle) * radiusY)
	};
}

function buildRegularPolygonVertices(bounds, sideCount) {
	const center = {
		x: (bounds.left + bounds.right) / 2,
		y: (bounds.top + bounds.bottom) / 2
	};
	const radiusX = (bounds.right - bounds.left) / 2;
	const radiusY = (bounds.bottom - bounds.top) / 2;
	const vertices = [];
	const angleStep = TWO_PI / sideCount;

	for (let i = 0; i < sideCount; i += 1) {
		const angle = -Math.PI / 2 + i * angleStep;
		vertices.push(pointOnEllipse(center, radiusX, radiusY, angle));
	}

	return vertices;
}

function drawEllipseArc(canvas, ctx, center, radiusX, radiusY, startAngle, endAngle, drawAt) {
	const sweep = endAngle - startAngle;
	const arcLength = Math.abs(sweep);
	if (arcLength === 0) {
		return;
	}

	const steps = Math.max(8, Math.ceil(arcLength * Math.max(1, radiusX, radiusY) * 1.5));
	let previous = pointOnEllipse(center, radiusX, radiusY, startAngle);

	for (let i = 1; i <= steps; i += 1) {
		const progress = i / steps;
		const angle = startAngle + sweep * progress;
		const current = pointOnEllipse(center, radiusX, radiusY, angle);
		drawSegment(canvas, ctx, previous, current, drawAt);
		previous = current;
	}
}

export function boundsFromPoints(start, end) {
	const from = roundPoint(start);
	const to = roundPoint(end);
	const left = Math.min(from.x, to.x);
	const right = Math.max(from.x, to.x);
	const top = Math.min(from.y, to.y);
	const bottom = Math.max(from.y, to.y);
	return {
		left,
		top,
		right,
		bottom,
		width: right - left + 1,
		height: bottom - top + 1
	};
}

export function drawRectangleOutline(canvas, ctx, start, end, drawAt) {
	const bounds = boundsFromPoints(start, end);
	const topLeft = { x: bounds.left, y: bounds.top };
	const topRight = { x: bounds.right, y: bounds.top };
	const bottomLeft = { x: bounds.left, y: bounds.bottom };
	const bottomRight = { x: bounds.right, y: bounds.bottom };

	drawSegment(canvas, ctx, topLeft, topRight, drawAt);
	if (bounds.bottom > bounds.top) {
		drawSegment(canvas, ctx, bottomLeft, bottomRight, drawAt);
	}
	if (bounds.right > bounds.left) {
		drawSegment(canvas, ctx, topLeft, bottomLeft, drawAt);
		drawSegment(canvas, ctx, topRight, bottomRight, drawAt);
	}
}

export function drawRoundedRectangleOutline(canvas, ctx, start, end, drawAt, { radius = 4 } = {}) {
	const bounds = boundsFromPoints(start, end);
	const roundedRadius = clampRoundedRadius(bounds, radius);

	if (roundedRadius <= 0) {
		drawRectangleOutline(canvas, ctx, start, end, drawAt);
		return;
	}

	const left = bounds.left;
	const right = bounds.right;
	const top = bounds.top;
	const bottom = bounds.bottom;
	const innerLeft = left + roundedRadius;
	const innerRight = right - roundedRadius;
	const innerTop = top + roundedRadius;
	const innerBottom = bottom - roundedRadius;

	if (innerLeft <= innerRight) {
		drawSegment(canvas, ctx, { x: innerLeft, y: top }, { x: innerRight, y: top }, drawAt);
		drawSegment(canvas, ctx, { x: innerLeft, y: bottom }, { x: innerRight, y: bottom }, drawAt);
	}
	if (innerTop <= innerBottom) {
		drawSegment(canvas, ctx, { x: left, y: innerTop }, { x: left, y: innerBottom }, drawAt);
		drawSegment(canvas, ctx, { x: right, y: innerTop }, { x: right, y: innerBottom }, drawAt);
	}

	drawRoundedCorner(canvas, innerLeft, innerTop, roundedRadius, 'top-left', drawAt);
	drawRoundedCorner(canvas, innerRight, innerTop, roundedRadius, 'top-right', drawAt);
	drawRoundedCorner(canvas, innerLeft, innerBottom, roundedRadius, 'bottom-left', drawAt);
	drawRoundedCorner(canvas, innerRight, innerBottom, roundedRadius, 'bottom-right', drawAt);
}

export function drawEllipseOutline(canvas, ctx, start, end, drawAt) {
	const bounds = boundsFromPoints(start, end);
	const center = {
		x: (bounds.left + bounds.right) / 2,
		y: (bounds.top + bounds.bottom) / 2
	};
	const radiusX = (bounds.right - bounds.left) / 2;
	const radiusY = (bounds.bottom - bounds.top) / 2;

	if (radiusX === 0 && radiusY === 0) {
		drawPoint(canvas, Math.round(center.x), Math.round(center.y), drawAt);
		return;
	}
	if (radiusX === 0) {
		drawSegment(
			canvas,
			ctx,
			{ x: Math.round(center.x), y: bounds.top },
			{ x: Math.round(center.x), y: bounds.bottom },
			drawAt
		);
		return;
	}
	if (radiusY === 0) {
		drawSegment(
			canvas,
			ctx,
			{ x: bounds.left, y: Math.round(center.y) },
			{ x: bounds.right, y: Math.round(center.y) },
			drawAt
		);
		return;
	}

	const steps = Math.max(16, Math.ceil(TWO_PI * Math.max(radiusX, radiusY)));
	let previous = pointOnEllipse(center, radiusX, radiusY, 0);
	for (let i = 1; i <= steps; i += 1) {
		const angle = (i / steps) * TWO_PI;
		const current = pointOnEllipse(center, radiusX, radiusY, angle);
		drawSegment(canvas, ctx, previous, current, drawAt);
		previous = current;
	}
}

export function drawRegularPolygonOutline(canvas, ctx, start, end, drawAt, { sides = 5 } = {}) {
	const safeSides = Math.max(3, Math.round(sides));
	const bounds = boundsFromPoints(start, end);
	const vertices = buildRegularPolygonVertices(bounds, safeSides);

	if (vertices.length === 0) {
		return;
	}
	if (vertices.length === 1) {
		drawPoint(canvas, vertices[0].x, vertices[0].y, drawAt);
		return;
	}

	for (let i = 0; i < vertices.length; i += 1) {
		const from = vertices[i];
		const to = vertices[(i + 1) % vertices.length];
		drawSegment(canvas, ctx, from, to, drawAt);
	}
}

export function drawPieSliceOutline(canvas, ctx, centerPoint, edgePoint, drawAt) {
	const center = roundPoint(centerPoint);
	const edge = roundPoint(edgePoint);
	const radiusX = Math.abs(edge.x - center.x);
	const radiusY = Math.abs(edge.y - center.y);

	if (radiusX === 0 && radiusY === 0) {
		drawPoint(canvas, center.x, center.y, drawAt);
		return;
	}

	const startAngle = 0;
	const endAngle = Math.atan2(edge.y - center.y, edge.x - center.x);
	const startEdge = pointOnEllipse(center, radiusX, radiusY, startAngle);
	const endEdge = pointOnEllipse(center, radiusX, radiusY, endAngle);

	drawSegment(canvas, ctx, center, startEdge, drawAt);
	drawEllipseArc(canvas, ctx, center, radiusX, radiusY, startAngle, endAngle, drawAt);
	drawSegment(canvas, ctx, center, endEdge, drawAt);
}

export function fillRectangle(canvas, start, end, drawAt) {
	const bounds = boundsFromPoints(start, end);
	for (let y = bounds.top; y <= bounds.bottom; y += 1) {
		for (let x = bounds.left; x <= bounds.right; x += 1) {
			drawPoint(canvas, x, y, drawAt);
		}
	}
}

export function fillEllipse(canvas, start, end, drawAt) {
	const bounds = boundsFromPoints(start, end);
	const centerX = (bounds.left + bounds.right) / 2;
	const centerY = (bounds.top + bounds.bottom) / 2;
	const radiusX = (bounds.right - bounds.left) / 2;
	const radiusY = (bounds.bottom - bounds.top) / 2;

	if (radiusX === 0 && radiusY === 0) {
		drawPoint(canvas, Math.round(centerX), Math.round(centerY), drawAt);
		return;
	}
	if (radiusX === 0) {
		for (let y = bounds.top; y <= bounds.bottom; y += 1) {
			drawPoint(canvas, Math.round(centerX), y, drawAt);
		}
		return;
	}
	if (radiusY === 0) {
		for (let x = bounds.left; x <= bounds.right; x += 1) {
			drawPoint(canvas, x, Math.round(centerY), drawAt);
		}
		return;
	}

	for (let y = bounds.top; y <= bounds.bottom; y += 1) {
		const ny = (y - centerY) / radiusY;
		const maxNx = Math.sqrt(Math.max(0, 1 - ny * ny));
		const minX = Math.ceil(centerX - radiusX * maxNx);
		const maxX = Math.floor(centerX + radiusX * maxNx);
		for (let x = minX; x <= maxX; x += 1) {
			drawPoint(canvas, x, y, drawAt);
		}
	}
}

function isInsideRoundedRectPixel(x, y, bounds, radius) {
	const left = bounds.left;
	const right = bounds.right;
	const top = bounds.top;
	const bottom = bounds.bottom;
	const innerLeft = left + radius;
	const innerRight = right - radius;
	const innerTop = top + radius;
	const innerBottom = bottom - radius;

	if (x >= innerLeft && x <= innerRight) {
		return true;
	}
	if (y >= innerTop && y <= innerBottom) {
		return true;
	}

	const cornerX = x < innerLeft ? innerLeft : innerRight;
	const cornerY = y < innerTop ? innerTop : innerBottom;
	const dx = x - cornerX;
	const dy = y - cornerY;
	return dx * dx + dy * dy <= radius * radius;
}

export function fillRoundedRectangle(canvas, start, end, drawAt, { radius = 4 } = {}) {
	const bounds = boundsFromPoints(start, end);
	const roundedRadius = clampRoundedRadius(bounds, radius);
	if (roundedRadius <= 0) {
		fillRectangle(canvas, start, end, drawAt);
		return;
	}

	for (let y = bounds.top; y <= bounds.bottom; y += 1) {
		for (let x = bounds.left; x <= bounds.right; x += 1) {
			if (isInsideRoundedRectPixel(x, y, bounds, roundedRadius)) {
				drawPoint(canvas, x, y, drawAt);
			}
		}
	}
}
