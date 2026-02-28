# Spectrum 512 Painter

A GEM-style paint program for Atari ST fans, running in a modern web browser.

If you miss the old desktop feel, toolbox, and classic drawing flow, this is built for that.

## What You Can Do Right Now

- Open ST-style picture files (`.IMG`, `.SPU`) and normal images (PNG/JPG/GIF/WebP/BMP).
- Draw with classic tools like pencil, line, fill, spray, rectangle, ellipse, and more.
- Pick colors from a full palette, with foreground/background swatches.
- Turn Spectrum mode on/off in the `Color` menu.
- Choose target color style:
  - `512 (ST)`
  - `4096 (STE)`
  - `32768 (STE Enhanced)`
- Save work as `.SPU` or export as `.PNG`.

## How To Start

1. Open a terminal in this folder.
2. Run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open [http://localhost:8000](http://localhost:8000) in your browser.

## Quick User Guide

- `File -> Open...` to load a picture.
- Choose a tool from the left toolbox.
- Left-click a color tile to set foreground color.
- Right-click a color tile to set background color.
- Use `Color -> Spectrum 512 On/Off` to switch Spectrum conversion.
- `File -> Save` stores as `.SPU`; `File -> Export...` writes `.PNG`.

## What Is Still In Progress

- `Zoom`, `Marquee`, and `Text` tool icons are shown but not active yet.
- Pattern tiles are shown and selectable, but not yet painting into the image.
- Some menu entries are still placeholders for future work.
- Keyboard shortcuts shown in menus are not all wired yet.

## Project Notes

- The look and wording follow classic GEM style.
- The app is self-contained in this repository (no external frameworks).
- Extra reference docs are in `doc/`:
  - `CLASSIC_GUI_GUIDELINES.md`
  - `CLASSIC_SCROLLBAR_BEHAVIOR.md`
  - `GEM_Raster_IMG_Format.md`
