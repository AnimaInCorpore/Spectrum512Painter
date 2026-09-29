// GEM-style modal alert with OK (default, Enter) and Cancel (Esc).
export function initAlertDialog() {
	const overlay = document.getElementById('alert-overlay');
	const message = document.getElementById('alert-message');
	const okButton = document.getElementById('alert-ok');
	const cancelButton = document.getElementById('alert-cancel');
	let pending = null;

	const finish = result => {
		overlay.classList.remove('open');
		const resolve = pending;
		pending = null;
		if (resolve) {
			resolve(result);
		}
	};

	okButton.addEventListener('click', () => finish(true));
	cancelButton.addEventListener('click', () => finish(false));
	document.addEventListener('keydown', event => {
		if (!pending) {
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			finish(true);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			finish(false);
		}
	}, true);

	return function confirmAlert(text) {
		if (pending) {
			finish(false);
		}
		message.textContent = text;
		overlay.classList.add('open');
		okButton.focus();
		return new Promise(resolve => {
			pending = resolve;
		});
	};
}
