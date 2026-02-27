# Classic Scrollbar Behavior (Mac/GEM-inspired)

This project follows classic GUI behavior for document windows, adapted to the GEM-style UI used here.

## Historical Reference

Primary reference: Apple Human Interface Guidelines (classic era), "Scrolling a Window" (1996-07-29 mirror):
- https://dev.os9.ca/techpubs/mac/HIGuidelines/HIGuidelines-121.html

Key historical points:
- If content is not larger than the view, scroll bars stay visible but inactive.
- Inactive bars use non-active visuals (for example hollow arrows, no active thumb/track behavior).
- For fixed-size documents smaller than the window, showing neutral gray around the document is acceptable.
- If content exceeds the view in an axis, that axis scrollbar becomes active.

## Project Compliance Rules

Use these rules for the canvas window:

1. Small content (fits viewport in both axes)
- Keep both scrollbars visible in an inactive visual state.
- Disable scrolling actions and thumb dragging.
- Keep canvas offset at origin.

2. Mixed overflow (fits one axis, exceeds the other)
- Keep both bars visible for period-correct look.
- Activate only the overflowing axis.
- Non-overflowing axis remains inactive.

3. Large content (exceeds in both axes)
- Both axes active with normal classic thumb/track behavior.

4. Canvas surround area
- When image/canvas is smaller than the viewport, fill uncovered area with a neutral window background (classic gray/white style matching GEM panel rules), not modern effects.

5. Zoom interaction
- Evaluate overflow using effective rendered canvas size (after zoom).
- As zoom crosses fit/overflow thresholds, scrollbar active/inactive states update immediately.

## Implementation Notes

- Keep logic modular in `js/canvas/viewport.js`.
- Keep visuals in CSS (`index.html` styles currently), with explicit classes for active vs inactive states.
- Do not remove classic controls entirely when inactive; prefer visible-but-disabled behavior for authenticity.
