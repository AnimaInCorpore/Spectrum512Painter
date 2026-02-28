import { createEraserTool } from './implementations/eraser.js';
import { createEllipseTool } from './implementations/ellipse.js';
import { createFaucetTool } from './implementations/faucet.js';
import { createFillTool } from './implementations/fill.js';
import { createLineTool } from './implementations/line.js';
import { createNoopTool } from './implementations/noop.js';
import { createPencilTool } from './implementations/pencil.js';
import { createPieSliceTool } from './implementations/pie-slice.js';
import { createPolygonTool } from './implementations/polygon.js';
import { createRectangleTool } from './implementations/rectangle.js';
import { createRoundedRectangleTool } from './implementations/rounded-rectangle.js';
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
		faucet: createFaucetTool(),
		rectangle: createRectangleTool(),
		'rounded-rectangle': createRoundedRectangleTool(),
		polygon: createPolygonTool(),
		'pie-slice': createPieSliceTool(),
		ellipse: createEllipseTool(),
		zoom: noop,
		marquee: noop,
		text: noop
	};
}
