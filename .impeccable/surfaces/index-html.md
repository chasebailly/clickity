---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["src/main.ts", "src/styles.css"]
---

## Scope and Mode

Operate mode for Clickity's primary desktop window.

## Audience and Job

Gaming-focused users open Clickity for a session, configure repeated clicking quickly, start or stop it with confidence, and close it when finished.

## Chosen Direction

Quick Panel with the Timing-led / Interval First composition. The approved north-star comp is `.impeccable/mocks/quick-panel-interval-first.webp`.

The four-part interval is the signature control: hours, minutes, seconds, and milliseconds form one continuous timing strip with an immediate human-readable summary. Mouse button, repeat mode, and cursor position follow as broad segmented rows. The shortcut sits above a sticky action dock that keeps runtime state and Start/Stop visible.

## Visual and Interaction Commitments

- Carbon and graphite matte surfaces with warm off-white text, chartreuse active states, and steel secondary marks.
- Layered quick-settings tray, broad selection rails, chunky segmented controls, strong spacing, medium corners, restrained one-pixel borders, and low elevation.
- Compact humanist interface typography with a narrower, highly legible numeral style for timing values.
- Familiar desktop form semantics and keyboard navigation remain intact; the gaming association comes from the control rhythm rather than RGB effects or game-themed decoration.
- Fixed-position capture uses a dedicated confirmation key: the user selects Capture, Clickity minimizes, the user moves the pointer to the target, and pressing `F7` records the coordinates and restores the window.
- `F7` is reserved for coordinate capture only while capture mode is active. The configurable start/stop shortcut remains independent and defaults to `F6`; capture mode must prevent either shortcut from starting a click run.
- The capture flow needs explicit states for waiting, successful capture, cancellation, shortcut-registration failure, and restoration if the window cannot minimize or regain focus.

## Comp Translation

- Preserve the interval-first hierarchy, continuous timing strip, broad mode rows, and bottom action dock.
- Treat generated lettering, icons, shadows, and exact pixel dimensions as art-direction guidance rather than rasterized UI.
- Implement all controls, text, focus states, validation, runtime states, and responsive behavior as semantic code.
- Do not invent presets, profiles, statistics, accounts, cloud features, or game integrations.

## Unresolved Decisions

Production implementation has not started. Exact font files and the final icon source remain to be selected during the build while preserving the approved silhouettes and hierarchy.
