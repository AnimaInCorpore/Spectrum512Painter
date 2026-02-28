var rgbToLabTable = {};

export function GetColors(Canvas)
{
	var Context = Canvas.getContext("2d");
	var Data = Context.getImageData(0, 0, Canvas.width, Canvas.height);
	var ColorCube = new Uint32Array(256 * 256 * 256);
	var Colors = [];
	
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * Canvas.width) * 4;

			var Red = Data.data[PixelIndex];
			var Green = Data.data[PixelIndex + 1];
			var Blue = Data.data[PixelIndex + 2];
			var Alpha = Data.data[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				if(ColorCube[Red * 256 * 256 + Green * 256 + Blue] == 0)
					Colors.push({ Red: Red, Green: Green, Blue: Blue });
				
				ColorCube[Red * 256 * 256 + Green * 256 + Blue]++;
			}
		}
	}
	
	Colors.sort(function (Color1, Color2) { return (SrgbToRgb(Color1.Red) * 0.21 + SrgbToRgb(Color1.Green) * 0.72 + SrgbToRgb(Color1.Blue) * 0.07) - (SrgbToRgb(Color2.Red) * 0.21 + SrgbToRgb(Color2.Green) * 0.72 + SrgbToRgb(Color2.Blue) * 0.07) });
	
	return Colors;
}


export function TrimColorCube(ColorCube, ColorCubeInfo)
{
	var RedMin = 255;
	var RedMax = 0;
	
	var GreenMin = 255;
	var GreenMax = 0;
	
	var BlueMin = 255;
	var BlueMax = 0;
	
	var RedCounts = new Uint32Array(256);
	var GreenCounts = new Uint32Array(256);
	var BlueCounts = new Uint32Array(256);
	
	var TotalColorCount = 0;
	
	var AverageRed = 0;
	var AverageGreen = 0;
	var AverageBlue = 0;
	
	for(var Red = ColorCubeInfo.RedMin; Red <= ColorCubeInfo.RedMax; Red++)
	{
		for(var Green = ColorCubeInfo.GreenMin; Green <= ColorCubeInfo.GreenMax; Green++)
		{
			for(var Blue = ColorCubeInfo.BlueMin; Blue <= ColorCubeInfo.BlueMax; Blue++)
			{
				var ColorCount = ColorCube[Red * 256 * 256 + Green * 256 + Blue]; 
				
				if(ColorCount != 0)
				{
					RedCounts[Red] += ColorCount;
					GreenCounts[Green] += ColorCount;
					BlueCounts[Blue] += ColorCount;
					
					if(Red < RedMin)
						RedMin = Red;

					if(Red > RedMax)
						RedMax = Red;

					if(Green < GreenMin)
						GreenMin = Green;

					if(Green > GreenMax)
						GreenMax = Green;
					
					if(Blue < BlueMin)
						BlueMin = Blue;

					if(Blue > BlueMax)
						BlueMax = Blue;
					
					AverageRed += Red * ColorCount;
					AverageGreen += Green * ColorCount;
					AverageBlue += Blue * ColorCount;
					
					TotalColorCount += ColorCount;
				}
			}
		}
	}
	
	AverageRed = Math.round(AverageRed / TotalColorCount);
	AverageGreen = Math.round(AverageGreen / TotalColorCount);
	AverageBlue = Math.round(AverageBlue / TotalColorCount);
	
	return { RedMin: RedMin, RedMax: RedMax, GreenMin: GreenMin, GreenMax: GreenMax, BlueMin: BlueMin, BlueMax: BlueMax, RedCounts: RedCounts, GreenCounts: GreenCounts, BlueCounts: BlueCounts, Red: AverageRed, Green: AverageGreen, Blue: AverageBlue, ColorCount: TotalColorCount };
}


export function RgbToSrgb(ColorChannel)
{
	return Math.pow(ColorChannel / 255, 1 / 2.2) * 255;
}


export function SrgbToRgb(ColorChannel)
{
	return Math.pow(ColorChannel / 255, 2.2) * 255;
}


export function ColorDistance(RedDelta, GreenDelta, BlueDelta, LuminanceDelta)
{
	return RedDelta * RedDelta + GreenDelta * GreenDelta + BlueDelta * BlueDelta + LuminanceDelta * LuminanceDelta * 6;
	//return RedDelta * RedDelta * 0.3 + GreenDelta * GreenDelta * 0.6 + BlueDelta * BlueDelta * 0.1 + LuminanceDelta * LuminanceDelta * 2; 
	//return RedDelta * RedDelta * 0.3 + GreenDelta * GreenDelta * 0.5 + BlueDelta * BlueDelta * 0.2 + LuminanceDelta * LuminanceDelta * 5;
	
	//return RedDelta * RedDelta * 0.21 + GreenDelta * GreenDelta * 0.72 + BlueDelta * BlueDelta * 0.07 + LuminanceDelta * LuminanceDelta;
}


export function rgb2lab(rgb) {
	let id = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

	if(rgbToLabTable[id]) {
		return rgbToLabTable[id];
	}

	var r = rgb[0] / 255,
		g = rgb[1] / 255,
		b = rgb[2] / 255,
		x, y, z;

	r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
	g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
	b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

	x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
	y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
	z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

	x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
	y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
	z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

	let lab = rgbToLabTable[id] = [ (116 * y) - 16, 500 * (x - y), 200 * (y - z) ];

	return lab;
}

// calculate the perceptual distance between colors in CIELAB
// https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs


