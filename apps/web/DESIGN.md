---
name: CPSync
description: A calm operations desk for people, leave, and delivery.
colors:
  evergreen: '#165c46'
  evergreen-deep: '#0f4535'
  forest: '#123d30'
  leaf: '#d8e9bc'
  canvas: '#f4f7f5'
  paper: '#ffffff'
  ink: '#16251f'
  ink-muted: '#607068'
  line: '#e0e8e3'
  success-soft: '#dff3e5'
  warning-soft: '#fff0c7'
  danger-soft: '#fde3e3'
typography:
  micro:
    fontSize: '0.6875rem'
    fontWeight: 600
  caption:
    fontSize: '0.75rem'
    fontWeight: 400
  headline:
    fontFamily: 'Arial, Helvetica, sans-serif'
    fontSize: '2rem'
    fontWeight: 700
    letterSpacing: '-0.9px'
  body:
    fontFamily: 'Arial, Helvetica, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
  label:
    fontFamily: 'Arial, Helvetica, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 600
  title:
    fontSize: '1.375rem'
    fontWeight: 700
rounded:
  compact: '4px'
  nav: '8px'
  control: '10px'
  surface: '12px'
  panel: '16px'
  dialog: '18px'
  pill: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '42px'
components:
  button-primary:
    backgroundColor: '{colors.evergreen}'
    textColor: '{colors.paper}'
    rounded: '{rounded.control}'
    height: '44px'
  card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.surface}'
    padding: '24px'
  tag:
    backgroundColor: '{colors.success-soft}'
    textColor: '{colors.evergreen-deep}'
    rounded: '{rounded.pill}'
---

# Design System: CPSync

## Overview

**Creative North Star: "The Calm Operations Desk"**

CPSync should feel like a well-run workplace: composed, legible, and ready for consequential daily work. Dense
information is organized into clear surfaces, while restrained green accents make primary actions and current context
easy to recognize. The interface earns trust through consistency, explicit state, and fast scanning.

Expression stays quiet enough for HR data and operational decisions. Warm leaf highlights and compact semantic tags
prevent the system from feeling clinical, without turning routine workflows into decoration.

**Key Characteristics:**

- Calm operational density
- Clear role and state hierarchy
- Restrained evergreen identity
- Recoverable, explicit interactions
- Responsive from mobile through wide desktop

## Colors

Evergreen carries brand and action; warm pale greens distinguish selected or supportive surfaces; neutral paper and ink
keep long working sessions readable. Amber and red remain reserved for warning and destructive meaning.

**The Action Contrast Rule.** Primary green buttons always use white text in default, hover, and focus states.

**The Semantic Color Rule.** Green means successful or active, amber means pending or attention, and red means blocked,
rejected, or destructive.

## Typography

**Display Font:** Arial with Helvetica and sans-serif fallbacks  
**Body Font:** Arial with Helvetica and sans-serif fallbacks

The incumbent typography is direct and familiar. Strong weight changes establish hierarchy; labels remain concise and
sentence case so dense interfaces scan quickly.

- **Headline:** Bold, tightly tracked page identity.
- **Title:** Semibold section and surface identity.
- **Body:** Regular copy with comfortable line length and explicit secondary color.
- **Label:** Semibold action, field, and navigation language.
- **Caption:** 12-pixel supporting data and compact metadata.
- **Micro:** 11-pixel branding details used sparingly with increased tracking.

## Layout

The desktop shell uses a fixed navigation rail and a flexible content workspace capped at a broad operational width.
Pages use a consistent 16/24/42-pixel rhythm, responsive grids, and sticky action areas where repeated work benefits.
At 599px and below, navigation becomes a horizontally scrollable header, grids collapse, dialogs remain full-width, and
Kanban boards scroll by contained columns rather than widening the document.

## Elevation & Depth

The system is flat by default. Borders and tonal surfaces carry structure; soft offset shadows are reserved for the
mobile navigation and focused modal layers. Cards never combine heavy borders with decorative halos.

**The Flat Workspace Rule.** Persistent content uses borders and tonal separation; shadow indicates temporary elevation.

## Shapes

Controls use gently rounded 10-pixel corners, working surfaces use 12-pixel corners, and dialogs use an 18-pixel radius.
Full pills belong only to compact status, count, and identity markers. Interactive targets remain at least 44 pixels.

## Components

### Buttons

- **Primary:** Evergreen, white text, 44-pixel minimum height, concise verb-led label.
- **Secondary:** Outlined evergreen for nearby alternatives.
- **Focus:** Visible three-pixel green outline with spacing from the control edge.

### Chips

- **Style:** One-word label, compact semantic tint, strong foreground contrast, full value retained in the title.
- **State:** Filter chips may use selected emphasis; status chips never behave like buttons.

### Cards / Containers

- **Corner Style:** Gently rounded working surfaces.
- **Background:** White or a subtle green-neutral tint.
- **Shadow Strategy:** Flat at rest; border or tone supplies separation.
- **Internal Padding:** 16 pixels for dense items and 24 pixels for major surfaces.

### Inputs / Fields

- **Style:** Outlined, fully labelled, compact-height fields with persistent accessible names.
- **Focus:** Native MUI border treatment plus the shared visible focus ring.
- **Error / Disabled:** Inline error copy names the problem; disabled state remains visibly distinct.

### Navigation

The forest navigation rail uses muted labels at rest, white on hover, and a pale leaf selected state with dark text.
Mobile preserves every destination in a horizontally scrollable strip.

## Do's and Don'ts

### Do:

- **Do** keep the next valid action visible near the page heading or task context.
- **Do** describe the current workspace below the heading rather than repeating the signed-in employee's department.
- **Do** use one-word pills and preserve expanded values in accessible titles.
- **Do** use icons with readable text for consequential actions.
- **Do** verify every shared breakpoint and keyboard focus path.

### Don't:

- **Don't** place long phrases inside pills.
- **Don't** rely on color alone to communicate workflow state.
- **Don't** hide common actions at the bottom of long pages.
- **Don't** use decorative motion, gradients, or shadows that compete with operational data.
