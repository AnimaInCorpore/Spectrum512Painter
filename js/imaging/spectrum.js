export const SPECTRUM_CANVAS_WIDTH = 320;
export const SPECTRUM_CANVAS_HEIGHT = 200;

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function getSourceSize(source) {
	if (!source) {
		return { width: 0, height: 0 };
	}
	return {
		width: source.naturalWidth || source.width || 0,
		height: source.naturalHeight || source.height || 0
	};
}

function getSpectrumCropRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
	const normalizedSourceWidth = Math.max(1, sourceWidth);
	const normalizedSourceHeight = Math.max(1, sourceHeight);
	const targetRatio = targetWidth / targetHeight;
	const sourceRatio = normalizedSourceWidth / normalizedSourceHeight;

	let cropWidth = normalizedSourceWidth;
	let cropHeight = normalizedSourceHeight;
	let cropX = 0;
	let cropY = 0;

	if (sourceRatio >= targetRatio) {
		cropHeight = normalizedSourceHeight;
		cropWidth = cropHeight * targetRatio;
		cropX = (normalizedSourceWidth - cropWidth) / 2;
	} else {
		cropWidth = normalizedSourceWidth;
		cropHeight = cropWidth / targetRatio;
		cropY = (normalizedSourceHeight - cropHeight) / 2;
	}

	cropWidth = clamp(cropWidth, 1, normalizedSourceWidth);
	cropHeight = clamp(cropHeight, 1, normalizedSourceHeight);
	cropX = clamp(cropX, 0, normalizedSourceWidth - cropWidth);
	cropY = clamp(cropY, 0, normalizedSourceHeight - cropHeight);

	return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}

function createCanvas(width, height) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.floor(width));
	canvas.height = Math.max(1, Math.floor(height));
	return canvas;
}

function configureSmoothing(context) {
	context.imageSmoothingEnabled = true;
}

function drawMultiStageResize(source, crop, targetWidth, targetHeight) {
	const work1Canvas = createCanvas(targetWidth * 4 + 1, targetHeight * 4 + 1);
	const work2Canvas = createCanvas(targetWidth * 2, targetHeight * 2);
	const result = createCanvas(targetWidth, targetHeight);

	const work1Context = work1Canvas.getContext('2d');
	const work2Context = work2Canvas.getContext('2d');
	const resultContext = result.getContext('2d');

	configureSmoothing(work1Context);
	configureSmoothing(work2Context);
	configureSmoothing(resultContext);

	work1Context.drawImage(
		source,
		crop.x,
		crop.y,
		crop.width,
		crop.height,
		0,
		0,
		work1Canvas.width,
		work1Canvas.height
	);
	work2Context.drawImage(
		work1Canvas,
		0,
		0,
		work1Canvas.width,
		work1Canvas.height,
		0,
		0,
		work2Canvas.width,
		work2Canvas.height
	);
	resultContext.drawImage(
		work2Canvas,
		0,
		0,
		work2Canvas.width,
		work2Canvas.height,
		0,
		0,
		result.width,
		result.height
	);

	return result;
}

export function createSpectrumCanvas(source, options = {}) {
	const targetWidth = Math.max(1, options.width || SPECTRUM_CANVAS_WIDTH);
	const targetHeight = Math.max(1, options.height || SPECTRUM_CANVAS_HEIGHT);
	const sourceSize = getSourceSize(source);
	const crop = getSpectrumCropRect(
		sourceSize.width,
		sourceSize.height,
		targetWidth,
		targetHeight
	);

	return drawMultiStageResize(source, crop, targetWidth, targetHeight);
}
