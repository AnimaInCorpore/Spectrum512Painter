import { ColorDistance, Distance4, rgb2lab, rgbToOklch, OklchDistance } from './core.js';

export function GetColorSlotIndex(X, ColorIndex)
{
    var Temp = 10 * ColorIndex;

    if(ColorIndex & 1) 
    	Temp -= 5;
    else     
    	Temp++;

    if(X < Temp)
    	return ColorIndex;
    
    if(X >= Temp + 160)
    	return ColorIndex + 32;
    
    return ColorIndex + 16;
}


export function RemapSpectrum512Image(Canvas, ImageInfos, BitsPerColor, DitherPattern)
{
	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;
	
	ImageInfos.SpectrumPalettes = [];
	ImageInfos.ConvertedBitsPerColor = BitsPerColor; 
	
	var OriginalCanvas = document.createElement("canvas");
	
	OriginalCanvas.width = Canvas.width;
	OriginalCanvas.height = Canvas.height;
	
	var OriginalContext = OriginalCanvas.getContext("2d");

	OriginalContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
	var OriginalData = OriginalContext.getImageData(0, 0, OriginalCanvas.width, OriginalCanvas.height);

	var Context = Canvas.getContext("2d");
	var Data = Context.getImageData(0, 0, Canvas.width, Canvas.height);

	for(var Y = 0; Y < Canvas.height; Y++)
	{
		// Fill Spectrum 512/4k color slots.
		
		var ColorSlots = [];
		
		for(var ColorSlotIndex = 0; ColorSlotIndex < 48; ColorSlotIndex++)
		{
			var Red = 0;
			var Green = 0;
			var Blue = 0;
			
			var Count = 0;
			
			//if(ColorSlotIndex == 0 || ColorSlotIndex == 16 || ColorSlotIndex == 32)
			if(ColorSlotIndex == 0)
			{
				Count = 100000;
			}
			/*
			else if(ColorSlotIndex == 15 || ColorSlotIndex == (16 + 15) || ColorSlotIndex == (32 + 15))
			{
				Red = 255;
				Green = 255;
				Blue = 255;

				Count = 1;
			}
			*/
			ColorSlots.push({ Red: Red, Green: Green, Blue: Blue, Count: Count });
		}
		
		var LineColorCounts = {};
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * Canvas.width) * 4;

			var Red = OriginalData.data[PixelIndex];
			var Green = OriginalData.data[PixelIndex + 1];
			var Blue = OriginalData.data[PixelIndex + 2];
			var Alpha = OriginalData.data[PixelIndex + 3];
			var Luminance = Red * 0.21 + Green * 0.72 + Blue * 0.07;
			
			if(Alpha == 255)
			{
				//Red = Math.round(Red * ShadesScale) * InverseShadesScale;
				//Green = Math.round(Green * ShadesScale) * InverseShadesScale;
				//Blue = Math.round(Blue * ShadesScale) * InverseShadesScale;
				
				var LineColorIndex = (Red << 16) | (Green << 8) | Blue;
				
				if(LineColorCounts[LineColorIndex])
					LineColorCounts[LineColorIndex]++;
				else
					LineColorCounts[LineColorIndex] = 1;
				
				var Colors = [];
				
				Colors.push({ Red: Red, Green: Green, Blue: Blue, Count: LineColorCounts[LineColorIndex] });
				
				var ColorIndex;
				
				for(ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					var SpectrumColor = ColorSlots[GetColorSlotIndex(X, ColorIndex)];
					
					if(SpectrumColor.Red == Red && SpectrumColor.Green == Green && SpectrumColor.Blue == Blue)
					{
						SpectrumColor.Count++;
						
						break;
					}
					
					if(SpectrumColor.Count == 0)
					{
						SpectrumColor.Red = Red;
						SpectrumColor.Green = Green;
						SpectrumColor.Blue = Blue;
						
						SpectrumColor.Count = LineColorCounts[LineColorIndex];
						
						break;
					}

					SpectrumColor.ColorSlot = GetColorSlotIndex(X, ColorIndex);
						
					Colors.push(SpectrumColor);
				}
				
				if(ColorIndex == 16)
				{
					var LastDistance = Number.MAX_VALUE;
					var Color1;
					var Color2;

					for(var Index1 = 0; Index1 < Colors.length - 1; Index1++)
					{
						for(var Index2 = Index1 + 1; Index2 < Colors.length; Index2++)
						{
							var Red1 = Math.round(Math.round(Colors[Index1].Red * ShadesScale) * InverseShadesScale); 
							var Green1 = Math.round(Math.round(Colors[Index1].Green * ShadesScale) * InverseShadesScale); 
							var Blue1 = Math.round(Math.round(Colors[Index1].Blue * ShadesScale) * InverseShadesScale); 
							
							var Red2 = Math.round(Math.round(Colors[Index2].Red * ShadesScale) * InverseShadesScale); 
							var Green2 = Math.round(Math.round(Colors[Index2].Green * ShadesScale) * InverseShadesScale); 
							var Blue2 = Math.round(Math.round(Colors[Index2].Blue * ShadesScale) * InverseShadesScale); 
							
							var Luminance1 = Red1 * 0.21 + Green1 * 0.72 + Blue1 * 0.07;
							var Luminance2 = Red2 * 0.21 + Green2 * 0.72 + Blue2 * 0.07;
							
							var RedDelta = Red1 - Red2;
							var GreenDelta = Green1 - Green2;
							var BlueDelta = Blue1 - Blue2;
			
							var LuminanceDelta = Luminance2 - Luminance1;
							
							var Distance = ColorDistance(RedDelta, GreenDelta, BlueDelta, LuminanceDelta);
							
							if(Distance < LastDistance)
							{
								LastDistance = Distance;
								
								Color1 = Colors[Index1];
								Color2 = Colors[Index2];
							}
						}						
					}
					
					if(Color1 == Colors[0])
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
					
						Color2.Count = Color1.Count + Color2.Count;
					}
					else if(Color1.ColorSlot < Color2.ColorSlot)
					{
						Color1.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
					
						Color1.Count = Color1.Count + Color2.Count;

						Color2.Red = Colors[0].Red;
						Color2.Green = Colors[0].Green;
						Color2.Blue = Colors[0].Blue;

						Color2.Count = Colors[0].Count;
					}
					else
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
					
						Color2.Count = Color1.Count + Color2.Count;

						Color1.Red = Colors[0].Red;
						Color1.Green = Colors[0].Green;
						Color1.Blue = Colors[0].Blue;

						Color1.Count = Colors[0].Count;
					}
				}

				// Find the matching color index.
				
				var LastDistance = Number.MAX_VALUE;
				var RemappedColor = {};
				var SpectrumColor = {};
				
				for(var ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					SpectrumColor.Red = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Red;
					SpectrumColor.Green = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Green;
					SpectrumColor.Blue = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Blue;
					SpectrumColor.Count = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Count;

					if(SpectrumColor.Count > 0)
					{
						SpectrumColor.Red = Math.round(Math.round(SpectrumColor.Red * ShadesScale) * InverseShadesScale);
						SpectrumColor.Green = Math.round(Math.round(SpectrumColor.Green * ShadesScale) * InverseShadesScale);
						SpectrumColor.Blue = Math.round(Math.round(SpectrumColor.Blue * ShadesScale) * InverseShadesScale);

						var RedDelta = SpectrumColor.Red - Red;
						var GreenDelta = SpectrumColor.Green - Green;
						var BlueDelta = SpectrumColor.Blue - Blue;
		
						var Luminance2 = SpectrumColor.Red * 0.21 + SpectrumColor.Green * 0.72 + SpectrumColor.Blue * 0.07; 
						var LuminanceDelta = Luminance2 - Luminance;
						
						var Distance = ColorDistance(RedDelta, GreenDelta, BlueDelta, LuminanceDelta);
						
						if(Distance < LastDistance)
						{
							RemappedColor.Red = SpectrumColor.Red;
							RemappedColor.Green = SpectrumColor.Green;
							RemappedColor.Blue = SpectrumColor.Blue;

							LastDistance = Distance;
						}
					}
				}
				
				for(var ColorSlotIndex = 0; ColorSlotIndex < 48; ColorSlotIndex++)
				{
					if(ColorSlots[ColorSlotIndex].Red != -1)
					{
						ColorSlots[ColorSlotIndex].Red = Math.round(Math.round(ColorSlots[ColorSlotIndex].Red * ShadesScale) * InverseShadesScale);
						ColorSlots[ColorSlotIndex].Green = Math.round(Math.round(ColorSlots[ColorSlotIndex].Green * ShadesScale) * InverseShadesScale);
						ColorSlots[ColorSlotIndex].Blue = Math.round(Math.round(ColorSlots[ColorSlotIndex].Blue * ShadesScale) * InverseShadesScale);
					}
				}
				
				// Error distribution for the following pixels in this line.

				var RedDelta = RemappedColor.Red - OriginalData.data[PixelIndex];
				var GreenDelta = RemappedColor.Green - OriginalData.data[PixelIndex + 1];
				var BlueDelta = RemappedColor.Blue - OriginalData.data[PixelIndex + 2];
				
				var Distribution1 = 0.6;
				var Distribution2 = 0.3;
				var Distribution3 = 0.1;
				var Intensity = 0.87;
				
				if(X < Canvas.width - 1)
				{
					OriginalData.data[PixelIndex + 4] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4] - RedDelta * Distribution1 * Intensity)));
					OriginalData.data[PixelIndex + 4 + 1] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 + 1] - GreenDelta * Distribution1 * Intensity)));
					OriginalData.data[PixelIndex + 4 + 2] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 + 2] - BlueDelta * Distribution1 * Intensity)));
				}
 
				if(X < Canvas.width - 2)
				{
					OriginalData.data[PixelIndex + 4 * 2] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 * 2] - RedDelta * Distribution2 * Intensity)));
					OriginalData.data[PixelIndex + 4 * 2 + 1] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 * 2 + 1] - GreenDelta * Distribution2 * Intensity)));
					OriginalData.data[PixelIndex + 4 * 2 + 2] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 * 2 + 2] - BlueDelta * Distribution2 * Intensity)));
				}

				if(X < Canvas.width - 3)
				{
					OriginalData.data[PixelIndex + 4 * 3] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 * 3] - RedDelta * Distribution3 * Intensity)));
					OriginalData.data[PixelIndex + 4 * 3 + 1] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 * 3 + 1] - GreenDelta * Distribution3 * Intensity)));
					OriginalData.data[PixelIndex + 4 * 3 + 2] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 * 3 + 2] - BlueDelta * Distribution3 * Intensity)));
 				}