export function deltaE(labA, labB) {
	var deltaL = labA[0] - labB[0];
	var deltaA = labA[1] - labB[1];
	var deltaB = labA[2] - labB[2];
	var c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
	var c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
	var deltaC = c1 - c2;
	var deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
	deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
	var sc = 1.0 + 0.045 * c1;
	var sh = 1.0 + 0.015 * c1;
	var deltaLKlsl = deltaL / (0.3);
	var deltaCkcsc = deltaC / (sc);
	var deltaHkhsh = deltaH / (sh);
	var i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
	return i < 0 ? 0 : i;
}

Math.rad2deg = function (rad) {
	return 360 * rad / (2 * Math.PI);
};

Math.deg2rad = function (deg) {
	return (2 * Math.PI * deg) / 360;
};


export function deltaE00(labA, labB) {
	let l1 = labA[0];
	let a1 = labA[1];
	let b1 = labA[2];

	let l2 = labB[0];
	let a2 = labB[1];
	let b2 = labB[2];

	// Start Equation
	// Equation exist on the following URL http://www.brucelindbloom.com/index.html?Eqn_DeltaE_CIE2000.html
	const avgL = (l1 + l2) / 2;
	const C1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2));
	const C2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2));
	const avgC = (C1 + C2) / 2;
	const G = (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7)))) / 2;

	const A1p = a1 * (1 + G);
	const A2p = a2 * (1 + G);

	const C1p = Math.sqrt(Math.pow(A1p, 2) + Math.pow(b1, 2));
	const C2p = Math.sqrt(Math.pow(A2p, 2) + Math.pow(b2, 2));

	const avgCp = (C1p + C2p) / 2;

	let h1p = Math.rad2deg(Math.atan2(b1, A1p));
	if (h1p < 0) {
		h1p = h1p + 360;
	}

	let h2p = Math.rad2deg(Math.atan2(b2, A2p));
	if (h2p < 0) {
		h2p = h2p + 360;
	}

	const avghp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h1p) / 2;

	const T = 1 - 0.17 * Math.cos(Math.deg2rad(avghp - 30)) + 0.24 * Math.cos(Math.deg2rad(2 * avghp)) + 0.32 * Math.cos(Math.deg2rad(3 * avghp + 6)) - 0.2 * Math.cos(Math.deg2rad(4 * avghp - 63));

	let deltahp = h2p - h1p;
	if (Math.abs(deltahp) > 180) {
		if (h2p <= h1p) {
			deltahp += 360;
		} else {
			deltahp -= 360;
		}
	}

	const delta_lp = l2 - l1;
	const delta_cp = C2p - C1p;

	deltahp = 2 * Math.sqrt(C1p * C2p) * Math.sin(Math.deg2rad(deltahp) / 2);

	const Sl = 1 + ((0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2)));
	const Sc = 1 + 0.045 * avgCp;
	const Sh = 1 + 0.015 * avgCp * T;

	const deltaro = 30 * Math.exp(-(Math.pow((avghp - 275) / 25, 2)));
	const Rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
	const Rt = -Rc * Math.sin(2 * Math.deg2rad(deltaro));

	const kl = 1;
	const kc = 1;
	const kh = 1;

	const deltaE = Math.sqrt(Math.pow(delta_lp / (kl * Sl), 2) + Math.pow(delta_cp / (kc * Sc), 2) + Math.pow(deltahp / (kh * Sh), 2) + Rt * (delta_cp / (kc * Sc)) * (deltahp / (kh * Sh)));

	return deltaE;
}


export function Distance4(labColor1, labColor2) {
	return (
		Math.pow(Math.abs(labColor1[0] - labColor2[0]), 2) * 40 + 
		Math.pow(labColor1[1] - labColor2[1], 2) + 
		Math.pow(labColor1[2] - labColor2[2], 2));
}


export function Distance5(labColor1, labColor2) {
	return (
		Math.pow(Math.abs(labColor1[0] - labColor2[0]), 2) * 32 + 
		Math.pow(Math.pow(labColor1[1] - labColor2[1], 2) + Math.pow(labColor1[2] - labColor2[2], 2), 1));
}


export function sRGBToLinear(c) {
	c = c / 255;
	return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}


export function LinearToSRGB(c) {
	c = c > 0.0031308 ? 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055 : 12.92 * c;
	return Math.round(c * 255);
}


export function rgbToOklch(rgb)
{
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;

	r = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
	g = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
	b = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

	var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
	var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
	var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

	var lRoot = Math.cbrt(l);
	var mRoot = Math.cbrt(m);
	var sRoot = Math.cbrt(s);

	var L = 0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot;
	var a = 1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot;
	var bb = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot;

	var C = Math.sqrt(a * a + bb * bb);
	var h = Math.atan2(bb, a);

	return [ L, C, h ];
}


export function OklchDistance(color1, color2)
{
	var deltaL = color1[0] - color2[0];
	var deltaC = color1[1] - color2[1];
	
	var C1 = color1[1];
	var C2 = color2[1];
	var avgC = (C1 + C2) / 2;
	var minC = Math.min(C1, C2);
	
	// Adaptive lightness weight: stronger in dark/light regions
	var avgL = (color1[0] + color2[0]) / 2;
	var lWeight = 1.5 + Math.abs(avgL - 0.5);
	
	// Chroma weight decreases as colors get more saturated
	var cWeight = 1 / (1 + avgC * 2);
	
	if(minC < 0.01)
		return deltaL * deltaL * lWeight + deltaC * deltaC * cWeight;
	
	var deltaH = Math.abs(color1[2] - color2[2]);
	if(deltaH > Math.PI)
		deltaH = Math.PI * 2 - deltaH;
	
	var hueTerm = 2 * Math.sqrt(C1 * C2) * Math.sin(deltaH / 2);
	
	return deltaL * deltaL * lWeight + deltaC * deltaC * cWeight + hueTerm * hueTerm;
}
