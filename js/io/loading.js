export function setupFileLoading({ fileInput, openMenuItem, onImageLoaded }) {
	if (!fileInput || !openMenuItem || typeof onImageLoaded !== 'function') {
		return;
	}

	openMenuItem.addEventListener('click', () => {
		fileInput.click();
	});

	fileInput.addEventListener('change', function() {
		const file = fileInput.files && fileInput.files[0];
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = event => {
			const image = new Image();
			image.onload = () => {
				onImageLoaded({ image, fileName: file.name });
			};
			image.src = event.target.result;
		};
		reader.readAsDataURL(file);
		fileInput.value = '';
	});
}