/*
				var RedDelta = RemappedColor.Red - OriginalData.data[PixelIndex];
				var GreenDelta = RemappedColor.Green - OriginalData.data[PixelIndex + 1];
				var BlueDelta = RemappedColor.Blue - OriginalData.data[PixelIndex + 2];

				if(X < Canvas.width - 1)
				{
					OriginalData.data[PixelIndex + 4] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4] - RedDelta)));
					OriginalData.data[PixelIndex + 4 + 1] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 + 1] - GreenDelta)));
					OriginalData.data[PixelIndex + 4 + 2] = Math.round(Math.min(255, Math.max(0, OriginalData.data[PixelIndex + 4 + 2] - BlueDelta)));
				}
*/
			}
		}
		
		var SpectrumColors = [];
		
		for(var SlotIndex = 0; SlotIndex < 48; SlotIndex++)
			SpectrumColors.push({ Red: ColorSlots[SlotIndex].Red, Green: ColorSlots[SlotIndex].Green, Blue: ColorSlots[SlotIndex].Blue });
		
		ImageInfos.SpectrumPalettes.push(SpectrumColors);
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * Canvas.width) * 4;

			var Red = Data.data[PixelIndex];
			var Green = Data.data[PixelIndex + 1];
			var Blue = Data.data[PixelIndex + 2];
			var Alpha = Data.data[PixelIndex + 3];
			var Luminance = Red * 0.21 + Green * 0.72 + Blue * 0.07;
			
			if(Alpha == 255)
			{
				// Find the matching color index.
				
				var LastDistance = Number.MAX_VALUE;
				var RemappedColor = {};
				var SpectrumColor = {};
				
				for(var ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					SpectrumColor.Red = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Red;
					SpectrumColor.Green = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Green;
					SpectrumColor.Blue = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Blue;

					SpectrumColor.Red = Math.round(Math.round(SpectrumColor.Red * ShadesScale) * InverseShadesScale);
					SpectrumColor.Green = Math.round(Math.round(SpectrumColor.Green * ShadesScale) * InverseShadesScale);
					SpectrumColor.Blue = Math.round(Math.round(SpectrumColor.Blue * ShadesScale) * InverseShadesScale);

					var RedDelta = SpectrumColor.Red - Red;
					var GreenDelta = SpectrumColor.Green - Green;
					var BlueDelta = SpectrumColor.Blue - Blue;
	
					var Luminance2 = SpectrumColor.Red * 0.21 + SpectrumColor.Green * 0.72 + SpectrumColor.Blue * 0.07; 
					var LuminanceDelta = Luminance2 - Luminance;
					
					var Distance = ColorDistance(RedDelta, GreenDelta, BlueDelta, LuminanceDelta);
					
					if(Distance < LastDistance)
					{
						RemappedColor.Red = SpectrumColor.Red;
						RemappedColor.Green = SpectrumColor.Green;
						RemappedColor.Blue = SpectrumColor.Blue;
						
						LastDistance = Distance;
					}
				}

				if(DitherPattern)
				{
					{
						var RedDelta = RemappedColor.Red - Red;
						var GreenDelta = RemappedColor.Green - Green;
						var BlueDelta = RemappedColor.Blue - Blue;
	
						if(X < Canvas.width - 2)
						{
							if(DitherPattern[4])
							{
								Data.data[PixelIndex + 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 8] - RedDelta * DitherPattern[4])));
								Data.data[PixelIndex + 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 8 + 1] - GreenDelta * DitherPattern[4])));
								Data.data[PixelIndex + 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 8 + 2] - BlueDelta * DitherPattern[4])));
							}
	
							if(Y < Canvas.height - 1 && DitherPattern[9])
							{
								Data.data[PixelIndex + Canvas.width * 4 + 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 8] - RedDelta * DitherPattern[9])));
								Data.data[PixelIndex + Canvas.width * 4 + 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 8 + 1] - GreenDelta * DitherPattern[9])));
								Data.data[PixelIndex + Canvas.width * 4 + 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 8 + 2] - BlueDelta * DitherPattern[9])));
							}
	
							if(Y < Canvas.height - 2 && DitherPattern[14])
							{
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 8] - RedDelta * DitherPattern[14])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 8 + 1] - GreenDelta * DitherPattern[14])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 8 + 2] - BlueDelta * DitherPattern[14])));
							}
						}
						
						if(X < Canvas.width - 1)
						{
							if(DitherPattern[3])
							{
								Data.data[PixelIndex + 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 4] - RedDelta * DitherPattern[3])));
								Data.data[PixelIndex + 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 4 + 1] - GreenDelta * DitherPattern[3])));
								Data.data[PixelIndex + 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 4 + 2] - BlueDelta * DitherPattern[3])));
							}
	
							if(Y < Canvas.height - 1 && DitherPattern[8])
							{
								Data.data[PixelIndex + Canvas.width * 4 + 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 4] - RedDelta * DitherPattern[8])));
								Data.data[PixelIndex + Canvas.width * 4 + 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 4 + 1] - GreenDelta * DitherPattern[8])));
								Data.data[PixelIndex + Canvas.width * 4 + 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 4 + 2] - BlueDelta * DitherPattern[8])));
							}
	
							if(Y < Canvas.height - 2 && DitherPattern[13])
							{
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 4] - RedDelta * DitherPattern[13])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 4 + 1] - GreenDelta * DitherPattern[13])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 4 + 2] - BlueDelta * DitherPattern[13])));
							}
						}
						
						if(Y < Canvas.height - 1 && DitherPattern[7])
						{
							Data.data[PixelIndex + Canvas.width * 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4] - RedDelta * DitherPattern[7])));
							Data.data[PixelIndex + Canvas.width * 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 1] - GreenDelta * DitherPattern[7])));
							Data.data[PixelIndex + Canvas.width * 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 2] - BlueDelta * DitherPattern[7])));
						}
	
						if(Y < Canvas.height - 2 && DitherPattern[12])
						{
							Data.data[PixelIndex + Canvas.width * 2 * 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4] - RedDelta * DitherPattern[12])));
							Data.data[PixelIndex + Canvas.width * 2 * 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 1] - GreenDelta * DitherPattern[12])));
							Data.data[PixelIndex + Canvas.width * 2 * 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 2] - BlueDelta * DitherPattern[12])));
						}
	
						if(X > 0)
						{
							if(Y < Canvas.height - 1 && DitherPattern[6])
							{
								Data.data[PixelIndex + Canvas.width * 4 - 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 4] - RedDelta * DitherPattern[6])));
								Data.data[PixelIndex + Canvas.width * 4 - 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 4 + 1] - GreenDelta * DitherPattern[6])));
								Data.data[PixelIndex + Canvas.width * 4 - 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 4 + 2] - BlueDelta * DitherPattern[6])));
							}
	
							if(Y < Canvas.height - 2 && DitherPattern[11])
							{
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 4] - RedDelta * DitherPattern[11])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 4 + 1] - GreenDelta * DitherPattern[11])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 4 + 2] - BlueDelta * DitherPattern[11])));
							}
						}
						
						if(X > 1)
						{
							if(Y < Canvas.height - 1 && DitherPattern[5])
							{
								Data.data[PixelIndex + Canvas.width * 4 - 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 8] - RedDelta * DitherPattern[5])));
								Data.data[PixelIndex + Canvas.width * 4 - 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 8 + 1] - GreenDelta * DitherPattern[5])));
								Data.data[PixelIndex + Canvas.width * 4 - 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 8 + 2] - BlueDelta * DitherPattern[5])));
							}
	
							if(Y < Canvas.height - 2 && DitherPattern[10])
							{
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 8] - RedDelta * DitherPattern[10])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 8 + 1] - GreenDelta * DitherPattern[10])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 8 + 2] - BlueDelta * DitherPattern[10])));
							}
						}
					}
				}

				Data.data[PixelIndex] = RemappedColor.Red;
				Data.data[PixelIndex + 1] = RemappedColor.Green;
				Data.data[PixelIndex + 2] = RemappedColor.Blue;
				Data.data[PixelIndex + 3] = 255;
			}
		}
	}
	
	Context.putImageData(Data, 0, 0);
}


