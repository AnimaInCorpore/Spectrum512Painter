# Sprite test assets

- `space-320x200.png`: 320 × 200 RGB background, resized from the repository's original `space.png`.
- `sprite-32x32.png`: 32 × 32 RGBA sphere with binary alpha (0 or 255). The sphere was extracted from `sprite.png` and tightly framed before reduction.
- `sprite-mask-32x32.png`: 32 × 32 monochrome mask. White draws the sprite; black preserves the background.
- `sprite-mask-32x32.bin`: the same mask packed into 128 bytes, without a header. Rows run top to bottom, four bytes per row; bit 7 of the first byte is the leftmost pixel. Set bits draw the sprite. Each row can be read as two big-endian 16-bit words on the STE.
- `preview.png`: source-color composite with the sprite's top-left corner at (144, 84).

The sprite contains 701 opaque pixels and 323 transparent pixels. The PNG alpha, PNG mask, and packed mask describe the same coverage. No soft alpha blending is required.

These are source assets for the STE 4096-color conversion experiment, not pre-encoded Spectrum 512 images or fixed sprite bitplanes. Composite the sprite into the source image, then run the Spectrum converter with `bitsPerColor: 4` on the affected rows. The resulting line palettes determine the sprite's final pixel indices. Use Checks dithering for independent row updates; vertical error diffusion would propagate changes below those rows. Sprite movement also dirties the old sprite position.

Original root-level images are preserved. Background resizing used `sips`; sprite resizing and binary mask extraction used FFmpeg. Neither is a runtime dependency of the painter.

## Extraction provenance

The built-in image-generation tool was used for the sphere background extraction. The exact prompt was:

> Use case: background-extraction. Edit target is the attached sprite.png, a grayscale shaded sphere on black. Remove only the black exterior background and output the sphere on actual transparent alpha. Preserve the original sphere's precise smooth grayscale shading, upper-left white highlight, dark bottom/right, circular silhouette, proportions and orientation. No redesign, no added reflection, outline, drop shadow, texture, color or scene. Tightly crop to a square around the circular sphere with minimal transparent padding; the entire sphere must remain visible. Asset is for a 32x32 Atari STE sprite, so retain a clean circular silhouette. Transparent background, not a checkerboard baked into pixels.
