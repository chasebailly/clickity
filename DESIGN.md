---
name: Clickity
description: A compact timing console for quick, dependable desktop click automation.
colors:
  carbon: "#101214"
  graphite: "#17191c"
  graphite-raised: "#212429"
  graphite-active: "#2a2e34"
  border: "#3b3f45"
  border-soft: "#2d3035"
  warm-white: "#f5f5f1"
  muted-steel: "#969aa1"
  bright-steel: "#c4c7cd"
  signal-chartreuse: "#b9e643"
  signal-ink: "#11130e"
  warning-amber: "#f0bd68"
  danger-coral: "#ff827d"
typography:
  display:
    fontFamily: "Roboto Condensed Variable, Roboto Condensed, sans-serif"
    fontSize: "clamp(34px, 7vw, 47px)"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.045em"
    fontVariation: '"wdth" 82'
  headline:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 780
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 740
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.45
  label:
    fontFamily: "Manrope Variable, Manrope, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.35
rounded:
  key: "5px"
  control: "9px"
  rail: "10px"
  panel: "12px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "28px"
components:
  timing-console:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.warm-white}"
    typography: "{typography.display}"
    rounded: "{rounded.panel}"
    padding: "14px 11px 12px"
  segment-default:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bright-steel}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "43px"
  segment-selected:
    backgroundColor: "{colors.signal-chartreuse}"
    textColor: "{colors.signal-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "43px"
  button-secondary:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.bright-steel}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "34px"
  input-compact:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.warm-white}"
    typography: "{typography.display}"
    rounded: "{rounded.control}"
    padding: "12px 10px 2px"
    height: "45px"
  run-dock:
    backgroundColor: "{colors.signal-chartreuse}"
    textColor: "{colors.signal-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "0 16px"
    height: "82px"
---

# Design System: Clickity

## Overview

**Creative North Star: "The Timing Console"**

Clickity feels like a small, purpose-built instrument brought forward only when a gaming session needs it. Matte carbon surrounds graphite controls, while warm white language and crisp steel annotations keep the interface readable without turning it into a dense desktop form.

The system puts timing first and treats chartreuse as an operational signal rather than decoration. Broad rails, condensed numerals, and a persistent run dock create a quick top-to-bottom path: set the cadence, choose behavior, confirm the target, and act. The result is modern and technical without borrowing the neon, glass, or dashboard conventions common to gaming utilities.

**Key Characteristics:**

- Matte, near-black tonal layering with restrained ambient depth.
- One high-contrast chartreuse signal for selection, focus, capture, and run state.
- Friendly Manrope interface language paired with compact Roboto Condensed instrument numerals.
- Continuous timing fields, broad segmented rails, and a persistent action dock.
- Compact, direct copy that keeps operating state visible.

## Colors

The palette is a controlled carbon-to-steel neutral range activated by a single yellow-green operational signal; amber and coral appear only for semantic feedback.

### Primary

- **Signal Chartreuse:** Marks selected segments, focus, capture state, and the run dock. Its dark companion ink keeps text and icons legible on the bright field.

### Neutral

- **Carbon:** The uninterrupted application canvas and the darkest key-cap surface.
- **Graphite:** The base surface for the timing console and compatibility notices.
- **Raised Graphite:** The standard fill for inputs, segmented controls, steppers, and secondary buttons.
- **Active Graphite:** The hover lift for neutral controls.
- **Border and Soft Border:** Separate major panels from the canvas and divide compact controls without high-contrast outlines.
- **Warm White:** Primary copy, headings, and focus contrast.
- **Muted Steel:** Supporting labels, instructions, and low-priority status text.
- **Bright Steel:** Readable secondary control copy and summary text.

### Semantic

- **Warning Amber:** Compatibility and short-interval cautions.
- **Danger Coral:** Validation and runtime errors.

### Named Rules

**The One Signal Rule.** Chartreuse communicates an active or actionable state; keep it rare enough that selection and run state remain instantly legible.

**The Matte Spectrum Rule.** Build hierarchy from carbon and graphite layers, never from decorative gradients, glass, or saturated gamer lighting.

## Typography

**Display Font:** Roboto Condensed Variable (with Roboto Condensed and sans-serif fallbacks)  
**Body Font:** Manrope Variable (with Manrope, system-ui, and sans-serif fallbacks)  
**Label/Mono Font:** Manrope Variable for labels; Roboto Condensed Variable for numeric readouts and keycaps

**Character:** Manrope keeps the utility approachable and contemporary. Roboto Condensed gives time values, coordinates, counts, and shortcuts the efficient cadence of an instrument panel.

### Hierarchy

- **Display** (650, fluid 34–47px, 1 line-height): The dominant interval values; slightly compressed width and tight tracking make four fields readable in one strip.
- **Headline** (780, 34px, 0.98 line-height): The compact product wordmark.
- **Title** (740, 14px, 1.2 line-height): Section headings and rail labels.
- **Body** (600, 13px, 1.45 line-height): Summaries, descriptive copy, and operational guidance.
- **Label** (700, 10px, 1.35 line-height): Field names, button labels, helper text, and keycap annotations.