export function RemapSpectrum512Image2(Canvas, ImageInfos, BitsPerColor, DitherPattern)
{
	var BayerPattern2x2 = [ 
   		[ 1 / 5, 3 / 5 ], 
   		[ 4 / 5, 2 / 5 ] ];
	               	
	var BayerPattern8x8 = [
	    [  0 / 65, 32 / 65,  8 / 65, 40 / 65,  2 / 65, 34 / 65, 10 / 65, 42 / 65 ],
	    [ 48 / 65, 16 / 65, 56 / 65, 24 / 65, 50 / 65, 18 / 65, 58 / 65, 26 / 65 ],
	    [ 12 / 65, 44 / 65,  4 / 65, 36 / 65, 14 / 65, 46 / 65,  6 / 65, 38 / 65 ],
	    [ 60 / 65, 28 / 65, 52 / 65, 20 / 65, 62 / 65, 30 / 65, 54 / 65, 22 / 65 ],
	    [  3 / 65, 35 / 65, 11 / 65, 43 / 65,  1 / 65, 33 / 65,  9 / 65, 41 / 65 ],
	    [ 51 / 65, 19 / 65, 59 / 65, 27 / 65, 49 / 65, 17 / 65, 57 / 65, 25 / 65 ],
	    [ 15 / 65, 47 / 65,  7 / 65, 39 / 65, 13 / 65, 45 / 65,  5 / 65, 37 / 65 ],
	    [ 63 / 65, 31 / 65, 55 / 65, 23 / 65, 61 / 65, 29 / 65, 53 / 65, 21 / 65 ] ];
	                       
	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	var Context = Canvas.getContext("2d");
	var Data = Context.getImageData(0, 0, Canvas.width, Canvas.height);
	
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * Canvas.width) * 4;

			var Red = Data.data[PixelIndex];
			var Green = Data.data[PixelIndex + 1];
			var Blue = Data.data[PixelIndex + 2];
			var Alpha = Data.data[PixelIndex + 3];
			var Luminance = Red * 0.21 + Green * 0.72 + Blue * 0.07;
			
			if(Alpha == 255)
			{
				Red = Math.round(Math.min(255, Math.max(0, Red + BayerPattern8x8[X % 8][Y % 8] * InverseShadesScale)));
				Green = Math.round(Math.min(255, Math.max(0, Green + BayerPattern8x8[X % 8][Y % 8] * InverseShadesScale)));
				Blue = Math.round(Math.min(255, Math.max(0, Blue + BayerPattern8x8[X % 8][Y % 8] * InverseShadesScale)));
				
				Red = Math.round(Red * ShadesScale) * InverseShadesScale;
				Green = Math.round(Green * ShadesScale) * InverseShadesScale;
				Blue = Math.round(Blue * ShadesScale) * InverseShadesScale;
				
				Data.data[PixelIndex] = Red;
				Data.data[PixelIndex + 1] = Green;
				Data.data[PixelIndex + 2] = Blue;
				Data.data[PixelIndex + 3] = 255;
			}
		}
	}
	
	Context.putImageData(Data, 0, 0);

	// Spectrumize it.
	
	ImageInfos.SpectrumPalettes = [];
	ImageInfos.ConvertedBitsPerColor = BitsPerColor; 
	
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		// Fill Spectrum 512/4k color slots.
		
		var ColorSlots = [];
		
		for(var ColorSlotIndex = 0; ColorSlotIndex < 48; ColorSlotIndex++)
		{
			var Red = 0;
			var Green = 0;
			var Blue = 0;
			
			var Count = 0;
			
			//if(ColorSlotIndex == 0 || ColorSlotIndex == 16 || ColorSlotIndex == 32)
			if(ColorSlotIndex == 0)
			{
				Count = 100000;
			}
			/*
			else if(ColorSlotIndex == 15 || ColorSlotIndex == (16 + 15) || ColorSlotIndex == (32 + 15))
			{
				Red = 255;
				Green = 255;
				Blue = 255;

				Count = 1;
			}
			*/
			ColorSlots.push({ Red: Red, Green: Green, Blue: Blue, Count: Count });
		}
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * Canvas.width) * 4;

			var Red = Data.data[PixelIndex];
			var Green = Data.data[PixelIndex + 1];
			var Blue = Data.data[PixelIndex + 2];
			var Alpha = Data.data[PixelIndex + 3];
			var Luminance = Red * 0.21 + Green * 0.72 + Blue * 0.07;
			
			if(Alpha == 255)
			{
				var Colors = [];
				
				Colors.push({ Red: Red, Green: Green, Blue: Blue, Count: 1 });
				
				var ColorIndex;
				
				for(ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					var SpectrumColor = ColorSlots[GetColorSlotIndex(X, ColorIndex)];
					
					if(SpectrumColor.Red == Red && SpectrumColor.Green == Green && SpectrumColor.Blue == Blue)
					{
						SpectrumColor.Count++;
						
						break;
					}
					
					if(SpectrumColor.Count == 0)
					{
						SpectrumColor.Red = Red;
						SpectrumColor.Green = Green;
						SpectrumColor.Blue = Blue;
						
						SpectrumColor.Count = 1;
						
						break;
					}

					SpectrumColor.ColorSlot = GetColorSlotIndex(X, ColorIndex);
						
					Colors.push(SpectrumColor);
				}
				
				if(ColorIndex == 16)
				{
					var LastDistance = Number.MAX_VALUE;
					var Color1;
					var Color2;

					for(var Index1 = 0; Index1 < Colors.length - 1; Index1++)
					{
						for(var Index2 = Index1 + 1; Index2 < Colors.length; Index2++)
						{
							var Red1 = Math.round(Math.round(Colors[Index1].Red * ShadesScale) * InverseShadesScale); 
							var Green1 = Math.round(Math.round(Colors[Index1].Green * ShadesScale) * InverseShadesScale); 
							var Blue1 = Math.round(Math.round(Colors[Index1].Blue * ShadesScale) * InverseShadesScale); 
							
							var Red2 = Math.round(Math.round(Colors[Index2].Red * ShadesScale) * InverseShadesScale); 
							var Green2 = Math.round(Math.round(Colors[Index2].Green * ShadesScale) * InverseShadesScale); 
							var Blue2 = Math.round(Math.round(Colors[Index2].Blue * ShadesScale) * InverseShadesScale); 
							
							var Luminance1 = Red1 * 0.21 + Green1 * 0.72 + Blue1 * 0.07;
							var Luminance2 = Red2 * 0.21 + Green2 * 0.72 + Blue2 * 0.07;
							
							var RedDelta = Red1 - Red2;
							var GreenDelta = Green1 - Green2;
							var BlueDelta = Blue1 - Blue2;
			
							var LuminanceDelta = Luminance2 - Luminance1;
							
							var Distance = ColorDistance(RedDelta, GreenDelta, BlueDelta, LuminanceDelta);
							
							if(Distance < LastDistance)
							{
								LastDistance = Distance;
								
								Color1 = Colors[Index1];
								Color2 = Colors[Index2];
							}
						}						
					}
					
					if(Color1 == Colors[0])
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
					
						Color2.Count = Color1.Count + Color2.Count;
					}
					else if(Color1.ColorSlot < Color2.ColorSlot)
					{
						Color1.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
					
						Color1.Count = Color1.Count + Color2.Count;

						Color2.Red = Colors[0].Red;
						Color2.Green = Colors[0].Green;
						Color2.Blue = Colors[0].Blue;

						Color2.Count = Colors[0].Count;
					}
					else
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
					
						Color2.Count = Color1.Count + Color2.Count;

						Color1.Red = Colors[0].Red;
						Color1.Green = Colors[0].Green;
						Color1.Blue = Colors[0].Blue;

						Color1.Count = Colors[0].Count;
					}
				}
			}
		}
		
		var SpectrumColors = [];
		
		for(var SlotIndex = 0; SlotIndex < 48; SlotIndex++)
		{
			ColorSlots[SlotIndex].Red = Math.round(Math.round(ColorSlots[SlotIndex].Red * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Green = Math.round(Math.round(ColorSlots[SlotIndex].Green * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Blue = Math.round(Math.round(ColorSlots[SlotIndex].Blue * ShadesScale) * InverseShadesScale);

			SpectrumColors.push({ Red: ColorSlots[SlotIndex].Red, Green: ColorSlots[SlotIndex].Green, Blue: ColorSlots[SlotIndex].Blue });
		}
		
		ImageInfos.SpectrumPalettes.push(SpectrumColors);
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * Canvas.width) * 4;

			var Red = Data.data[PixelIndex];
			var Green = Data.data[PixelIndex + 1];
			var Blue = Data.data[PixelIndex + 2];
			var Alpha = Data.data[PixelIndex + 3];
			var Luminance = Red * 0.21 + Green * 0.72 + Blue * 0.07;
			
			if(Alpha == 255)
			{
				// Find the matching color index.
				
				var LastDistance = Number.MAX_VALUE;
				var RemappedColor = {};
				var SpectrumColor = {};
				
				for(var ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					SpectrumColor.Red = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Red;
					SpectrumColor.Green = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Green;
					SpectrumColor.Blue = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Blue;

					var RedDelta = SpectrumColor.Red - Red;
					var GreenDelta = SpectrumColor.Green - Green;
					var BlueDelta = SpectrumColor.Blue - Blue;
	
					var Luminance2 = SpectrumColor.Red * 0.21 + SpectrumColor.Green * 0.72 + SpectrumColor.Blue * 0.07; 
					var LuminanceDelta = Luminance2 - Luminance;
					
					var Distance = ColorDistance(RedDelta, GreenDelta, BlueDelta, LuminanceDelta);
					
					if(Distance < LastDistance)
					{
						RemappedColor.Red = SpectrumColor.Red;
						RemappedColor.Green = SpectrumColor.Green;
						RemappedColor.Blue = SpectrumColor.Blue;
						
						LastDistance = Distance;
					}
				}

				if(DitherPattern)
				{
					{
						var RedDelta = RemappedColor.Red - Red;
						var GreenDelta = RemappedColor.Green - Green;
						var BlueDelta = RemappedColor.Blue - Blue;
	
						if(X < Canvas.width - 2)
						{
							if(DitherPattern[4])
							{
								Data.data[PixelIndex + 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 8] - RedDelta * DitherPattern[4])));
								Data.data[PixelIndex + 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 8 + 1] - GreenDelta * DitherPattern[4])));
								Data.data[PixelIndex + 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 8 + 2] - BlueDelta * DitherPattern[4])));
							}
	
							if(Y < Canvas.height - 1 && DitherPattern[9])
							{
								Data.data[PixelIndex + Canvas.width * 4 + 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 8] - RedDelta * DitherPattern[9])));
								Data.data[PixelIndex + Canvas.width * 4 + 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 8 + 1] - GreenDelta * DitherPattern[9])));
								Data.data[PixelIndex + Canvas.width * 4 + 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 8 + 2] - BlueDelta * DitherPattern[9])));
							}
	
							if(Y < Canvas.height - 2 && DitherPattern[14])
							{
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 8] - RedDelta * DitherPattern[14])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 8 + 1] - GreenDelta * DitherPattern[14])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 8 + 2] - BlueDelta * DitherPattern[14])));
							}
						}
						
						if(X < Canvas.width - 1)
						{
							if(DitherPattern[3])
							{
								Data.data[PixelIndex + 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 4] - RedDelta * DitherPattern[3])));
								Data.data[PixelIndex + 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 4 + 1] - GreenDelta * DitherPattern[3])));
								Data.data[PixelIndex + 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + 4 + 2] - BlueDelta * DitherPattern[3])));
							}
	
							if(Y < Canvas.height - 1 && DitherPattern[8])
							{
								Data.data[PixelIndex + Canvas.width * 4 + 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 4] - RedDelta * DitherPattern[8])));
								Data.data[PixelIndex + Canvas.width * 4 + 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 4 + 1] - GreenDelta * DitherPattern[8])));
								Data.data[PixelIndex + Canvas.width * 4 + 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 4 + 2] - BlueDelta * DitherPattern[8])));
							}
	
							if(Y < Canvas.height - 2 && DitherPattern[13])
							{
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 4] - RedDelta * DitherPattern[13])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 4 + 1] - GreenDelta * DitherPattern[13])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 + 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 4 + 2] - BlueDelta * DitherPattern[13])));
							}
						}
						
						if(Y < Canvas.height - 1 && DitherPattern[7])
						{
							Data.data[PixelIndex + Canvas.width * 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4] - RedDelta * DitherPattern[7])));
							Data.data[PixelIndex + Canvas.width * 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 1] - GreenDelta * DitherPattern[7])));
							Data.data[PixelIndex + Canvas.width * 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 + 2] - BlueDelta * DitherPattern[7])));
						}
	
						if(Y < Canvas.height - 2 && DitherPattern[12])
						{
							Data.data[PixelIndex + Canvas.width * 2 * 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4] - RedDelta * DitherPattern[12])));
							Data.data[PixelIndex + Canvas.width * 2 * 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 1] - GreenDelta * DitherPattern[12])));
							Data.data[PixelIndex + Canvas.width * 2 * 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 + 2] - BlueDelta * DitherPattern[12])));
						}
	
						if(X > 0)
						{
							if(Y < Canvas.height - 1 && DitherPattern[6])
							{
								Data.data[PixelIndex + Canvas.width * 4 - 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 4] - RedDelta * DitherPattern[6])));
								Data.data[PixelIndex + Canvas.width * 4 - 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 4 + 1] - GreenDelta * DitherPattern[6])));
								Data.data[PixelIndex + Canvas.width * 4 - 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 4 + 2] - BlueDelta * DitherPattern[6])));
							}
	
							if(Y < Canvas.height - 2 && DitherPattern[11])
							{
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 4] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 4] - RedDelta * DitherPattern[11])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 4 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 4 + 1] - GreenDelta * DitherPattern[11])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 4 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 4 + 2] - BlueDelta * DitherPattern[11])));
							}
						}
						
						if(X > 1)
						{
							if(Y < Canvas.height - 1 && DitherPattern[5])
							{
								Data.data[PixelIndex + Canvas.width * 4 - 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 8] - RedDelta * DitherPattern[5])));
								Data.data[PixelIndex + Canvas.width * 4 - 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 8 + 1] - GreenDelta * DitherPattern[5])));
								Data.data[PixelIndex + Canvas.width * 4 - 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 4 - 8 + 2] - BlueDelta * DitherPattern[5])));
							}
	
							if(Y < Canvas.height - 2 && DitherPattern[10])
							{
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 8] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 8] - RedDelta * DitherPattern[10])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 8 + 1] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 8 + 1] - GreenDelta * DitherPattern[10])));
								Data.data[PixelIndex + Canvas.width * 2 * 4 - 8 + 2] = Math.round(Math.min(255, Math.max(0, Data.data[PixelIndex + Canvas.width * 2 * 4 - 8 + 2] - BlueDelta * DitherPattern[10])));
							}
						}
					}
				}

				Data.data[PixelIndex] = RemappedColor.Red;
				Data.data[PixelIndex + 1] = RemappedColor.Green;
				Data.data[PixelIndex + 2] = RemappedColor.Blue;
				Data.data[PixelIndex + 3] = 255;
			}
		}
	}
	
	Context.putImageData(Data, 0, 0);
}

var rgbToLabTable = {};


