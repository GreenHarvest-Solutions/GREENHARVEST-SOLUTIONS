---
name: GreenHarvest Solutions
description: Agritech marketplace connecting agricultural producers with buyers and logistical cold-chain transit
colors:
  primary: "#286c00"
  primary-container: "#50b819"
  on-primary: "#ffffff"
  primary-hover: "#1f5400"
  primary-dark: "#1e4d03"
  surface: "#fcf9f8"
  surface-card: "#ffffff"
  background: "#fcf9f8"
  on-surface: "#1c1b1b"
  text-muted: "#4b5563"
  text-secondary: "#374151"
  border: "#e5e7eb"
  border-subtle: "#f3f4f6"
  success: "#286c00"
  success-bg: "#f0fdf4"
  success-border: "#dcfce7"
  warning: "#92400e"
  warning-bg: "#fef3c7"
  warning-border: "#fde68a"
  error: "#b91c1c"
  error-bg: "#fef2f2"
  error-border: "#fee2e2"
  info: "#1e40af"
  info-bg: "#eff6ff"
  info-border: "#dbeafe"
typography:
  display:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  heading-xl:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  heading-lg:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  heading-md:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  2xl: "1.25rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.2xl}"
    padding: "20px"
---

# GreenHarvest Solutions Design System

## Overview
GreenHarvest Solutions connects farmers, commercial buyers, and logistics providers in an integrated agricultural marketplace. The interface serves in **Operate Mode** for administrative oversight, producer certification, escrow mediation, and logistical cold-chain tracking.

Craft values:
- **Pragmatic Authority**: High-density operational data with zero decorative slop or fake liveness.
- **Visual Restraint**: Clean white surfaces, subtle borders, and intentional forest green accents.
- **Accessible Legibility**: Strict WCAG AA compliance across all labels, figures, and interactive targets.

## Colors
- **Brand Primary (`#286c00`)**: Deep agricultural forest green used for primary interactive triggers, active navigation items, and brand identity.
- **Deep Emerald (`#1e4d03`)**: High-contrast dark container tone for critical infrastructure summaries.
- **Neutral Background (`#fcf9f8`)**: Warm organic off-white providing soft background illumination without harsh glare.
- **Card Surfaces (`#ffffff`)**: Pure white elevated cards with delicate single-pixel borders (`#f3f4f6`).
- **Semantic Statuses**:
  - Verified / Safe: Forest green (`#286c00`) on `#f0fdf4`.
  - Pending Review / Attention: Amber (`#92400e`) on `#fef3c7`.
  - Dispute / Alert: Crimson (`#b91c1c`) on `#fef2f2`.
  - Cold-Chain / Logistics: Ocean Blue (`#1e40af`) on `#eff6ff`.

## Typography
- **Primary Interface Font**: `Plus Jakarta Sans` across dashboard controls, metadata, and data tables.
- **Display Accent Font**: `Anton` reserved for top-level brand and marketing anchors.
- **Craft Floor Invariants**:
  - Functional interactive text has an absolute floor of `11px` (standardized to `text-xs` / `12px`).
  - All numerical counts, currencies (`ETB`), and percentages strictly use `tabular-nums` to eliminate proportional jitter.
  - Body paragraphs enforce `[text-wrap:pretty]` to prevent single-word stragglers and awkward line measure breaks.
  - Headings maintain strict outline hierarchy (`h1` -> `h2` -> `h3`) without skipping levels.

## Layout
- **Viewport Structure**: Fixed-viewport full vertical height (`h-screen w-screen overflow-hidden`).
- **Navigation Spine**: Fixed 64-column (`w-64`) sidebar with dynamic path highlighting, fixed logo header, scrollable nav links, and pinned bottom platform status.
- **Main Command Canvas**: Scrollable full-height canvas partitioned into a 2-column flex layout:
  - Left Primary Canvas (`flex-1`): Operational hero banner, 4 core KPI cards, and the 3-tab operational dispute/moderation center.
  - Right Oversight Rail (`w-80`): Fast platform registry search, live fleet dispatch status, top revenue producers, and database/escrow infrastructure monitoring.

## Elevation & Depth
- **Soft Border Separation**: Physical depth is achieved through crisp borders (`border border-gray-100`) rather than aggressive shadows.
- **Subtle Elevation**: Cards employ gentle ambient elevation (`shadow-xs` / `shadow-2xs`) with soft hover elevation (`hover:shadow-xs`) on actionable rows.
- **No Accent Borders**: Cards avoid one-sided colored border bars (`border-l-4`). State is signaled through balanced badge pills.

## Shapes
- **Container Curvature**:
  - Modal dialogues & Primary containers: `rounded-2xl` (1.25rem / 20px)
  - Action buttons, list rows, & search inputs: `rounded-xl` (0.75rem / 12px)
  - Status chips & badge indicators: `rounded-full` (9999px)
- **Nested Hierarchy**: Internal row items avoid nested container borders; lists use dividers (`divide-y divide-gray-100`) to preserve low cognitive noise.

## Components
- **Operations Center**: Multi-tab review queue with dedicated tabs for Farmer KYC, Product Moderation, and Escrow Disputes.
- **Broadcast Alert Modal**: Accessible platform-wide announcement trigger with backdrop blur, keyboard dismiss, and immediate feedback.
- **KPI Metric Stat Blocks**: Compact cards with clear semantic iconography, primary figures, and secondary commission/fulfillment metadata.
- **Fleet Dispatch Gauge**: Active logistics tracker displaying cold-chain compliance and on-time transit percentages with progress bars.

## Do's and Don'ts
- **DO** use `tabular-nums` on all currencies, counts, dates, and percentages.
- **DO** keep secondary metadata legible with text contrast ≥ 4.5:1 against its background.
- **DO** use flat list rows with dividers inside cards rather than nesting cards within cards.
- **DON'T** introduce artificial `animate-pulse` or `animate-ping` on static status dots.
- **DON'T** let functional UI text drop below `11px`.
- **DON'T** use purple or violet accent colors—GreenHarvest's canonical palette is `#286c00`.

