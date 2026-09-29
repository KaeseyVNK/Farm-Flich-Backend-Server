---
version: alpha
name: "Farm & Filch"
description: "A bright top-down farm RPG landing page with a day-versus-night rivalry at its center."
colors:
  primary: "#315B35"
  secondary: "#F3C44F"
  tertiary: "#13273A"
  neutral: "#FFF7DE"
  ink: "#2D201B"
  soil: "#795239"
typography:
  display:
    fontFamily: "Baloo 2, Nunito, ui-sans-serif, system-ui, sans-serif"
    lineHeight: "1.05"
  body:
    fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif"
    lineHeight: "1.5"
  utility:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    lineHeight: "1.2"
rounded:
  DEFAULT: "0.625rem"
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
spacing:
  section-mobile: "4rem"
  section-desktop: "7rem"
  page-max: "75rem"
  button: "0.75rem 1.25rem"
components:
  button:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: "{spacing.button}"
    height: "3rem"
  card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  world-panel:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
  preview-panel:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.sm}"
  quiet-border:
    backgroundColor: "{colors.soil}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.sm}"
---

# Farm & Filch Design System

## Overview

### Creative North Star

The page should feel like opening a colorful 16×16 farm-RPG map at the exact moment daylight gives way to a stealthy night raid. Rural materials—painted timber, tilled soil, crop labels, chests, and market signs—drive every visual decision.

### Product context and register

- **Audience and primary job:** Players considering the browser game need to understand the farm-and-filch loop quickly and reach the live pre-beta.
- **Target market and evidence:** Global browser-game audience; the approved Canva source and public game/social URLs use English.
- **Locale and language policy:** The public landing page is English. Existing Vietnamese legal pages remain available until localized legal copy is supplied.
- **Usage scene:** Mobile and desktop browsing, usually a one-time marketing visit; the page favors a strong scan path over dense controls.
- **Register:** Brand site. Expression leads, with semantic HTML and WCAG 2.2 AA interaction rules as the floor.
- **Memorable signature:** One continuous day-to-night farm panorama with a glowing locked chest between farmer and filcher.
- **Restraint:** Content sections use disciplined alternating bands, one display family, and one border grammar so the hero remains the loudest moment.
- **Anti-references:** No generic SaaS gradients, glass cards, soft blob backgrounds, photorealistic farm stock, glossy 3D icons, or faux game controls.
- **Token ownership/runtime mapping:** This file records the key semantic tokens from `src/app/globals.css`; derived shades remain runtime-only and both sources change together.

## Colors

`parchment` and `parchment-deep` are reading surfaces. `meadow` and `meadow-dark` express farming and positive actions. `harvest` is reserved for the primary action, focus, Gold, and the central chest. `midnight` and `midnight-soft` belong to Filch, trailer, and footer moments. `ink` is the universal text and pixel-frame color. High-contrast mode drops decorative shadows and keeps real borders.

## Typography

Baloo 2 is the display face for the playful game voice; Nunito carries body copy and controls. Utility labels may use the system monospace stack in short uppercase bursts only. Headlines balance, paragraphs stay below roughly 70 characters per line, and body text is never set in the pixel/utility face.

## Layout

Sections use a 20rem minimum viewport, a 75rem content ceiling, 4rem mobile spacing, and up to 7rem desktop spacing. The hero is an asymmetric copy-and-art composition that becomes a single vertical story on mobile. Gameplay uses a true 2×2 grid at desktop and a single column on narrow screens. Alternating world bands keep media aspect ratios reserved to prevent layout shift.

## Elevation & Depth

Depth comes from a hard dark border plus a single downward pixel shadow. Hovered interactive surfaces lift by three pixels; static editorial panels do not. Blur and glass effects are forbidden. Art may use native in-image lighting, but UI surfaces remain flat and legible.

## Shapes

Corners are compact rather than pill-like. Pixel-stepped clipping is allowed for one-off labels and hero ornaments. Buttons, cards, and media frames share the same dark stroke; round shapes are reserved for small social icons and decorative counters.

## Components

### Foundational visual states

Links and buttons have a visible harvest-colored focus outline, a clear hover state, and a pressed position. Disabled-looking elements are not rendered as controls. Image geometry is reserved before loading. Content below the hero may use render containment without hiding it from assistive technology.

### Buttons and actions

The solid harvest button is the sole primary action: “Play Now.” Secondary navigation uses parchment or transparent surfaces. All action labels state the destination or outcome and keep at least a 44px coarse-pointer target.

### Navigation and data display

The sticky navigation uses the provided logo, four anchor links, and one Play Now action. Mobile navigation uses a native button with expanded state. Repeated features and stats use semantic lists rather than decorative div grids alone.

### Forms and overlays

The redesigned landing page has no form or modal flow. Existing shared product primitives are not restyled by this brand system unless they appear on the landing route.

### Iconography

Lucide supplies utility and social icons with labels or accessible names. Pixel artwork supplies expressive objects; Unicode emoji is not used as interface iconography.

### Motion

Motion is restrained to section entrance, short button lift, and a stepped chest glow. Only opacity, transform, or filter animate. Reduced-motion preference removes all ambient movement and keeps the complete static composition.

### Content and data visualization

Voice is direct, mischievous, and concrete: grow a farm, guard it, visit neighbors, make a move. Claims come from the approved Canva content. The page contains no cryptocurrency positioning and does not invent player counts, deadlines, or unavailable footage.

## Do's and Don'ts

- **Do:** Let the day/night hero establish the rivalry immediately.
- **Do:** Keep every image crisp, top-down, and framed like a playable game scene.
- **Do:** Credit Maeve Devs and link to the art-pack page.
- **Don't:** Present a poster or still image as a playable video.
- **Don't:** mix rounded SaaS cards, glass effects, and generic gradient decoration into the pixel-world language.