export function RemapSpectrum512Image3(Canvas, ImageInfos, BitsPerColor, DitherPattern)
{
	var WorkCanvas = document.createElement("canvas");
	
	WorkCanvas.width = Canvas.width + 2;
	WorkCanvas.height = Canvas.height + 2;
	
	var WorkContext = WorkCanvas.getContext("2d");

	WorkContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
	var WorkImageData = WorkContext.getImageData(0, 0, WorkCanvas.width, WorkCanvas.height);
	var WorkData = WorkImageData.data;

	var OriginalDitherPattern = [ 0, 0, 0, 7.0 / 16.0, 0, 0, 3.0 / 16.0, 5.0 / 16.0, 1.0 / 16.0, 0, 0, 0, 0, 0, 0 ];

	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	for(var Y = 0; Y < Canvas.height; Y++)
	{
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				var NewRed = Math.round(Math.round(Red * ShadesScale) * InverseShadesScale); 
				var NewGreen = Math.round(Math.round(Green * ShadesScale) * InverseShadesScale); 
				var NewBlue = Math.round(Math.round(Blue * ShadesScale) * InverseShadesScale); 

				if(OriginalDitherPattern)
				{
					var RedDelta = NewRed - Red;
					var GreenDelta = NewGreen - Green;
					var BlueDelta = NewBlue - Blue;

					WorkData[PixelIndex + 8] -= RedDelta * OriginalDitherPattern[4];
					WorkData[PixelIndex + 8 + 1] -= GreenDelta * OriginalDitherPattern[4];
					WorkData[PixelIndex + 8 + 2] -= BlueDelta * OriginalDitherPattern[4];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 8] -= RedDelta * OriginalDitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 1] -= GreenDelta * OriginalDitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 2] -= BlueDelta * OriginalDitherPattern[9];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8] -= RedDelta * OriginalDitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 1] -= GreenDelta * OriginalDitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 2] -= BlueDelta * OriginalDitherPattern[14];
					
					WorkData[PixelIndex + 4] -= RedDelta * OriginalDitherPattern[3];
					WorkData[PixelIndex + 4 + 1] -= GreenDelta * OriginalDitherPattern[3];
					WorkData[PixelIndex + 4 + 2] -= BlueDelta * OriginalDitherPattern[3];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 4] -= RedDelta * OriginalDitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 1] -= GreenDelta * OriginalDitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 2] -= BlueDelta * OriginalDitherPattern[8];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4] -= RedDelta * OriginalDitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 1] -= GreenDelta * OriginalDitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 2] -= BlueDelta * OriginalDitherPattern[13];

					WorkData[PixelIndex + WorkCanvas.width * 4] -= RedDelta * OriginalDitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 1] -= GreenDelta * OriginalDitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 2] -= BlueDelta * OriginalDitherPattern[7];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4] -= RedDelta * OriginalDitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 1] -= GreenDelta * OriginalDitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 2] -= BlueDelta * OriginalDitherPattern[12];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 4] -= RedDelta * OriginalDitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 1] -= GreenDelta * OriginalDitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 2] -= BlueDelta * OriginalDitherPattern[6];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4] -= RedDelta * OriginalDitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 1] -= GreenDelta * OriginalDitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 2] -= BlueDelta * OriginalDitherPattern[11];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 8] -= RedDelta * OriginalDitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 1] -= GreenDelta * OriginalDitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 2] -= BlueDelta * OriginalDitherPattern[5];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8] -= RedDelta * OriginalDitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 1] -= GreenDelta * OriginalDitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 2] -= BlueDelta * OriginalDitherPattern[10];
				}

				WorkData[PixelIndex] = NewRed;
				WorkData[PixelIndex + 1] = NewGreen;
				WorkData[PixelIndex + 2] = NewBlue;
				WorkData[PixelIndex + 3] = Alpha;
			}
		}
	}
	
	//WorkContext.putImageData(WorkImageData, 0, 0);

	// Spectrumize it.

	var Context = Canvas.getContext("2d");
	var ImageData = Context.getImageData(0, 0, Canvas.width, Canvas.height);
	var Data = ImageData.data;
	
	ImageInfos.SpectrumPalettes = [];
	ImageInfos.ConvertedBitsPerColor = BitsPerColor; 
	
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		// Fill Spectrum 512/4k color slots.
		
		var ColorSlots = [];
		
		for(var ColorSlotIndex = 0; ColorSlotIndex < 48; ColorSlotIndex++)
		{
			var Red = 0;
			var Green = 0;
			var Blue = 0;
			let lab = rgb2lab([ Red, Green, Blue ]);
			
			var Count = 0;
			
			if(ColorSlotIndex == 0 || ColorSlotIndex == 32)
				Count = 2;

			ColorSlots.push({ Red: Red, Green: Green, Blue: Blue, lab: lab, Count: Count, ColorSlotIndex: ColorSlotIndex });
		}
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			let lab = rgb2lab([ Red, Green, Blue ]);
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				var Colors = [];
				
				Colors.push({ Red: Red, Green: Green, Blue: Blue, lab: lab, Count: 1 });
				
				var ColorIndex;
				
				for(ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					var SpectrumColor = ColorSlots[GetColorSlotIndex(X, ColorIndex)];
					
					if(SpectrumColor.Red == Red && SpectrumColor.Green == Green && SpectrumColor.Blue == Blue)
					{
						SpectrumColor.Count++;
						
						break;
					}
					
					if(SpectrumColor.Count == 0)
					{
						SpectrumColor.Red = Red;
						SpectrumColor.Green = Green;
						SpectrumColor.Blue = Blue;
						SpectrumColor.lab = lab;

						SpectrumColor.Count = 1;
						
						break;
					}
						
					Colors.push(SpectrumColor);
				}
				
				if(ColorIndex == 16)
				{
					var LastDistance = Number.MAX_VALUE;
					var Color1;
					var Color2;

					for(var Index1 = 0; Index1 < Colors.length - 1; Index1++)
					{
						for(var Index2 = Index1 + 1; Index2 < Colors.length; Index2++)
						{
							if(Colors[Index2].ColorSlotIndex == 32 || Colors[Index1].ColorSlotIndex == 32)
								continue;

							let labColor1 = Colors[Index1].lab;
							let labColor2 = Colors[Index2].lab;
							let Distance = Math.pow(Math.abs(labColor1[0] - labColor2[0]), 2) * 0.3 + Math.sqrt(Math.pow(labColor1[1] - labColor2[1], 2) + Math.pow(labColor1[2] - labColor2[2], 2));

							var TotalCount = Colors[Index1].Count * Colors[Index1].Count + Colors[Index2].Count * Colors[Index2].Count;

							Distance *= Math.pow(TotalCount, 0.6);

							if(Distance < LastDistance)
							{
								LastDistance = Distance;
								
								Color1 = Colors[Index1];
								Color2 = Colors[Index2];
							}
						}						
					}
					
					if(Color1 == Colors[0])
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.lab = rgb2lab([ Color2.Red, Color2.Green, Color2.Blue ]);
					
						Color2.Count = Color1.Count + Color2.Count;
					}
					else if(Color1.ColorSlotIndex < Color2.ColorSlotIndex)
					{
						Color1.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.lab = rgb2lab([ Color1.Red, Color1.Green, Color1.Blue ]);
					
						Color1.Count = Color1.Count + Color2.Count;

						Color2.Red = Colors[0].Red;
						Color2.Green = Colors[0].Green;
						Color2.Blue = Colors[0].Blue;
						Color2.lab = Colors[0].lab;

						Color2.Count = Colors[0].Count;
					}
					else
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.lab = rgb2lab([ Color2.Red, Color2.Green, Color2.Blue ]);
					
						Color2.Count = Color1.Count + Color2.Count;

						Color1.Red = Colors[0].Red;
						Color1.Green = Colors[0].Green;
						Color1.Blue = Colors[0].Blue;
						Color1.lab = Colors[0].lab;

						Color1.Count = Colors[0].Count;
					}
				}
			}
		}
		
		var SpectrumColors = [];
		
		for(var SlotIndex = 0; SlotIndex < 48; SlotIndex++)
		{
			ColorSlots[SlotIndex].Red = Math.round(Math.round(ColorSlots[SlotIndex].Red * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Green = Math.round(Math.round(ColorSlots[SlotIndex].Green * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Blue = Math.round(Math.round(ColorSlots[SlotIndex].Blue * ShadesScale) * InverseShadesScale);

			SpectrumColors.push({ Red: ColorSlots[SlotIndex].Red, Green: ColorSlots[SlotIndex].Green, Blue: ColorSlots[SlotIndex].Blue, lab: rgb2lab([ ColorSlots[SlotIndex].Red, ColorSlots[SlotIndex].Green, ColorSlots[SlotIndex].Blue ]) });
		}
		
		ImageInfos.SpectrumPalettes.push(SpectrumColors);
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;
			var DisplayPixelIndex = (X + Y * Canvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			let lab = rgb2lab([ Red, Green, Blue ]);
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				// Find the matching color index.
				
				var LastDistance = Number.MAX_VALUE;
				var RemappedColor = {};
				var SpectrumColor = {};
				
				for(var ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					SpectrumColor.Red = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Red;
					SpectrumColor.Green = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Green;
					SpectrumColor.Blue = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Blue;
					SpectrumColor.lab = ColorSlots[GetColorSlotIndex(X, ColorIndex)].lab;

					let labColor1 = SpectrumColor.lab;
					let labColor2 = lab;
					let Distance = Math.pow(Math.abs(labColor1[0] - labColor2[0]), 2) * 0.3 + Math.sqrt(Math.pow(labColor1[1] - labColor2[1], 2) + Math.pow(labColor1[2] - labColor2[2], 2));

					if(Distance < LastDistance)
					{
						RemappedColor.Red = SpectrumColor.Red;
						RemappedColor.Green = SpectrumColor.Green;
						RemappedColor.Blue = SpectrumColor.Blue;
						
						LastDistance = Distance;
					}
				}

				if(DitherPattern)
				{
					var RedDelta = RemappedColor.Red - Red;
					var GreenDelta = RemappedColor.Green - Green;
					var BlueDelta = RemappedColor.Blue - Blue;

					WorkData[PixelIndex + 8] -= RedDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 1] -= GreenDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 2] -= BlueDelta * DitherPattern[4];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 8] -= RedDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 1] -= GreenDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 2] -= BlueDelta * DitherPattern[9];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8] -= RedDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 1] -= GreenDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 2] -= BlueDelta * DitherPattern[14];
					
					WorkData[PixelIndex + 4] -= RedDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 1] -= GreenDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 2] -= BlueDelta * DitherPattern[3];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 4] -= RedDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 1] -= GreenDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 2] -= BlueDelta * DitherPattern[8];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4] -= RedDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 1] -= GreenDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 2] -= BlueDelta * DitherPattern[13];

					WorkData[PixelIndex + WorkCanvas.width * 4] -= RedDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 1] -= GreenDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 2] -= BlueDelta * DitherPattern[7];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4] -= RedDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 1] -= GreenDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 2] -= BlueDelta * DitherPattern[12];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 4] -= RedDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 1] -= GreenDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 2] -= BlueDelta * DitherPattern[6];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4] -= RedDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 1] -= GreenDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 2] -= BlueDelta * DitherPattern[11];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 8] -= RedDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 1] -= GreenDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 2] -= BlueDelta * DitherPattern[5];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8] -= RedDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 1] -= GreenDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 2] -= BlueDelta * DitherPattern[10];
				}

				Data[DisplayPixelIndex] = RemappedColor.Red;
				Data[DisplayPixelIndex + 1] = RemappedColor.Green;
				Data[DisplayPixelIndex + 2] = RemappedColor.Blue;
				Data[DisplayPixelIndex + 3] = 255;
			}
		}
	}
	
	Context.putImageData(ImageData, 0, 0);
}


