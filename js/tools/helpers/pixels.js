function toIndex(width, x, y) {
	return (y * width + x) * 4;
}

export function inBounds(canvas, x, y) {
	return x >= 0 && y >= 0 && x < canvas.width && y < canvas.height;
}

export function readPixel(ctx, x, y) {
	const imageData = ctx.getImageData(x, y, 1, 1);
	return imageData.data;
}

export function writePixel(ctx, x, y, r, g, b, a = 255) {
	const imageData = ctx.createImageData(1, 1);
	imageData.data[0] = r;
	imageData.data[1] = g;
	imageData.data[2] = b;
	imageData.data[3] = a;
	ctx.putImageData(imageData, x, y);
}

export function drawLine(canvas, ctx, x0, y0, x1, y1, drawAt) {
	let px0 = Math.round(x0);
	let py0 = Math.round(y0);
	const px1 = Math.round(x1);
	const py1 = Math.round(y1);

	const dx = Math.abs(px1 - px0);
	const sx = px0 < px1 ? 1 : -1;
	const dy = -Math.abs(py1 - py0);
	const sy = py0 < py1 ? 1 : -1;
	let error = dx + dy;

	while (true) {
		if (inBounds(canvas, px0, py0)) {
			drawAt(px0, py0);
		}
		if (px0 === px1 && py0 === py1) {
			break;
		}
		const doubledError = 2 * error;
		if (doubledError >= dy) {
			error += dy;
			px0 += sx;
		}
		if (doubledError <= dx) {
			error += dx;
			py0 += sy;
		}
	}
}

export function floodFill(canvas, ctx, startX, startY, replacement) {
	const x = Math.round(startX);
	const y = Math.round(startY);
	if (!inBounds(canvas, x, y)) {
		return;
	}

	const width = canvas.width;
	const height = canvas.height;
	const imageData = ctx.getImageData(0, 0, width, height);
	const data = imageData.data;

	const startIndex = toIndex(width, x, y);
	const source = [
		data[startIndex],
		data[startIndex + 1],
		data[startIndex + 2],
		data[startIndex + 3]
	];

	if (
		source[0] === replacement[0] &&
		source[1] === replacement[1] &&
		source[2] === replacement[2] &&
		source[3] === replacement[3]
	) {
		return;
	}

	const stack = [[x, y]];
	while (stack.length > 0) {
		const [cx, cy] = stack.pop();
		if (!inBounds(canvas, cx, cy)) {
			continue;
		}
		const idx = toIndex(width, cx, cy);
		if (
			data[idx] !== source[0] ||
			data[idx + 1] !== source[1] ||
			data[idx + 2] !== source[2] ||
			data[idx + 3] !== source[3]
		) {
			continue;
		}

		data[idx] = replacement[0];
		data[idx + 1] = replacement[1];
		data[idx + 2] = replacement[2];
		data[idx + 3] = replacement[3];

		stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
	}

	ctx.putImageData(imageData, 0, 0);
}
