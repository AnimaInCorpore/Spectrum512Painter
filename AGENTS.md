# Spectrum512Painter - Agent Guidelines

## Project Purpose
This project is a painting program for the **Spectrum512 Atari ST image format**.

## Core Technical Constraints
- Use **HTML5/WebGL** technology only.
- Use **no external dependencies** (no third-party libraries, frameworks, or CDNs).
- Keep the implementation self-contained in this repository.

## UI/UX Direction
- The website shall mimic an **ancient Atari GEM-like GUI**.
- Use **proper GEM-style English text** for all visible GUI labels, menus, and captions.
- Favor classic windowed desktop styling:
  - flat grayscale panels,
  - beveled borders,
  - pixel-like iconography,
  - retro menu/toolbox layout,
  - minimal modern visual effects.
- Prioritize usability for pixel-art / retro paint workflows while preserving the GEM aesthetic.

## Tool Behavior Reference (MacPaint-derived)
GEM Paint was modeled after MacPaint. Use MacPaint as the authoritative reference for tool behavior. The GEM visual style (see above) always takes precedence over any Mac-specific aesthetics.

### Drawing Tools
- **Pencil**: Freehand 1-pixel drawing. Toggles pixels (drawing on black inverts to white, on white to black). Shift-drag constrains to straight horizontal/vertical/diagonal lines.
- **Brush**: Freehand painting using the selected brush shape and current pattern. Shift-drag constrains to straight lines. Brush shape is chosen from a palette of selectable shapes.
- **Spray Can**: Scatters pixels randomly in a circular area around the cursor. Density increases the longer the mouse is held still.
- **Eraser**: Paints over pixels with the background color/pattern. Double-click clears the entire visible canvas area. All tools remain usable in FatBits (zoom) mode.
- **Fill (Paint Bucket)**: Flood-fills an enclosed area with the current pattern. If the boundary has gaps, fill leaks through — this is intentional classic behavior.

### Selection Tools
- **Rectangle Select**: Defines a rectangular region. Supports move, cut, copy, paste, flip horizontal/vertical, rotate 90°, and color invert on the selection.
- **Lasso**: Freehand irregular selection that automatically snaps/shrinks to the content outline. Same operations as rectangle select apply.

### Shape Tools
- **Line**: Draws a straight line from click to release. Thickness follows the current line-size setting. Shift constrains to 45° angle increments.
- **Rectangle / Rounded Rectangle**: Available in two variants — outline only, or filled with the current pattern. Shift constrains to a perfect square.
- **Oval / Circle**: Same two variants as rectangle. Shift constrains to a perfect circle.

### Text Tool
- Allows typing in a selectable font, size, and style (bold, italic, etc.). Text is committed to the canvas as pixels — it becomes part of the bitmap and is no longer editable after confirmation.

### FatBits (Zoom Mode)
- Magnifies the canvas (8× scale) so individual pixels are visible and clickable as enlarged squares. All drawing tools remain fully functional in this mode. A small navigator inset shows the unzoomed position.

### Patterns & Brushes
- A palette of 38 predefined tileable 8×8 monochrome patterns is available for fill, brush, and shape tools. Patterns should be user-editable.
- Brush shapes (at least a basic set) are selectable from a palette.

### Canvas & Navigation
- The canvas is larger than the visible viewport and is scrollable via a Hand tool or scrollbars.
- Zoom levels should range from at least 1× to 8× (FatBits). Lower zoom-out levels are also useful for overview.
- Shift is the universal constraint modifier: straight lines, square shapes, circular ovals.