export function RemapSpectrum512Image4(Canvas, ImageInfos, BitsPerColor, DitherPattern)
{
	var WorkCanvas = document.createElement("canvas");
	
	WorkCanvas.width = Canvas.width + 2;
	WorkCanvas.height = Canvas.height + 2;
	
	var WorkContext = WorkCanvas.getContext("2d");

	WorkContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
	var WorkImageData = WorkContext.getImageData(0, 0, WorkCanvas.width, WorkCanvas.height);
	var WorkData = WorkImageData.data;

	var OriginalDitherPattern = [ 0, 0, 0, 7.0 / 16.0, 0, 0, 3.0 / 16.0, 5.0 / 16.0, 1.0 / 16.0, 0, 0, 0, 0, 0, 0 ];

	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	for(var Y = 0; Y < Canvas.height; Y++)
	{
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				var NewRed = Math.round(Math.round(Red * ShadesScale) * InverseShadesScale); 
				var NewGreen = Math.round(Math.round(Green * ShadesScale) * InverseShadesScale); 
				var NewBlue = Math.round(Math.round(Blue * ShadesScale) * InverseShadesScale); 

				if(OriginalDitherPattern)
				{
					var RedDelta = NewRed - Red;
					var GreenDelta = NewGreen - Green;
					var BlueDelta = NewBlue - Blue;

					WorkData[PixelIndex + 8] -= RedDelta * OriginalDitherPattern[4];
					WorkData[PixelIndex + 8 + 1] -= GreenDelta * OriginalDitherPattern[4];
					WorkData[PixelIndex + 8 + 2] -= BlueDelta * OriginalDitherPattern[4];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 8] -= RedDelta * OriginalDitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 1] -= GreenDelta * OriginalDitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 2] -= BlueDelta * OriginalDitherPattern[9];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8] -= RedDelta * OriginalDitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 1] -= GreenDelta * OriginalDitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 2] -= BlueDelta * OriginalDitherPattern[14];
					
					WorkData[PixelIndex + 4] -= RedDelta * OriginalDitherPattern[3];
					WorkData[PixelIndex + 4 + 1] -= GreenDelta * OriginalDitherPattern[3];
					WorkData[PixelIndex + 4 + 2] -= BlueDelta * OriginalDitherPattern[3];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 4] -= RedDelta * OriginalDitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 1] -= GreenDelta * OriginalDitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 2] -= BlueDelta * OriginalDitherPattern[8];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4] -= RedDelta * OriginalDitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 1] -= GreenDelta * OriginalDitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 2] -= BlueDelta * OriginalDitherPattern[13];

					WorkData[PixelIndex + WorkCanvas.width * 4] -= RedDelta * OriginalDitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 1] -= GreenDelta * OriginalDitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 2] -= BlueDelta * OriginalDitherPattern[7];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4] -= RedDelta * OriginalDitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 1] -= GreenDelta * OriginalDitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 2] -= BlueDelta * OriginalDitherPattern[12];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 4] -= RedDelta * OriginalDitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 1] -= GreenDelta * OriginalDitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 2] -= BlueDelta * OriginalDitherPattern[6];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4] -= RedDelta * OriginalDitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 1] -= GreenDelta * OriginalDitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 2] -= BlueDelta * OriginalDitherPattern[11];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 8] -= RedDelta * OriginalDitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 1] -= GreenDelta * OriginalDitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 2] -= BlueDelta * OriginalDitherPattern[5];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8] -= RedDelta * OriginalDitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 1] -= GreenDelta * OriginalDitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 2] -= BlueDelta * OriginalDitherPattern[10];
				}

				WorkData[PixelIndex] = NewRed;
				WorkData[PixelIndex + 1] = NewGreen;
				WorkData[PixelIndex + 2] = NewBlue;
				WorkData[PixelIndex + 3] = Alpha;
			}
		}
	}

	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	// Spectrumize it.

	var Context = Canvas.getContext("2d");
	var ImageData = Context.getImageData(0, 0, Canvas.width, Canvas.height);
	var Data = ImageData.data;
	
	ImageInfos.SpectrumPalettes = [];
	ImageInfos.ConvertedBitsPerColor = BitsPerColor; 
	
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		// Fill Spectrum 512/4k color slots.
		
		var ColorSlots = [];
		
		for(var ColorSlotIndex = 0; ColorSlotIndex < 48; ColorSlotIndex++)
		{
			var Red = 0;
			var Green = 0;
			var Blue = 0;
			let lab = rgb2lab([ Red, Green, Blue ]);
			
			var Count = 0;
			
			if(ColorSlotIndex == 0 || ColorSlotIndex == 32)
				Count = 2;

			ColorSlots.push({ Red: Red, Green: Green, Blue: Blue, lab: lab, Count: Count, ColorSlotIndex: ColorSlotIndex });
		}
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];

			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
/*				
				if((X ^ Y) & 1) {
					Red += Red - Math.round(Math.round(Red * ShadesScale) * InverseShadesScale); 
					Green += Green - Math.round(Math.round(Green * ShadesScale) * InverseShadesScale); 
					Blue += Blue - Math.round(Math.round(Blue * ShadesScale) * InverseShadesScale); 
	
					WorkData[PixelIndex] = Red;
					WorkData[PixelIndex + 1] = Green;
					WorkData[PixelIndex + 2] = Blue;
				}
*/			
				let lab = rgb2lab([ Red, Green, Blue ]);

				var Colors = [];
				
				Colors.push({ Red: Red, Green: Green, Blue: Blue, lab: lab, Count: 1 });
				
				var ColorIndex;
				
				for(ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					var SpectrumColor = ColorSlots[GetColorSlotIndex(X, ColorIndex)];
					
					if(SpectrumColor.Red == Red && SpectrumColor.Green == Green && SpectrumColor.Blue == Blue)
					{
						SpectrumColor.Count++;
						
						break;
					}
					
					if(SpectrumColor.Count == 0)
					{
						SpectrumColor.Red = Red;
						SpectrumColor.Green = Green;
						SpectrumColor.Blue = Blue;
						SpectrumColor.lab = lab;

						SpectrumColor.Count = 1;
						
						break;
					}
						
					Colors.push(SpectrumColor);
				}
				
				if(ColorIndex == 16)
				{
					var LastDistance = Number.MAX_VALUE;
					var Color1;
					var Color2;

					for(var Index1 = 0; Index1 < Colors.length - 1; Index1++)
					{
						for(var Index2 = Index1 + 1; Index2 < Colors.length; Index2++)
						{
							if(Colors[Index2].ColorSlotIndex == 32 || Colors[Index1].ColorSlotIndex == 32)
								continue;

							let Distance = 
								Distance4(Colors[Index1].lab, Colors[Index2].lab) *
								Math.pow(Math.pow(Colors[Index1].Count, 2) + Math.pow(Colors[Index2].Count, 2), 0.5);

							if(Distance < LastDistance)
							{
								LastDistance = Distance;
								
								Color1 = Colors[Index1];
								Color2 = Colors[Index2];
							}
						}						
					}
					
					if(Color1 == Colors[0])
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.lab = rgb2lab([ Color2.Red, Color2.Green, Color2.Blue ]);
					
						Color2.Count = Color1.Count + Color2.Count;
					}
					else if(Color1.ColorSlotIndex < Color2.ColorSlotIndex)
					{
						Color1.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.lab = rgb2lab([ Color1.Red, Color1.Green, Color1.Blue ]);
					
						Color1.Count = Color1.Count + Color2.Count;

						Color2.Red = Colors[0].Red;
						Color2.Green = Colors[0].Green;
						Color2.Blue = Colors[0].Blue;
						Color2.lab = Colors[0].lab;

						Color2.Count = Colors[0].Count;
					}
					else
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.lab = rgb2lab([ Color2.Red, Color2.Green, Color2.Blue ]);
					
						Color2.Count = Color1.Count + Color2.Count;

						Color1.Red = Colors[0].Red;
						Color1.Green = Colors[0].Green;
						Color1.Blue = Colors[0].Blue;
						Color1.lab = Colors[0].lab;

						Color1.Count = Colors[0].Count;
					}
				}
			}
		}
/*		
		WorkContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
		WorkImageData = WorkContext.getImageData(0, 0, WorkCanvas.width, WorkCanvas.height);
		WorkData = WorkImageData.data;
*/	
		var SpectrumColors = [];
		
		for(var SlotIndex = 0; SlotIndex < 48; SlotIndex++)
		{
			ColorSlots[SlotIndex].Red = Math.round(Math.round(ColorSlots[SlotIndex].Red * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Green = Math.round(Math.round(ColorSlots[SlotIndex].Green * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Blue = Math.round(Math.round(ColorSlots[SlotIndex].Blue * ShadesScale) * InverseShadesScale);

			SpectrumColors.push({ Red: ColorSlots[SlotIndex].Red, Green: ColorSlots[SlotIndex].Green, Blue: ColorSlots[SlotIndex].Blue, lab: rgb2lab([ ColorSlots[SlotIndex].Red, ColorSlots[SlotIndex].Green, ColorSlots[SlotIndex].Blue ]) });
		}
		
		ImageInfos.SpectrumPalettes.push(SpectrumColors);
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;
			var DisplayPixelIndex = (X + Y * Canvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				let lab = rgb2lab([ Red, Green, Blue ]);

				// Find the matching color index.
				
				var LastDistance = Number.MAX_VALUE;
				var RemappedColor = {};
				var SpectrumColor = {};
				
				for(var ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					SpectrumColor.Red = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Red;
					SpectrumColor.Green = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Green;
					SpectrumColor.Blue = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Blue;
					SpectrumColor.lab = ColorSlots[GetColorSlotIndex(X, ColorIndex)].lab;

					let Distance = Distance4(SpectrumColor.lab, lab);

					if(Distance < LastDistance)
					{
						RemappedColor.Red = SpectrumColor.Red;
						RemappedColor.Green = SpectrumColor.Green;
						RemappedColor.Blue = SpectrumColor.Blue;
						
						LastDistance = Distance;
					}
				}

				if(DitherPattern)
				{
					var RedDelta = RemappedColor.Red - Red;
					var GreenDelta = RemappedColor.Green - Green;
					var BlueDelta = RemappedColor.Blue - Blue;

					WorkData[PixelIndex + 8] -= RedDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 1] -= GreenDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 2] -= BlueDelta * DitherPattern[4];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 8] -= RedDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 1] -= GreenDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 2] -= BlueDelta * DitherPattern[9];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8] -= RedDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 1] -= GreenDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 2] -= BlueDelta * DitherPattern[14];
					
					WorkData[PixelIndex + 4] -= RedDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 1] -= GreenDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 2] -= BlueDelta * DitherPattern[3];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 4] -= RedDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 1] -= GreenDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 2] -= BlueDelta * DitherPattern[8];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4] -= RedDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 1] -= GreenDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 2] -= BlueDelta * DitherPattern[13];

					WorkData[PixelIndex + WorkCanvas.width * 4] -= RedDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 1] -= GreenDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 2] -= BlueDelta * DitherPattern[7];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4] -= RedDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 1] -= GreenDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 2] -= BlueDelta * DitherPattern[12];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 4] -= RedDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 1] -= GreenDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 2] -= BlueDelta * DitherPattern[6];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4] -= RedDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 1] -= GreenDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 2] -= BlueDelta * DitherPattern[11];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 8] -= RedDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 1] -= GreenDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 2] -= BlueDelta * DitherPattern[5];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8] -= RedDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 1] -= GreenDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 2] -= BlueDelta * DitherPattern[10];
				}

				Data[DisplayPixelIndex] = RemappedColor.Red;
				Data[DisplayPixelIndex + 1] = RemappedColor.Green;
				Data[DisplayPixelIndex + 2] = RemappedColor.Blue;
				Data[DisplayPixelIndex + 3] = 255;
			}
		}
	}
	
	Context.putImageData(ImageData, 0, 0);
}


