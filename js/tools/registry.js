import { createEraserTool } from './implementations/eraser.js';
import { createFillTool } from './implementations/fill.js';
import { createLineTool } from './implementations/line.js';
import { createNoopTool } from './implementations/noop.js';
import { createPencilTool } from './implementations/pencil.js';
import { createSprayTool } from './implementations/spray.js';

export function createToolRegistry() {
	const noop = createNoopTool();

	return {
		pencil: createPencilTool(),
		freehand: createPencilTool(),
		eraser: createEraserTool(),
		line: createLineTool(),
		fill: createFillTool(),
		spray: createSprayTool(),
		zoom: noop,
		marquee: noop,
		text: noop,
		faucet: noop,
		rectangle: noop,
		'rounded-rectangle': noop,
		polygon: noop,
		'pie-slice': noop,
		ellipse: noop
	};
}
