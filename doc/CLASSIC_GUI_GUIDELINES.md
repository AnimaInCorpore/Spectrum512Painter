# Classic GUI Guidelines (GEM-style, MacPaint-era behavior)

This document defines the canonical GUI behavior and visual rules for Spectrum512Painter.
It is intentionally strict to keep the interface coherent and period-correct.

## 1. Design Intent

- Emulate an Atari GEM desktop application with late-1980s/early-1990s interaction patterns.
- Prefer clarity and predictability over modern minimalism.
- Keep UI text and control names in proper English with classic desktop terminology.
- Avoid modern UI conventions unless explicitly required by platform constraints.

## 2. Visual Language

### 2.1 Color and Surfaces

- Primary UI palette is grayscale (white, light gray, medium gray, black).
- Use dither patterns sparingly for texture and inactive/background regions.
- Avoid gradients, blur, transparency effects, drop-shadows, and glassmorphism.
- Keep strong contrast on edges and active controls.

### 2.2 Borders and Relief

- Use 1px/2px beveled borders to indicate raised vs sunken controls.
- Raised controls: light edge top/left, dark edge bottom/right.
- Sunken controls (fields, canvas viewport, pressed buttons): inverted bevel.
- Keep bevel style consistent across all panels and controls.

### 2.3 Typography

- Use pixel-like/bitmap-like display fonts where available.
- Use short labels with title-case or classic menu capitalization.
- Do not use emoji, decorative glyphs, or modern icon-font symbols.

## 3. Window Model

### 3.1 Main Window

- Keep title bar with classic affordances: close box, title text, full-size gadget.
- Keep tool palette, canvas window, and pattern panel visually separated by bevels.
- Avoid floating translucent overlays except explicit modal dialogs.

### 3.2 Canvas Area

- Canvas sits in a distinct viewport frame with classic recessed look.
- When image is smaller than viewport, uncovered area should use neutral classic fill.
- When image/zoom exceeds viewport, scrolling is enabled per axis.
- Follow `doc/CLASSIC_SCROLLBAR_BEHAVIOR.md` for exact scrollbar policy.

## 4. Menus

### 4.1 Menu Bar Structure

- Top-level menus should remain short and stable (Desk, File, Edit/Options, Block, Color, etc.).
- Keep menu order stable across releases.
- Do not hide core commands in secondary overflow menus.

### 4.2 Menu Text and Layout

- Use concise verbs/nouns with ellipsis on commands that open a dialog:
  - `Open...`, `Save As...`, `Image Size...`
- Show keyboard shortcuts in a dedicated right-aligned column where applicable.
- Use separators only to group meaningful clusters.

### 4.3 Menu Behavior

- Menus open on click and close on outside click or command activation.
- Disabled items remain visible but inactive (never removed).
- Checked/toggled items should have an explicit indicator.
- Keep submenu depth minimal (prefer at most one nested level).

## 5. Dialogs and Alerts

### 5.1 General Dialog Rules

- Use modal dialogs for actions requiring explicit confirmation.
- Dialog titles and button captions must be action-specific and plain English.
- Keep default action obvious; map Enter to default and Esc to cancel where possible.
- Focus first actionable control when dialog opens.

### 5.2 Confirmations

- Ask confirmation for destructive actions:
  - clear canvas
  - overwrite file
  - discard unsaved changes
- Use two-button minimum (`Cancel` + explicit action label, not `OK` when possible).

### 5.3 Error Alerts

- State what failed, why (if known), and what the user can do next.
- Do not expose raw stack traces in UI dialogs.
- Keep wording short and concrete.

## 6. Icons and Tool Buttons

### 6.1 Icon Style

- Use monochrome or limited-palette pixel icons.
- Maintain consistent 1px line weight and grid alignment.
- Avoid anti-aliased, photoreal, or multicolor modern icon styles.

### 6.2 Tool Button States

- Support clear states: normal, hover (optional subtle), pressed, active, disabled.
- Active tool must remain visibly latched.
- Hit areas should be generous enough for precise retro workflows.

### 6.3 Tool Identity

- Preserve stable `data-tool` identifiers.
- Icon changes must not alter tool IDs or command semantics.

## 7. Controls

### 7.1 Buttons

- Use beveled rectangular buttons with consistent padding.
- Pressed state should invert relief immediately on pointer down.
- Disabled buttons remain visible with reduced contrast.

### 7.2 Sliders and Numeric Controls

- Keep slider track/thumb geometry pixel-aligned.
- Couple sliders with explicit numeric value readouts where precision matters.
- Keyboard increment/decrement should be supported when focused.

### 7.3 Lists and Palettes

- Use strict grid layout for pattern and brush palettes.
- Selection must be visible at all times with a clear border/inset cue.
- Keep spacing and tile dimensions constant to preserve rhythm.

## 8. Scrollbars

- Scrollbars are always classic-styled, not OS-native themed widgets.
- Behavior and active/inactive states must match `doc/CLASSIC_SCROLLBAR_BEHAVIOR.md`.
- Drag thumb, track click paging, arrow stepping, and wheel input should remain consistent.

## 9. Pointer, Keyboard, and Interaction Rules

### 9.1 Pointer

- Keep crosshair cursor in drawable canvas context.
- Use pointer cursor for clickable controls.
- Keep drag feedback immediate and deterministic.

### 9.2 Keyboard

- Provide canonical shortcuts for core file/edit actions where implemented.
- `Shift` is the universal geometric constraint modifier.
- Keyboard behavior must never conflict with text-entry contexts.

### 9.3 Input Priority

- Tool actions take precedence over decorative hover effects.
- Avoid delayed interactions or animated transitions that obscure precision work.

## 10. Content and Terminology

- Prefer classic wording: `Desk`, `File`, `Open...`, `Save As...`, `Quit`.
- Keep labels consistent across menus, dialogs, tooltips, and docs.
- Avoid modern product language and marketing phrasing.

## 11. Responsiveness and Scaling

- UI must remain functional on desktop and smaller screens.
- Preserve panel hierarchy and control legibility before adding adaptive rearrangements.
- Keep pixel-art fidelity (`image-rendering: pixelated`) in canvas display paths.

## 12. Implementation Policy

- Keep behavior modular:
  - `js/ui/*` for menus/tools/pattern UI
  - `js/canvas/*` for viewport and scroll behavior
  - `js/tools/*` for tool semantics
- Avoid monolithic handlers; split by responsibility.
- No third-party UI libraries or dependencies.

## 13. Change Control Checklist

When changing UI, verify:

1. Period-correct visuals (bevels, grayscale, icon style) are preserved.
2. Menu labels/ordering remain stable and in classic English.
3. Disabled/inactive states are visible, not removed.
4. Canvas/scroll behavior still matches classic rules.
5. Tool IDs and command semantics remain stable.
6. Desktop and smaller viewport layouts are still usable.

## 14. References

- Apple Human Interface Guidelines (classic mirror), Scrolling a Window:
  - https://dev.os9.ca/techpubs/mac/HIGuidelines/HIGuidelines-121.html
- Project-specific scrolling policy:
  - `doc/CLASSIC_SCROLLBAR_BEHAVIOR.md`