export function RemapSpectrum512Image5(Canvas, ImageInfos, BitsPerColor, DitherPattern)
{
	var WorkCanvas = document.createElement("canvas");
	
	WorkCanvas.width = Canvas.width + 2;
	WorkCanvas.height = Canvas.height + 2;
	
	var WorkContext = WorkCanvas.getContext("2d");

	WorkContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
	var WorkImageData = WorkContext.getImageData(0, 0, WorkCanvas.width, WorkCanvas.height);
	var WorkData = WorkImageData.data;

	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	for(var Y = 0; Y < Canvas.height; Y++)
	{
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				if(DitherPattern)
				{
					var NewRed = Math.round(Math.round(Red * ShadesScale) * InverseShadesScale); 
					var NewGreen = Math.round(Math.round(Green * ShadesScale) * InverseShadesScale); 
					var NewBlue = Math.round(Math.round(Blue * ShadesScale) * InverseShadesScale); 
	
					var RedDelta = NewRed - Red;
					var GreenDelta = NewGreen - Green;
					var BlueDelta = NewBlue - Blue;

					WorkData[PixelIndex + 8] -= RedDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 1] -= GreenDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 2] -= BlueDelta * DitherPattern[4];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 8] -= RedDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 1] -= GreenDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 2] -= BlueDelta * DitherPattern[9];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8] -= RedDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 1] -= GreenDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 2] -= BlueDelta * DitherPattern[14];
					
					WorkData[PixelIndex + 4] -= RedDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 1] -= GreenDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 2] -= BlueDelta * DitherPattern[3];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 4] -= RedDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 1] -= GreenDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 2] -= BlueDelta * DitherPattern[8];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4] -= RedDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 1] -= GreenDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 2] -= BlueDelta * DitherPattern[13];

					WorkData[PixelIndex + WorkCanvas.width * 4] -= RedDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 1] -= GreenDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 2] -= BlueDelta * DitherPattern[7];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4] -= RedDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 1] -= GreenDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 2] -= BlueDelta * DitherPattern[12];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 4] -= RedDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 1] -= GreenDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 2] -= BlueDelta * DitherPattern[6];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4] -= RedDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 1] -= GreenDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 2] -= BlueDelta * DitherPattern[11];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 8] -= RedDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 1] -= GreenDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 2] -= BlueDelta * DitherPattern[5];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8] -= RedDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 1] -= GreenDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 2] -= BlueDelta * DitherPattern[10];

					WorkData[PixelIndex] = NewRed;
					WorkData[PixelIndex + 1] = NewGreen;
					WorkData[PixelIndex + 2] = NewBlue;
					WorkData[PixelIndex + 3] = Alpha;
				}
			}
		}
	}

	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	// Spectrumize it.

	var Context = Canvas.getContext("2d");
	var ImageData = Context.getImageData(0, 0, Canvas.width, Canvas.height);
	var Data = ImageData.data;
	
	ImageInfos.SpectrumPalettes = [];
	ImageInfos.ConvertedBitsPerColor = BitsPerColor; 
	
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		// Fill Spectrum 512/4k color slots.
		
		var ColorSlots = [];
		
		for(var ColorSlotIndex = 0; ColorSlotIndex < 48; ColorSlotIndex++)
		{
			var Red = 0;
			var Green = 0;
			var Blue = 0;
			let lab = rgb2lab([ Red, Green, Blue ]);
			
			var Count = 0;
			
			if(ColorSlotIndex == 0 || ColorSlotIndex == 32)
				Count = 2;

			ColorSlots.push({ Red: Red, Green: Green, Blue: Blue, lab: lab, Count: Count, ColorSlotIndex: ColorSlotIndex });
		}
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];

			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
/*				
				if((X ^ Y) & 1) {
					Red += Red - Math.round(Math.round(Red * ShadesScale) * InverseShadesScale); 
					Green += Green - Math.round(Math.round(Green * ShadesScale) * InverseShadesScale); 
					Blue += Blue - Math.round(Math.round(Blue * ShadesScale) * InverseShadesScale); 
	
					WorkData[PixelIndex] = Red;
					WorkData[PixelIndex + 1] = Green;
					WorkData[PixelIndex + 2] = Blue;
				}
*/			
				let lab = rgb2lab([ Red, Green, Blue ]);

				var Colors = [];
				
				Colors.push({ Red: Red, Green: Green, Blue: Blue, lab: lab, Count: 1 });
				
				var ColorIndex;
				
				for(ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					var SpectrumColor = ColorSlots[GetColorSlotIndex(X, ColorIndex)];
					
					if(SpectrumColor.Red == Red && SpectrumColor.Green == Green && SpectrumColor.Blue == Blue)
					{
						SpectrumColor.Count++;
						
						break;
					}
					
					if(SpectrumColor.Count == 0)
					{
						SpectrumColor.Red = Red;
						SpectrumColor.Green = Green;
						SpectrumColor.Blue = Blue;
						SpectrumColor.lab = lab;

						SpectrumColor.Count = 1;
						
						break;
					}
						
					Colors.push(SpectrumColor);
				}
				
				if(ColorIndex == 16)
				{
					var LastDistance = Number.MAX_VALUE;
					var Color1;
					var Color2;

					for(var Index1 = 0; Index1 < Colors.length - 1; Index1++)
					{
						for(var Index2 = Index1 + 1; Index2 < Colors.length; Index2++)
						{
							if(Colors[Index2].ColorSlotIndex == 32 || Colors[Index1].ColorSlotIndex == 32)
								continue;

							let deltaL = Colors[Index1].lab[0] - Colors[Index2].lab[0];
							let deltaRed = Colors[Index1].Red - Colors[Index2].Red;
							let deltaGreen = Colors[Index1].Green - Colors[Index2].Green;
							let deltaBlue = Colors[Index1].Blue - Colors[Index2].Blue;
		
							let Distance = (deltaL * deltaL + Math.sqrt(deltaRed * deltaRed + deltaGreen * deltaGreen + deltaBlue * deltaBlue)) * (Colors[Index1].Count + Colors[Index2].Count);

							if(Distance < LastDistance)
							{
								LastDistance = Distance;
								
								Color1 = Colors[Index1];
								Color2 = Colors[Index2];
							}
						}						
					}
					
					if(Color1 == Colors[0])
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.lab = rgb2lab([ Color2.Red, Color2.Green, Color2.Blue ]);
					
						Color2.Count = Color1.Count + Color2.Count;
					}
					else if(Color1.ColorSlotIndex < Color2.ColorSlotIndex)
					{
						Color1.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color1.lab = rgb2lab([ Color1.Red, Color1.Green, Color1.Blue ]);
					
						Color1.Count = Color1.Count + Color2.Count;

						Color2.Red = Colors[0].Red;
						Color2.Green = Colors[0].Green;
						Color2.Blue = Colors[0].Blue;
						Color2.lab = Colors[0].lab;

						Color2.Count = Colors[0].Count;
					}
					else
					{
						Color2.Red = (Color1.Red * Color1.Count + Color2.Red * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Green = (Color1.Green * Color1.Count + Color2.Green * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.Blue = (Color1.Blue * Color1.Count + Color2.Blue * Color2.Count) / (Color1.Count + Color2.Count);
						Color2.lab = rgb2lab([ Color2.Red, Color2.Green, Color2.Blue ]);
					
						Color2.Count = Color1.Count + Color2.Count;

						Color1.Red = Colors[0].Red;
						Color1.Green = Colors[0].Green;
						Color1.Blue = Colors[0].Blue;
						Color1.lab = Colors[0].lab;

						Color1.Count = Colors[0].Count;
					}
				}
			}
		}
/*		
		WorkContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
		WorkImageData = WorkContext.getImageData(0, 0, WorkCanvas.width, WorkCanvas.height);
		WorkData = WorkImageData.data;
*/	
		var SpectrumColors = [];
				
		for(var SlotIndex = 0; SlotIndex < 48; SlotIndex++)
		{
			ColorSlots[SlotIndex].Red = Math.round(Math.round(ColorSlots[SlotIndex].Red * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Green = Math.round(Math.round(ColorSlots[SlotIndex].Green * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Blue = Math.round(Math.round(ColorSlots[SlotIndex].Blue * ShadesScale) * InverseShadesScale);

			SpectrumColors.push({ Red: ColorSlots[SlotIndex].Red, Green: ColorSlots[SlotIndex].Green, Blue: ColorSlots[SlotIndex].Blue, lab: rgb2lab([ ColorSlots[SlotIndex].Red, ColorSlots[SlotIndex].Green, ColorSlots[SlotIndex].Blue ]) });
		}

		ImageInfos.SpectrumPalettes.push(SpectrumColors);

		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;
			var DisplayPixelIndex = (X + Y * Canvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				let lab = rgb2lab([ Red, Green, Blue ]);

				// Find the matching color index.
				
				var LastDistance = Number.MAX_VALUE;
				var RemappedColor = {};
				var SpectrumColor = {};
				
				for(var ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					SpectrumColor.Red = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Red;
					SpectrumColor.Green = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Green;
					SpectrumColor.Blue = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Blue;
					SpectrumColor.lab = ColorSlots[GetColorSlotIndex(X, ColorIndex)].lab;

					let deltaL = lab[0] - SpectrumColor.lab[0];
					let deltaRed = Red - SpectrumColor.Red;
					let deltaGreen = Green - SpectrumColor.Green;
					let deltaBlue = Blue - SpectrumColor.Blue;

					let Distance = deltaL * deltaL + Math.sqrt(deltaRed * deltaRed + deltaGreen * deltaGreen + deltaBlue * deltaBlue);

					if(Distance < LastDistance)
					{
						RemappedColor.Red = SpectrumColor.Red;
						RemappedColor.Green = SpectrumColor.Green;
						RemappedColor.Blue = SpectrumColor.Blue;
						
						LastDistance = Distance;
					}
				}

				Data[DisplayPixelIndex] = Math.round(Math.round(RemappedColor.Red * ShadesScale) * InverseShadesScale);
				Data[DisplayPixelIndex + 1] = Math.round(Math.round(RemappedColor.Green * ShadesScale) * InverseShadesScale);
				Data[DisplayPixelIndex + 2] = Math.round(Math.round(RemappedColor.Blue * ShadesScale) * InverseShadesScale);
				Data[DisplayPixelIndex + 3] = 255;
			}
		}
	}
	
	Context.putImageData(ImageData, 0, 0);
}


export function RemapSpectrum512Image6(Canvas, ImageInfos, BitsPerColor, DitherPattern)
{
	var WorkCanvas = document.createElement("canvas");
	
	WorkCanvas.width = Canvas.width + 2;
	WorkCanvas.height = Canvas.height + 2;
	
	var WorkContext = WorkCanvas.getContext("2d");

	WorkContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
	var WorkImageData = WorkContext.getImageData(0, 0, WorkCanvas.width, WorkCanvas.height);
	var WorkData = WorkImageData.data;

	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	for(var Y = 0; Y < Canvas.height; Y++)
	{
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				if(DitherPattern)
				{
					var NewRed = Math.round(Math.round(Red * ShadesScale) * InverseShadesScale); 
					var NewGreen = Math.round(Math.round(Green * ShadesScale) * InverseShadesScale); 
					var NewBlue = Math.round(Math.round(Blue * ShadesScale) * InverseShadesScale); 
	
					var RedDelta = NewRed - Red;
					var GreenDelta = NewGreen - Green;
					var BlueDelta = NewBlue - Blue;

					WorkData[PixelIndex + 8] -= RedDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 1] -= GreenDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 2] -= BlueDelta * DitherPattern[4];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 8] -= RedDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 1] -= GreenDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 2] -= BlueDelta * DitherPattern[9];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8] -= RedDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 1] -= GreenDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 2] -= BlueDelta * DitherPattern[14];
					
					WorkData[PixelIndex + 4] -= RedDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 1] -= GreenDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 2] -= BlueDelta * DitherPattern[3];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 4] -= RedDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 1] -= GreenDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 2] -= BlueDelta * DitherPattern[8];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4] -= RedDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 1] -= GreenDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 2] -= BlueDelta * DitherPattern[13];

					WorkData[PixelIndex + WorkCanvas.width * 4] -= RedDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 1] -= GreenDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 2] -= BlueDelta * DitherPattern[7];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4] -= RedDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 1] -= GreenDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 2] -= BlueDelta * DitherPattern[12];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 4] -= RedDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 1] -= GreenDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 2] -= BlueDelta * DitherPattern[6];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4] -= RedDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 1] -= GreenDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 2] -= BlueDelta * DitherPattern[11];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 8] -= RedDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 1] -= GreenDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 2] -= BlueDelta * DitherPattern[5];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8] -= RedDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 1] -= GreenDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 2] -= BlueDelta * DitherPattern[10];

					WorkData[PixelIndex] = NewRed;
					WorkData[PixelIndex + 1] = NewGreen;
					WorkData[PixelIndex + 2] = NewBlue;
					WorkData[PixelIndex + 3] = Alpha;
				}
			}
		}
	}

	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	// Spectrumize it.

	var Context = Canvas.getContext("2d");
	var ImageData = Context.getImageData(0, 0, Canvas.width, Canvas.height);
	var Data = ImageData.data;
	
	ImageInfos.SpectrumPalettes = [];
	ImageInfos.ConvertedBitsPerColor = BitsPerColor; 
	
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		// Fill Spectrum 512/4k color slots.
		
		var ColorSlots = [];
		
		for(var ColorSlotIndex = 0; ColorSlotIndex < 48; ColorSlotIndex++)
		{
			var Red = 0;
			var Green = 0;
			var Blue = 0;
			let oklch = rgbToOklch([ Red, Green, Blue ]);
			
			var Count = 0;
			
			if(ColorSlotIndex == 0 || ColorSlotIndex == 32)
				Count = 2;

			ColorSlots.push({ Red: Red, Green: Green, Blue: Blue, oklch: oklch, Count: Count, ColorSlotIndex: ColorSlotIndex });
		}
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];

			if(Red < 0) Red = 0; else if(Red > 255) Red = 255;
			if(Green < 0) Green = 0; else if(Green > 255) Green = 255;
			if(Blue < 0) Blue = 0; else if(Blue > 255) Blue = 255;

			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
