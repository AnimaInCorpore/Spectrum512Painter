# GEM Raster (IMG) File Format Documentation

> Sources:
> - https://www.fileformat.info/format/gemraster/egff.htm
> - https://netghost.narod.ru/gff/graphics/summary/gemras.htm
> - http://fileformats.archiveteam.org/wiki/GEM_Raster
> - https://www.seasip.info/Gem/ff_img.html

---

## Overview

GEM Raster (also known as **IMG**) is the native image storage format for the **Graphical Environment Manager (GEM)**, developed and marketed by Digital Research. It is used on Atari ST and related platforms.

| Property         | Value                          |
|------------------|-------------------------------|
| Type             | Bitmap                        |
| File Extension   | `.IMG`                        |
| Colors           | Up to 16,384                  |
| Compression      | RLE (Run-Length Encoding)     |
| Maximum Size     | 64K × 64K pixels              |
| Endianness       | **Big-endian**                |
| Multiple images  | No                            |

---

## File Structure

A GEM Raster file consists of a **fixed-length header** followed by **RLE-encoded bitmap data**.

---

## Header Format

The header is either **16 bytes** (8 WORDs) or **18 bytes** (9 WORDs):

```c
typedef struct _GemRaster {
    WORD Version;        /* Always 0x0001                                        */
    WORD HeaderLength;   /* Header size in WORDs: 8 (GEM Paint) or 9 (Ventura)  */
    WORD NumberOfPlanes; /* 1 = monochrome, 4 = 16-color, 8 = greyscale         */
    WORD PatternLength;  /* Pattern length in bytes (1–8); GEM Paint uses 2     */
    WORD PixelWidth;     /* Pixel width in tenths of mm (e.g. 85 = 8.5 mm/100) */
    WORD PixelHeight;    /* Pixel height in tenths of mm                        */
    WORD ScanLineWidth;  /* Image width in pixels                               */
    WORD NumberOfLines;  /* Image height in scan lines                          */
    WORD BitImageFlag;   /* Multi-plane flag (9-WORD header only)               */
} GEMHEAD;
```

### Field Descriptions

| Field           | Size  | Description |
|-----------------|-------|-------------|
| `Version`       | WORD  | Always `1`. |
| `HeaderLength`  | WORD  | `8` = GEM Paint variant; `9` = Ventura Publisher variant (adds `BitImageFlag`). Some programs crash on GEM Paint files or render them as greyscale, being unaware of the distinction. |
| `NumberOfPlanes`| WORD  | `1` = monochrome, `4` = 16-color, `8` = greyscale. |
| `PatternLength` | WORD  | Pattern length in bytes, range **1–8**. GEM Paint uses `2`. |
| `PixelWidth`    | WORD  | Width of one pixel in **tenths of a millimeter**. Used for aspect ratio, not absolute size. |
| `PixelHeight`   | WORD  | Height of one pixel in **tenths of a millimeter**. |
| `ScanLineWidth` | WORD  | Image width in pixels. |
| `NumberOfLines` | WORD  | Image height in scan lines. |
| `BitImageFlag`  | WORD  | Present only when `HeaderLength` = 9. `0` = color (multi-plane); `1` = greyscale (multi-plane). |

---

## Compression Scheme

Image data in GEM Raster files is **always RLE-encoded**. Four code types are used:

### 1. Vertical Replication Code

```
00 00 FF <Run Count>
```

- Repeats the **next decoded scan line** `Run Count` times (a count of `1` means 2 identical lines total).
- Must appear only at the **beginning** of a scan line.

### 2. Literal Run Code

```
80 <Count: 1–127> <Count bytes of raw pixel data>
```

- Copies `Count` bytes of uncompressed pixel data directly to output.
- Used when RLE compression would be inefficient.

### 3. Pattern Code

```
00 <Pattern Length> <Pattern Data bytes>
```

- Repeats the given pattern data according to the `PatternLength` field in the header.

### 4. Encoded Run Codes (Black / White Runs)

- **Single byte** that is neither `00h` nor `80h`.
- **MSB = 1** → black pixel run; **MSB = 0** → white pixel run.
- **7 LSBs** = run length in pixels (1–127).

### Example Encoded Scan Line

```
00 00 FF 05  07  8A  02  80 04 2A 14 27 C9  00 03 AB CD EF
```

Decoded:
- `00 00 FF 05` → Vertical replication: repeat next scan line 5 times
- `07`          → 7 white bytes (56 white pixels)
- `8A`          → 10 black bytes (80 black pixels)
- `02`          → 2 white bytes (16 white pixels)
- `80 04 2A 14 27 C9` → Literal run of 4 bytes
- `00 03 AB CD EF`    → Pattern code of 3 bytes

---

## Multi-Plane Images

The image data consists of `image_height × planes` rows total. For multi-plane images the rows are interleaved by screen line: the first `planes` rows contain all color plane data for the first screen line, the next `planes` rows for the second screen line, and so on.

The plane order for 4-plane (16-color) images is:

1. Red
2. Green
3. Blue
4. Intensity

> Scan lines are always **byte-aligned** (width must be a multiple of 8 pixels; padding is added as needed).
>
> RLE records **do not span multiple rows** — each row is encoded independently.

---

## Color Palettes

### Standard 16-Color GEM Palette

RGB values (each component in range 0x00–0x3F):

| Index | R    | G    | B    |
|-------|------|------|------|
| 0     | 0x3F | 0x3F | 0x3F |
| 1     | 0x3F | 0x00 | 0x00 |
| 2     | 0x00 | 0x3F | 0x00 |
| 3     | 0x3F | 0x3F | 0x00 |
| 4     | 0x00 | 0x00 | 0x3F |
| 5     | 0x3F | 0x00 | 0x3F |
| 6     | 0x00 | 0x3F | 0x3F |
| 7     | 0x2B | 0x2B | 0x2B |
| 8     | 0x15 | 0x15 | 0x15 |
| 9     | 0x2B | 0x00 | 0x00 |
| 10    | 0x00 | 0x2B | 0x00 |
| 11    | 0x2B | 0x2B | 0x00 |
| 12    | 0x00 | 0x00 | 0x2B |
| 13    | 0x2B | 0x00 | 0x2B |
| 14    | 0x00 | 0x2B | 0x2B |
| 15    | 0x00 | 0x00 | 0x00 |

### 8-Bit Grayscale

256 grayscale values arranged in a dithered pattern (16 rows × 16 columns). Used when `BitImageFlag` = `1` in a multi-plane file.

---

## Key Constraints & Notes

- All multi-byte values are **big-endian** (signed 16-bit words).
- Scan line width must be a **multiple of 8 pixels** (byte-aligned); padding bits are added when needed.
- RLE records do not span multiple rows — each row is encoded independently.
- Almost all IMG files in the wild are **monochrome single-plane** because the original format did not specify a method of storing palette information.
- The XIMG variant (version `2`) extends the format with embedded palette data.
- **Paint Shop Pro** further extends the format with an 8-plane greyscale variant.
- Aspect ratio is determined by the `PixelWidth`/`PixelHeight` fields, not by absolute measurements.
- Several unrelated formats also use the `.IMG` extension — this can cause confusion in applications that assume `.IMG` = GEM Raster.
