export function createNoopTool() {
	return {
		onPointerDown() {
			return null;
		},
		onPointerMove() {},
		onPointerUp() {}
	};
}