/*				
				if((X ^ Y) & 1) {
					Red += Red - Math.round(Math.round(Red * ShadesScale) * InverseShadesScale); 
					Green += Green - Math.round(Math.round(Green * ShadesScale) * InverseShadesScale); 
					Blue += Blue - Math.round(Math.round(Blue * ShadesScale) * InverseShadesScale); 
	
					WorkData[PixelIndex] = Red;
					WorkData[PixelIndex + 1] = Green;
					WorkData[PixelIndex + 2] = Blue;
				}
*/			
				let oklch = rgbToOklch([ Red, Green, Blue ]);

				var Colors = [];
				
				Colors.push({ Red: Red, Green: Green, Blue: Blue, oklch: oklch, Count: 1 });
				
				var ColorIndex;
				
				for(ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					var SpectrumColor = ColorSlots[GetColorSlotIndex(X, ColorIndex)];
					
					if(SpectrumColor.Red == Red && SpectrumColor.Green == Green && SpectrumColor.Blue == Blue)
					{
						SpectrumColor.Count++;
						
						break;
					}
					
					if(SpectrumColor.Count == 0)
					{
						SpectrumColor.Red = Red;
						SpectrumColor.Green = Green;
						SpectrumColor.Blue = Blue;
						SpectrumColor.oklch = oklch;

						SpectrumColor.Count = 1;
						
						break;
					}
						
					Colors.push(SpectrumColor);
				}
				
				if(ColorIndex == 16)
				{
					var BestScore = Number.MAX_VALUE;
					var Color1;
					var Color2;

					for(var Index1 = 0; Index1 < Colors.length - 1; Index1++)
					{
						for(var Index2 = Index1 + 1; Index2 < Colors.length; Index2++)
						{
							var C1 = Colors[Index1];
							var C2 = Colors[Index2];

							if(C1.ColorSlotIndex == 32 || C2.ColorSlotIndex == 32)
								continue;

							// Skip large hue jumps when both colors are reasonably saturated.
							let deltaH = Math.abs(C1.oklch[2] - C2.oklch[2]);
							if(deltaH > Math.PI)
								deltaH = Math.PI * 2 - deltaH;

							let minC = Math.min(C1.oklch[1], C2.oklch[1]);
							if(minC > 0.05 && deltaH > Math.PI * (40 / 180))
								continue;

							let Distance = OklchDistance(C1.oklch, C2.oklch);
							let lightnessGap = Math.abs(C1.oklch[0] - C2.oklch[0]);
							let chromaGap = Math.abs(C1.oklch[1] - C2.oklch[1]);

							let Score = Distance * (C1.Count + C2.Count) * (1 + lightnessGap) * (1 + chromaGap);

							if(Score < BestScore)
							{
								BestScore = Score;
								
								Color1 = C1;
								Color2 = C2;
							}
						}					
					}
					
					if(Color1 == Colors[0])
					{
						let W1 = Color1.Count, W2 = Color2.Count, WSum = W1 + W2;

						let L1 = Color1.oklch[0], C1 = Color1.oklch[1], h1 = Color1.oklch[2];
						let L2 = Color2.oklch[0], C2 = Color2.oklch[1], h2 = Color2.oklch[2];

						let a1 = C1 * Math.cos(h1), b1 = C1 * Math.sin(h1);
						let a2 = C2 * Math.cos(h2), b2 = C2 * Math.sin(h2);

						let L = (L1 * W1 + L2 * W2) / WSum;
						let a = (a1 * W1 + a2 * W2) / WSum;
						let b = (b1 * W1 + b2 * W2) / WSum;

						let l_ = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
						let m_ = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
						let s_ = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);

						let r =  4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
						let g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
						let bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;

						let toSRGB = function(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };

						Color2.Red = Math.max(0, Math.min(255, Math.round(toSRGB(r) * 255)));
						Color2.Green = Math.max(0, Math.min(255, Math.round(toSRGB(g) * 255)));
						Color2.Blue = Math.max(0, Math.min(255, Math.round(toSRGB(bl) * 255)));
						Color2.oklch = [ L, Math.sqrt(a * a + b * b), Math.atan2(b, a) ];
					
						Color2.Count = WSum;
					}
					else if(Color1.ColorSlotIndex < Color2.ColorSlotIndex)
					{
						let W1 = Color1.Count, W2 = Color2.Count, WSum = W1 + W2;

						let L1 = Color1.oklch[0], C1 = Color1.oklch[1], h1 = Color1.oklch[2];
						let L2 = Color2.oklch[0], C2 = Color2.oklch[1], h2 = Color2.oklch[2];

						let a1 = C1 * Math.cos(h1), b1 = C1 * Math.sin(h1);
						let a2 = C2 * Math.cos(h2), b2 = C2 * Math.sin(h2);

						let L = (L1 * W1 + L2 * W2) / WSum;
						let a = (a1 * W1 + a2 * W2) / WSum;
						let b = (b1 * W1 + b2 * W2) / WSum;

						let l_ = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
						let m_ = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
						let s_ = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);

						let r =  4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
						let g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
						let bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;

						let toSRGB = function(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };

						Color1.Red = Math.max(0, Math.min(255, Math.round(toSRGB(r) * 255)));
						Color1.Green = Math.max(0, Math.min(255, Math.round(toSRGB(g) * 255)));
						Color1.Blue = Math.max(0, Math.min(255, Math.round(toSRGB(bl) * 255)));
						Color1.oklch = [ L, Math.sqrt(a * a + b * b), Math.atan2(b, a) ];
					
						Color1.Count = Color1.Count + Color2.Count;

						Color2.Red = Colors[0].Red;
						Color2.Green = Colors[0].Green;
						Color2.Blue = Colors[0].Blue;
						Color2.oklch = Colors[0].oklch;

						Color2.Count = Colors[0].Count;
					}
					else
					{
						let W1 = Color1.Count, W2 = Color2.Count, WSum = W1 + W2;
						let L1 = Color1.oklch[0], C1 = Color1.oklch[1], h1 = Color1.oklch[2];
						let L2 = Color2.oklch[0], C2 = Color2.oklch[1], h2 = Color2.oklch[2];

						let a1 = C1 * Math.cos(h1), b1 = C1 * Math.sin(h1);
						let a2 = C2 * Math.cos(h2), b2 = C2 * Math.sin(h2);

						let L = (L1 * W1 + L2 * W2) / WSum;
						let a = (a1 * W1 + a2 * W2) / WSum;
						let b = (b1 * W1 + b2 * W2) / WSum;

						let l_ = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
						let m_ = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
						let s_ = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);

						let r =  4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
						let g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
						let bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;

						let toSRGB = function(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };

						Color2.Red = Math.max(0, Math.min(255, Math.round(toSRGB(r) * 255)));
						Color2.Green = Math.max(0, Math.min(255, Math.round(toSRGB(g) * 255)));
						Color2.Blue = Math.max(0, Math.min(255, Math.round(toSRGB(bl) * 255)));
						Color2.oklch = [ L, Math.sqrt(a * a + b * b), Math.atan2(b, a) ];
					
						Color2.Count = Color1.Count + Color2.Count;

						Color1.Red = Colors[0].Red;
						Color1.Green = Colors[0].Green;
						Color1.Blue = Colors[0].Blue;
						Color1.oklch = Colors[0].oklch;

						Color1.Count = Colors[0].Count;
					}
				}
			}
		}
/*		
		WorkContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
		WorkImageData = WorkContext.getImageData(0, 0, WorkCanvas.width, WorkCanvas.height);
		WorkData = WorkImageData.data;
*/	
		var SpectrumColors = [];
				
		for(var SlotIndex = 0; SlotIndex < 48; SlotIndex++)
		{
			ColorSlots[SlotIndex].Red = Math.round(Math.round(ColorSlots[SlotIndex].Red * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Green = Math.round(Math.round(ColorSlots[SlotIndex].Green * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Blue = Math.round(Math.round(ColorSlots[SlotIndex].Blue * ShadesScale) * InverseShadesScale);

			ColorSlots[SlotIndex].oklch = rgbToOklch([ ColorSlots[SlotIndex].Red, ColorSlots[SlotIndex].Green, ColorSlots[SlotIndex].Blue ]);

			SpectrumColors.push({ Red: ColorSlots[SlotIndex].Red, Green: ColorSlots[SlotIndex].Green, Blue: ColorSlots[SlotIndex].Blue, oklch: ColorSlots[SlotIndex].oklch });
		}

		ImageInfos.SpectrumPalettes.push(SpectrumColors);

		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;
			var DisplayPixelIndex = (X + Y * Canvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];

			if(Red < 0) Red = 0; else if(Red > 255) Red = 255;
			if(Green < 0) Green = 0; else if(Green > 255) Green = 255;
			if(Blue < 0) Blue = 0; else if(Blue > 255) Blue = 255;
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				let oklch = rgbToOklch([ Red, Green, Blue ]);

				// Find the matching color index.
				
				var LastDistance = Number.MAX_VALUE;
				var RemappedColor = {};
				var SpectrumColor = {};
				
				for(var ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					SpectrumColor.Red = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Red;
					SpectrumColor.Green = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Green;
					SpectrumColor.Blue = ColorSlots[GetColorSlotIndex(X, ColorIndex)].Blue;
					SpectrumColor.oklch = ColorSlots[GetColorSlotIndex(X, ColorIndex)].oklch;

					let Distance = OklchDistance(oklch, SpectrumColor.oklch);

					if(Distance < LastDistance)
					{
						RemappedColor.Red = SpectrumColor.Red;
						RemappedColor.Green = SpectrumColor.Green;
						RemappedColor.Blue = SpectrumColor.Blue;
						
						LastDistance = Distance;
					}
				}

				Data[DisplayPixelIndex] = Math.round(Math.round(RemappedColor.Red * ShadesScale) * InverseShadesScale);
				Data[DisplayPixelIndex + 1] = Math.round(Math.round(RemappedColor.Green * ShadesScale) * InverseShadesScale);
				Data[DisplayPixelIndex + 2] = Math.round(Math.round(RemappedColor.Blue * ShadesScale) * InverseShadesScale);
				Data[DisplayPixelIndex + 3] = 255;
			}
		}
	}
	
	Context.putImageData(ImageData, 0, 0);
}


