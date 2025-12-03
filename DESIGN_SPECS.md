# Design Specifications

## Color Palette

### Primary Colors
- **Electric Lime (Accent/Primary)**
  - Hex: `#D4E815`
  - HSL: `66deg 83% 50%`
  - Usage: Call-to-action buttons, highlights, icons, success states.

- **Deep Slate (Dark Accents/Footer)**
  - Hex: `#1A1D21`
  - HSL: `210deg 12% 12%`
  - Usage: CTA sections, dark footers, contrast elements.

### Neutral Colors
- **White (Background/Hero)**
  - Hex: `#FFFFFF`
  - HSL: `0deg 0% 100%`
  - Usage: Main page background, hero section, cards.

- **Near Black (Text/Foreground)**
  - Hex: `#111827`
  - HSL: `222deg 47% 11%`
  - Usage: Primary text, headings.

- **Dark Gray (Secondary Button)**
  - Hex: `#333333`
  - HSL: `0deg 0% 20%`
  - Usage: Secondary actions, specific UI elements.

## Typography

### Font Family
- **Primary Font:** `Inter` (sans-serif)
  - Why: Clean, geometric, highly legible, matches the modern SaaS aesthetic.
  - Fallbacks: `ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica Neue`, `Arial`, `sans-serif`.

### Font Weights
- **Regular (400):** Body text.
- **Medium (500):** Navigation, smaller interactive elements.
- **SemiBold (600):** Subheadings, buttons.
- **Bold (700) / ExtraBold (800):** Main headings (Hero).

## UI Elements

### Buttons
- **Primary Button:**
  - Background: Electric Lime (`#D4E815`)
  - Text: Dark Slate (`#1A1D21`)
  - Border Radius: Rounded (approx `0.5rem` to `0.75rem` or full pill shape for specific contexts).
  - Font Weight: SemiBold or Bold.

- **Secondary Button:**
  - Background: Dark Gray (`#333333`) or Transparent with Border.
  - Text: White (`#FFFFFF`).

### Cards & Surfaces
- **Card Background:** White (`#FFFFFF`) with subtle shadow.
- **Border:** Very subtle light gray (`#E5E7EB`) or none with shadow.

