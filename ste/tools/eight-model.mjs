export const INITIAL_BALLS = [
	[16, 24, 3, 2], [80, 30, -2, 3], [144, 20, 4, -1], [238, 35, -3, 2],
	[34, 124, 2, -3], [108, 142, -4, -2], [180, 114, 1, 3], [268, 149, -3, -1]
];

export function advanceBalls(balls) {
	for (const ball of balls) for (let axis = 0; axis < 2; axis++) {
		const old = ball[axis], velocity = ball[axis + 2];
		ball[axis] += velocity;
		if (ball[axis] < (axis ? 1 : 0) || ball[axis] > (axis ? 168 : 288)) {
			ball[axis + 2] = -velocity;
			ball[axis] = old - velocity;
		}
	}
}

export function scatterBalls(balls, seed = 0xace1) {
	const random = () => seed = (seed >>> 1) ^ (seed & 1 ? 0xb400 : 0);
	for (const ball of balls) {
		ball[0] = random() % 289;
		ball[1] = 1 + random() % 168;
		ball[2] = (random() & 7) - 4 || 1;
		const value = random();
		ball[3] = ((value & 3) + 1) * (value & 8 ? -1 : 1);
	}
	return seed;
}
