---
name: Bossa Cívica
colors:
  surface: '#fff8f5'
  surface-dim: '#e1d8d4'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbf2ed'
  surface-container: '#f5ece7'
  surface-container-high: '#efe6e2'
  surface-container-highest: '#e9e1dc'
  on-surface: '#1e1b18'
  on-surface-variant: '#3f4940'
  inverse-surface: '#34302c'
  inverse-on-surface: '#f8efea'
  outline: '#6f7a70'
  outline-variant: '#bfc9be'
  surface-tint: '#116c3b'
  primary: '#005129'
  on-primary: '#ffffff'
  primary-container: '#0e6b3a'
  on-primary-container: '#94e9ab'
  inverse-primary: '#85d89c'
  secondary: '#9e4127'
  on-secondary: '#ffffff'
  secondary-container: '#ff8b6b'
  on-secondary-container: '#75230b'
  tertiary: '#464642'
  on-tertiary: '#ffffff'
  tertiary-container: '#5e5d59'
  on-tertiary-container: '#d9d6d1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a0f5b7'
  primary-fixed-dim: '#85d89c'
  on-primary-fixed: '#00210d'
  on-primary-fixed-variant: '#00522a'
  secondary-fixed: '#ffdbd1'
  secondary-fixed-dim: '#ffb5a1'
  on-secondary-fixed: '#3b0800'
  on-secondary-fixed-variant: '#7f2a12'
  tertiary-fixed: '#e5e2dd'
  tertiary-fixed-dim: '#c9c6c2'
  on-tertiary-fixed: '#1c1c19'
  on-tertiary-fixed-variant: '#474743'
  background: '#fff8f5'
  on-background: '#1e1b18'
  surface-variant: '#e9e1dc'
typography:
  display-lg:
    fontFamily: Literata
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Literata
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Literata
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Literata
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  container-max: 1200px
---

## Brand & Style

The brand personality is a sophisticated intersection of Brazilian modernism and civic warmth. It balances the lush, rhythmic energy of the tropics with the structured order of community management. The UI should evoke an emotional response of "organized serenity"—feeling as reliable as a municipal institution yet as welcoming as a sun-drenched courtyard.

The design style leans into **Corporate Modernism** infused with **Tactile** warmth. It rejects the coldness of standard SaaS by utilizing organic layouts, rhythmic repetition of elements, and a material-inspired palette. It is a system built for "Aurora Apts," where communal living is treated with dignity, beauty, and architectural precision.

## Colors

The palette is grounded in the natural and built environments of high-modernist Brazil. 

- **Primary (Deep Tropical Green):** Used for primary actions, branding, and active states. It represents growth and the lush landscape of the apartment grounds.
- **Secondary (Terracotta):** Used for accents, notifications, and secondary call-to-actions. It provides a warm, human contrast to the deep green.
- **Tertiary (Soft Sand):** The primary background color. It avoids the clinical nature of pure white, providing a soft, paper-like texture to the interface.
- **Neutral (Charcoal Earth):** Used for typography and iconography to ensure high legibility against the sand backgrounds.

Color application should follow a 60-30-10 distribution to maintain the "civic" feel without overwhelming the user with vibrancy.

## Typography

This design system employs a dual-personality typographic approach. 

**Literata** serves as the "Civic" voice—elegant, authoritative, and bookish. It is reserved for headlines, display text, and storytelling elements like community invitations. It brings a sense of history and permanence.

**Be Vietnam Pro** serves as the "Functional" voice—friendly, open, and highly legible. It handles the "Bossa" side of the interface: navigation, data entry, and community polls. The contemporary grotesque nature of the font ensures the app feels modern and efficient.

Maintain generous line heights to ensure the "rhythmic" feel of the brand is preserved in long-form text.

## Layout & Spacing

The layout philosophy follows a **Fixed-Fluid Hybrid** model. Content is contained within a 12-column grid for desktop with a maximum width, while gutters and margins scale slightly to maintain a sense of openness.

Spacing should be used to create "rhythmic clusters." Group related information (like a poll and its results) with tight internal spacing (8px-16px) but use large, expansive gaps (48px-64px) between major sections to mimic the airy walkways of modernist architecture.

- **Mobile:** 4-column grid with 16px margins.
- **Tablet:** 8-column grid with 32px margins.
- **Desktop:** 12-column grid with 64px margins.

Avoid cluttered layouts; if a screen feels busy, increase the "Tertiary" sand-colored whitespace.

## Elevation & Depth

This design system uses **Tonal Layers** and **Ambient Shadows** to create a sense of physical space. Depth is not meant to be "high-tech" but rather "architectural."

1.  **Base Layer:** The Sand (#F5F2ED) surface acts as the ground.
2.  **Raised Surfaces:** Cards and containers use a slightly lighter off-white or a very subtle Terracotta tint with a low-opacity, diffused shadow (Blur: 20px, Y: 4px, Color: 5% Neutral).
3.  **Interactive States:** Elements should appear to "sink" slightly or lose their shadow when pressed, emphasizing the tactile nature of the UI.
4.  **Glass Elements:** For overlays (like modal backdrops), use a subtle blur with a 10% tint of the primary green to maintain the tropical atmosphere.

## Shapes

The shape language is primarily **Rounded (0.5rem base)**, but it incorporates "Rhythmic Curves" for specific components.

While cards and inputs use the standard roundedness to maintain civic order, **action buttons and decorative elements should use pill-shapes (rounded-xl)**. This contrast between the structured rectangles of the layout and the organic, flowing shapes of the interactive elements creates the "Bossa" movement. 

Icons should have rounded terminals and avoid sharp 90-degree angles to keep the interface feeling approachable.

## Components

### Buttons
Primary buttons use the Deep Green background with white text, featuring a pill-shaped (3rem) radius. Secondary buttons should use the Terracotta color or a "Ghost" style with a 1px border of the Neutral color.

### Cards
Cards are the primary container for community updates and condo management. They should have a 1rem (rounded-lg) corner radius, a subtle 1px border in a darker sand tone, and a soft ambient shadow. Headline text inside cards must be Literata.

### Polls & Inputs
Input fields use a solid Sand background that is slightly darker than the main surface, with a bottom-only 2px border in Deep Green when focused. Poll options should appear as pill-shaped chips that "fill" with the Primary color as votes are cast.

### Community Invitations
These are specialized "Hero" cards. They should feature larger Literata typography, use the Terracotta color for dates/times, and may incorporate organic, leaf-like masking for imagery to emphasize the "Aurora" tropical brand.

### Lists
Lists should be separated by thin, low-contrast horizontal lines. Use generous vertical padding (16px-24px) to ensure the list doesn't feel cramped, maintaining the rhythmic spacing of the system.