function normalizeFileName(fileName) {
	if (!fileName || !fileName.trim()) {
		return 'UNTITLED';
	}
	return fileName.trim().toUpperCase();
}

function getImageDimensions(source) {
	if (!source) {
		return { width: 0, height: 0 };
	}
	return {
		width: source.naturalWidth || source.width || 0,
		height: source.naturalHeight || source.height || 0
	};
}

export function createCanvasDocument({ canvas, titleElement }) {
	const context = canvas.getContext('2d');
	let currentFileName = 'UNTITLED';

	const setTitle = fileName => {
		currentFileName = normalizeFileName(fileName);
		if (titleElement) {
			titleElement.textContent = currentFileName;
		}
	};

	const fillWhite = () => {
		context.fillStyle = '#ffffff';
		context.fillRect(0, 0, canvas.width, canvas.height);
	};

	const setImage = ({ image, fileName }) => {
		const { width: imageWidth, height: imageHeight } = getImageDimensions(image);
		const targetWidth = Math.max(1, imageWidth || canvas.width);
		const targetHeight = Math.max(1, imageHeight || canvas.height);
		canvas.width = targetWidth;
		canvas.height = targetHeight;
		context.drawImage(image, 0, 0, targetWidth, targetHeight);
		setTitle(fileName);
	};

	const setPixelBuffer = ({ width, height, pixels, fileName }) => {
		canvas.width = width;
		canvas.height = height;
		const imageData = new ImageData(pixels, width, height);
		context.putImageData(imageData, 0, 0);
		setTitle(fileName);
	};

	const getDownloadBaseName = () => {
		const withoutExtension = currentFileName.replace(/\.[A-Z0-9]+$/, '');
		return withoutExtension || 'UNTITLED';
	};

	fillWhite();
	setTitle('UNTITLED');

	return {
		canvas,
		context,
		fillWhite,
		setImage,
		setPixelBuffer,
		setTitle,
		getDownloadBaseName
	};
}