### Named Rules

**The Instrument Pairing Rule.** Use Manrope for language and Roboto Condensed for values, coordinates, counts, and shortcuts; do not use the condensed face as a decorative display font.

## Layout

The application is a single centered column capped at 680px, with 28px horizontal breathing room and a compact 14px vertical rhythm. The first viewport moves from brand to a continuous four-part timing strip, then three full-width setting rails, shortcut control, and the persistent run dock.

Control rails use a 126px label column and a fluid control column. At 540px the rails stack their labels over controls and the action dock becomes a vertical status-and-action block. At 430px compound position and repeat controls stack; at 350px the four-part interval strip becomes a two-by-two grid.

**The Continuous Rail Rule.** Keep each task on one broad horizontal rail at desktop widths; use internal segmentation instead of scattering settings into unrelated cards.

## Elevation & Depth

Depth is primarily tonal: carbon canvas, graphite panel, then raised graphite controls. Two soft ambient shadows support the timing console, segmented controls, and action dock without making surfaces appear glossy or detached.

### Shadow Vocabulary

- **Control Lift** (`0 7px 16px rgba(0, 0, 0, 0.12)`): Segmented controls and secondary buttons.
- **Panel Lift** (`0 14px 32px rgba(0, 0, 0, 0.16)`): The timing console.
- **Dock Lift** (`0 14px 36px rgba(0, 0, 0, 0.22)`): The persistent run dock.

### Named Rules

**The Tonal Lift Rule.** Establish hierarchy with surface tone and one-pixel borders first; shadows remain soft, black, and subordinate.

## Shapes

The form language is gently technical rather than pill-shaped: compact controls use 9px corners, bordered rails use 10px, and dominant panels use 12px. Keycaps use tighter 5px corners. Circular geometry is reserved for the target mark and runtime status dot.

**The Soft Containment Rule.** Round containers enough to separate them from the carbon canvas, but preserve straight internal divisions so controls still read as instruments.

## Components

### Buttons

- **Shape:** Neutral controls use gently rounded 9px corners; the primary action is integrated into the 12px run dock.
- **Primary:** A large transparent action zone sits on the chartreuse dock with dark icon, label, keycap, and a dividing line from status.
- **Hover / Focus:** Primary hover adds a subtle white tint. Keyboard focus uses a two-pixel chartreuse outline with two-pixel offset on neutral surfaces.
- **Secondary:** Raised graphite, bright steel copy, a soft border, and restrained ambient lift. Hover moves to active graphite and warm white.

### Cards / Containers

- **Corner Style:** Dominant panels use 12px corners; setting rails use 10px.
- **Background:** Timing content uses graphite while standard rails remain on the carbon canvas and rely on borders.
- **Shadow Strategy:** Use the ambient vocabulary from Elevation & Depth only for controls or persistent operational surfaces.
- **Border:** One-pixel graphite borders; internal divisions are softer than panel edges.
- **Internal Padding:** Compact 10–14px spacing keeps the utility fast and information-dense.

### Inputs / Fields

- **Style:** Numeric fields use raised graphite, warm white condensed numerals, and 9px corners. The four timing inputs remove individual boxes and share one continuous console.
- **Focus:** Shift the border to chartreuse and add a restrained translucent chartreuse ring; timing fields use a chartreuse inset baseline.
- **Error / Disabled:** Errors use coral copy. Disabled fields and buttons retain their form but drop to 45% opacity.

### Segmented Controls

- **Style:** A single raised graphite frame contains adjoining options separated by dark one-pixel dividers.
- **State:** The selected segment becomes a solid chartreuse field with dark ink; unselected options stay bright steel. Focus remains visible inside the clipped frame.

### Timing Console

Four large condensed numeric fields share one graphite panel and a centered natural-language interval summary. Internal dividers preserve field boundaries, while the active field gains a chartreuse baseline instead of a detached outline.

### Run Dock

The run dock joins status and primary action on one chartreuse surface. It stays at the bottom of the task flow, carries live phase copy, and uses a pulsing dark status dot only while starting, capturing, or running; reduced-motion preferences collapse that animation.

## Do's and Don'ts

### Do:

- **Do** reserve chartreuse for selections, focus, capture, and the primary operational dock.
- **Do** keep timing and other numeric values in the condensed instrument face.
- **Do** use tonal graphite layers and one-pixel borders before adding ambient shadow.
- **Do** keep state copy visible beside the primary start/stop action.
- **Do** preserve the stacked responsive behavior and reduced-motion fallback.

### Don't:

- **Don't** imitate legacy autoclicker form stacks; settings belong in a short sequence of continuous rails.
- **Don't** introduce neon gradients, glass panels, glows, or ornamental gamer-dashboard chrome.
- **Don't** turn every surface into a floating card or every control into a pill.
- **Don't** use chartreuse as decorative fill when it does not communicate state or action.
- **Don't** separate timing values into unrelated boxed inputs; the continuous timing console is the signature component.