export function RemapSpectrum512Image7(Canvas, ImageInfos, BitsPerColor, DitherPattern)
{
	var WorkCanvas = document.createElement("canvas");
	
	WorkCanvas.width = Canvas.width + 2;
	WorkCanvas.height = Canvas.height + 2;
	
	var WorkContext = WorkCanvas.getContext("2d");

	WorkContext.drawImage(Canvas, 0, 0, Canvas.width, Canvas.height);		
	
	var WorkImageData = WorkContext.getImageData(0, 0, WorkCanvas.width, WorkCanvas.height);
	var WorkData = WorkImageData.data;

	var ShadesPerColor = 1 << BitsPerColor;
	var ShadesScale = (ShadesPerColor - 1) / 255;
	var InverseShadesScale = 1 / ShadesScale;

	// Pre-dithering pass
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];
			
			if(Alpha == 255)
			{
				if(DitherPattern)
				{
					var NewRed = Math.round(Math.round(Red * ShadesScale) * InverseShadesScale); 
					var NewGreen = Math.round(Math.round(Green * ShadesScale) * InverseShadesScale); 
					var NewBlue = Math.round(Math.round(Blue * ShadesScale) * InverseShadesScale); 
	
					var RedDelta = NewRed - Red;
					var GreenDelta = NewGreen - Green;
					var BlueDelta = NewBlue - Blue;

					WorkData[PixelIndex + 8] -= RedDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 1] -= GreenDelta * DitherPattern[4];
					WorkData[PixelIndex + 8 + 2] -= BlueDelta * DitherPattern[4];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 8] -= RedDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 1] -= GreenDelta * DitherPattern[9];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 8 + 2] -= BlueDelta * DitherPattern[9];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8] -= RedDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 1] -= GreenDelta * DitherPattern[14];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 8 + 2] -= BlueDelta * DitherPattern[14];
					
					WorkData[PixelIndex + 4] -= RedDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 1] -= GreenDelta * DitherPattern[3];
					WorkData[PixelIndex + 4 + 2] -= BlueDelta * DitherPattern[3];

					WorkData[PixelIndex + WorkCanvas.width * 4 + 4] -= RedDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 1] -= GreenDelta * DitherPattern[8];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 4 + 2] -= BlueDelta * DitherPattern[8];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4] -= RedDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 1] -= GreenDelta * DitherPattern[13];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 4 + 2] -= BlueDelta * DitherPattern[13];

					WorkData[PixelIndex + WorkCanvas.width * 4] -= RedDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 1] -= GreenDelta * DitherPattern[7];
					WorkData[PixelIndex + WorkCanvas.width * 4 + 2] -= BlueDelta * DitherPattern[7];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4] -= RedDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 1] -= GreenDelta * DitherPattern[12];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 + 2] -= BlueDelta * DitherPattern[12];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 4] -= RedDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 1] -= GreenDelta * DitherPattern[6];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 4 + 2] -= BlueDelta * DitherPattern[6];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4] -= RedDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 1] -= GreenDelta * DitherPattern[11];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 4 + 2] -= BlueDelta * DitherPattern[11];

					WorkData[PixelIndex + WorkCanvas.width * 4 - 8] -= RedDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 1] -= GreenDelta * DitherPattern[5];
					WorkData[PixelIndex + WorkCanvas.width * 4 - 8 + 2] -= BlueDelta * DitherPattern[5];

					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8] -= RedDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 1] -= GreenDelta * DitherPattern[10];
					WorkData[PixelIndex + WorkCanvas.width * 2 * 4 - 8 + 2] -= BlueDelta * DitherPattern[10];

					WorkData[PixelIndex] = NewRed;
					WorkData[PixelIndex + 1] = NewGreen;
					WorkData[PixelIndex + 2] = NewBlue;
					WorkData[PixelIndex + 3] = Alpha;
				}
			}
		}
	}

	var Context = Canvas.getContext("2d");
	var ImageData = Context.getImageData(0, 0, Canvas.width, Canvas.height);
	var Data = ImageData.data;
	
	ImageInfos.SpectrumPalettes = [];
	ImageInfos.ConvertedBitsPerColor = BitsPerColor; 
	
	for(var Y = 0; Y < Canvas.height; Y++)
	{
		// Fill Spectrum 512/4k color slots using greedy sequential assignment (like Image5)
		
		var ColorSlots = [];
		
		for(var ColorSlotIndex = 0; ColorSlotIndex < 48; ColorSlotIndex++)
		{
			var Red = 0;
			var Green = 0;
			var Blue = 0;
			var oklch = rgbToOklch([ Red, Green, Blue ]);
			
			var Count = 0;
			
			// Reserve slots 0 and 32 for background color (black)
			if(ColorSlotIndex == 0 || ColorSlotIndex == 32)
				Count = 2;

			ColorSlots.push({ Red: Red, Green: Green, Blue: Blue, oklch: oklch, Count: Count, ColorSlotIndex: ColorSlotIndex });
		}
		
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];

			if(Red < 0) Red = 0; else if(Red > 255) Red = 255;
			if(Green < 0) Green = 0; else if(Green > 255) Green = 255;
			if(Blue < 0) Blue = 0; else if(Blue > 255) Blue = 255;
			
			if(Alpha == 255)
			{
				var oklch = rgbToOklch([ Red, Green, Blue ]);

				var Colors = [];
				
				Colors.push({ Red: Red, Green: Green, Blue: Blue, oklch: oklch, Count: 1 });
				
				var ColorIndex;
				
				// Check if this color already exists in one of the 16 available slots, or find an empty slot
				for(ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					var SpectrumColor = ColorSlots[GetColorSlotIndex(X, ColorIndex)];
					
					if(SpectrumColor.Red == Red && SpectrumColor.Green == Green && SpectrumColor.Blue == Blue)
					{
						SpectrumColor.Count++;
						break;
					}
					
					if(SpectrumColor.Count == 0)
					{
						SpectrumColor.Red = Red;
						SpectrumColor.Green = Green;
						SpectrumColor.Blue = Blue;
						SpectrumColor.oklch = oklch;
						SpectrumColor.Count = 1;
						break;
					}
						
					Colors.push(SpectrumColor);
				}
				
				// All 16 slots are full - need to merge two colors to make room
				if(ColorIndex == 16)
				{
					var BestScore = Number.MAX_VALUE;
					var Color1;
					var Color2;

					// Find the two most similar colors to merge
					for(var Index1 = 0; Index1 < Colors.length - 1; Index1++)
					{
						for(var Index2 = Index1 + 1; Index2 < Colors.length; Index2++)
						{
							var C1 = Colors[Index1];
							var C2 = Colors[Index2];

							// Don't merge with reserved background slots
							if(C1.ColorSlotIndex == 32 || C2.ColorSlotIndex == 32)
								continue;

							// Skip large hue jumps when both colors are reasonably saturated
							var deltaH = Math.abs(C1.oklch[2] - C2.oklch[2]);
							if(deltaH > Math.PI)
								deltaH = Math.PI * 2 - deltaH;

							var minC = Math.min(C1.oklch[1], C2.oklch[1]);
							if(minC > 0.05 && deltaH > Math.PI * (40 / 180))
								continue;

							var Distance = OklchDistance(C1.oklch, C2.oklch);
							var lightnessGap = Math.abs(C1.oklch[0] - C2.oklch[0]);
							var chromaGap = Math.abs(C1.oklch[1] - C2.oklch[1]);

							var Score = Distance * (C1.Count + C2.Count) * (1 + lightnessGap) * (1 + chromaGap);

							if(Score < BestScore)
							{
								BestScore = Score;
								Color1 = C1;
								Color2 = C2;
							}
						}					
					}
					
					// Merge the two colors
					if(Color1 == Colors[0])
					{
						// Current pixel matches best with Color2 - merge into Color2
						var W1 = Color1.Count, W2 = Color2.Count, WSum = W1 + W2;
						Color2.Red = Math.round((Color1.Red * W1 + Color2.Red * W2) / WSum);
						Color2.Green = Math.round((Color1.Green * W1 + Color2.Green * W2) / WSum);
						Color2.Blue = Math.round((Color1.Blue * W1 + Color2.Blue * W2) / WSum);
						Color2.oklch = rgbToOklch([ Color2.Red, Color2.Green, Color2.Blue ]);
						Color2.Count = WSum;
					}
					else if(Color1.ColorSlotIndex < Color2.ColorSlotIndex)
					{
						// Merge into Color1, assign new pixel to Color2's slot
						var W1 = Color1.Count, W2 = Color2.Count, WSum = W1 + W2;
						Color1.Red = Math.round((Color1.Red * W1 + Color2.Red * W2) / WSum);
						Color1.Green = Math.round((Color1.Green * W1 + Color2.Green * W2) / WSum);
						Color1.Blue = Math.round((Color1.Blue * W1 + Color2.Blue * W2) / WSum);
						Color1.oklch = rgbToOklch([ Color1.Red, Color1.Green, Color1.Blue ]);
						Color1.Count = WSum;

						Color2.Red = Colors[0].Red;
						Color2.Green = Colors[0].Green;
						Color2.Blue = Colors[0].Blue;
						Color2.oklch = Colors[0].oklch;
						Color2.Count = Colors[0].Count;
					}
					else
					{
						// Merge into Color2, assign new pixel to Color1's slot
						var W1 = Color1.Count, W2 = Color2.Count, WSum = W1 + W2;
						Color2.Red = Math.round((Color1.Red * W1 + Color2.Red * W2) / WSum);
						Color2.Green = Math.round((Color1.Green * W1 + Color2.Green * W2) / WSum);
						Color2.Blue = Math.round((Color1.Blue * W1 + Color2.Blue * W2) / WSum);
						Color2.oklch = rgbToOklch([ Color2.Red, Color2.Green, Color2.Blue ]);
						Color2.Count = WSum;

						Color1.Red = Colors[0].Red;
						Color1.Green = Colors[0].Green;
						Color1.Blue = Colors[0].Blue;
						Color1.oklch = Colors[0].oklch;
						Color1.Count = Colors[0].Count;
					}
				}
			}
		}
		
		// Quantize final slot colors and store spectrum palette
		var SpectrumColors = [];
				
		for(var SlotIndex = 0; SlotIndex < 48; SlotIndex++)
		{
			ColorSlots[SlotIndex].Red = Math.round(Math.round(ColorSlots[SlotIndex].Red * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Green = Math.round(Math.round(ColorSlots[SlotIndex].Green * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].Blue = Math.round(Math.round(ColorSlots[SlotIndex].Blue * ShadesScale) * InverseShadesScale);
			ColorSlots[SlotIndex].oklch = rgbToOklch([ ColorSlots[SlotIndex].Red, ColorSlots[SlotIndex].Green, ColorSlots[SlotIndex].Blue ]);

			SpectrumColors.push({ 
				Red: ColorSlots[SlotIndex].Red, 
				Green: ColorSlots[SlotIndex].Green, 
				Blue: ColorSlots[SlotIndex].Blue, 
				oklch: ColorSlots[SlotIndex].oklch 
			});
		}
		ImageInfos.SpectrumPalettes.push(SpectrumColors);

		// Remap pixels to the best matching color from the 16 available at each X position
		for(var X = 0; X < Canvas.width; X++)
		{
			var PixelIndex = (X + Y * WorkCanvas.width) * 4;
			var DisplayPixelIndex = (X + Y * Canvas.width) * 4;

			var Red = WorkData[PixelIndex];
			var Green = WorkData[PixelIndex + 1];
			var Blue = WorkData[PixelIndex + 2];
			var Alpha = WorkData[PixelIndex + 3];

			if(Red < 0) Red = 0; else if(Red > 255) Red = 255;
			if(Green < 0) Green = 0; else if(Green > 255) Green = 255;
			if(Blue < 0) Blue = 0; else if(Blue > 255) Blue = 255;
			
			if(Alpha == 255)
			{
				var PixelOklch = rgbToOklch([ Red, Green, Blue ]);

				var LastDistance = Number.MAX_VALUE;
				var RemappedColor = { Red: 0, Green: 0, Blue: 0 };
				
				for(var ColorIndex = 0; ColorIndex < 16; ColorIndex++)
				{
					var SlotIndex = GetColorSlotIndex(X, ColorIndex);
					var SpectrumColor = ColorSlots[SlotIndex];
					
					var Distance = OklchDistance(PixelOklch, SpectrumColor.oklch);

					if(Distance < LastDistance)
					{
						RemappedColor.Red = SpectrumColor.Red;
						RemappedColor.Green = SpectrumColor.Green;
						RemappedColor.Blue = SpectrumColor.Blue;
						
						LastDistance = Distance;
					}
				}

				Data[DisplayPixelIndex] = RemappedColor.Red;
				Data[DisplayPixelIndex + 1] = RemappedColor.Green;
				Data[DisplayPixelIndex + 2] = RemappedColor.Blue;
				Data[DisplayPixelIndex + 3] = 255;
			}
		}
	}
	
	Context.putImageData(ImageData, 0, 0);
}
