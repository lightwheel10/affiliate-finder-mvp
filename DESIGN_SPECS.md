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

## Auth Screens (Login/Signup)

### Layout
- Centered card layout with decorative background blurs
- Card: White with backdrop blur, subtle border, rounded corners (`1rem`)
- Max width: `400px`

### Colors
- **Background:** Off-white (`#FDFDFD`) with Electric Lime gradient blurs
- **Logo Icon:** Deep Slate (`#1A1D21`) background with Electric Lime (`#D4E815`) icon
- **Input Focus:** Electric Lime ring (`#D4E815`) with 10% opacity
- **Primary Button:** Deep Slate (`#1A1D21`) background, hover to Electric Lime (`#D4E815`)
- **Links:** Electric Lime (`#D4E815`) for interactive text links
- **Error State:** Red (`#EF4444`) background with red border

### Form Elements
- **Input Fields:**
  - Background: White (`#FFFFFF`)
  - Border: Light gray (`#E5E7EB`)
  - Focus Border: Electric Lime (`#D4E815`)
  - Focus Ring: Electric Lime at 10% opacity
  - Icon Color (default): Slate-400
  - Icon Color (focus): Electric Lime (`#D4E815`)

### Typography
- **Heading:** Bold, Near Black (`#111827`)
- **Subtext:** Slate-500
- **Labels:** SemiBold, Slate-700
- **Links:** SemiBold, Electric Lime (`#D4E815`)

## Onboarding Screens

### Layout
- Centered card layout on off-white background (`#F0F2F5`)
- Card: White with subtle shadow, rounded corners (`1rem`)
- Max width: `420px`
- Multi-step wizard with progress indicators

### Colors
- **Background:** Off-white (`#F0F2F5`)
- **Logo Icon:** Deep Slate (`#1A1D21`) background with Electric Lime (`#D4E815`) icon
- **Progress Bar (Active):** Electric Lime (`#D4E815`)
- **Progress Bar (Completed):** Electric Lime at 50% opacity
- **Progress Bar (Inactive):** Slate-100
- **Question Icons:** Electric Lime at 20% opacity background, Deep Slate (`#1A1D21`) icon

### Form Elements
- **Input Fields:**
  - Background: White (`#FFFFFF`)
  - Border: Slate-200
  - Focus Border: Electric Lime (`#D4E815`)
  - Focus Ring: Electric Lime at 20% opacity
  - Border Radius: Full pill (`rounded-full`) for most inputs, `rounded-xl` for multi-line

- **Dropdown Menus:**
  - Background: White with shadow
  - Selected Item Checkmark: Electric Lime (`#D4E815`)

- **Add Button (Plus):**
  - Background: Electric Lime (`#D4E815`)
  - Icon: Deep Slate (`#1A1D21`)
  - Hover: Darker Electric Lime (`#c5d913`)

### Selection States
- **Selected Items (Competitors/Topics):**
  - Background: Electric Lime at 10% opacity
  - Border: Electric Lime at 50% opacity
  - Hover Border: Electric Lime solid

- **Checkbox (Selected):**
  - Background: Electric Lime (`#D4E815`)
  - Border: Electric Lime (`#D4E815`)
  - Checkmark: Deep Slate (`#1A1D21`)

- **Checkbox (Unselected):**
  - Border: Slate-300
  - Hover Border: Electric Lime (`#D4E815`)

### Buttons
- **Primary (Continue/Next):**
  - Background: Electric Lime (`#D4E815`)
  - Text: Deep Slate (`#1A1D21`)
  - Hover: Darker Electric Lime (`#c5d913`)
  - Disabled: Slate-100 background, Slate-400 text

### Loading Screen
- **Loader Ring (Outer):** Electric Lime at 20% opacity with blur
- **Loader Ring (Middle):** Electric Lime at 30% opacity
- **Loader Circle:** Electric Lime (`#D4E815`) solid
- **Spinner Icon:** Deep Slate (`#1A1D21`)
- **Accent Text:** Deep Slate (`#1A1D21`) italic

## Pricing Screen (Post-Onboarding)

### Layout
- Full-screen layout on off-white background (`#FDFDFD`)
- 3-column grid for pricing cards (responsive)
- Max width: `6xl` for card grid

### Header
- **Logo Icon:** Deep Slate (`#1A1D21`) background with Electric Lime (`#D4E815`) icon
- **Heading Accent:** Deep Slate (`#1A1D21`) italic for "free 7-day"
- **Billing Toggle:**
  - Active: White background with shadow
  - Discount Badge: Electric Lime at 20% opacity, Deep Slate text

### Pricing Cards
- **Default Card:**
  - Background: White
  - Border: Slate-200
  - Shadow: Small, grows on hover

- **Highlighted Card (Pro/Popular):**
  - Border: Electric Lime (`#D4E815`)
  - Shadow: Electric Lime at 20% opacity
  - Scale: 1.02 (slightly larger)
  - "Most Popular" Badge: Deep Slate (`#1A1D21`) background, Electric Lime (`#D4E815`) text

### Pricing Card Elements
- **Price (Highlighted):** Deep Slate (`#1A1D21`)
- **Price Period:** Dark Gray (`#333333`) italic

- **CTA Button (Highlighted):**
  - Background: Electric Lime (`#D4E815`)
  - Text: Deep Slate (`#1A1D21`)
  - Hover: Darker Electric Lime (`#c5d913`)

- **CTA Button (Default):**
  - Background: White with border
  - Text: Slate-900
  - Hover: Slate-50 background

- **Feature Checkmarks:**
  - Background: Deep Slate (`#1A1D21`)
  - Checkmark: Electric Lime (`#D4E815`)

## Post-Login Dashboard (Main Interface)

### Layout
- Sidebar navigation (collapsible, 240px expanded / 52px collapsed)
- Main content area with sticky header
- Background: Off-white (`#FDFDFD`)
- Header: White with backdrop blur, subtle bottom border

### Header Elements
- **Page Title:** Semibold, Slate-900
- **Stats Badges:**
  - Search Credits: Emerald-50 background, Emerald-100 border
  - Email Credits: Electric Lime at 10% opacity, Electric Lime at 30% border
- **Primary CTA Button:**
  - Background: Electric Lime (`#D4E815`)
  - Text: Deep Slate (`#1A1D21`)
  - Hover: Darker Electric Lime (`#c5d913`) with shadow

### Filter Pills (Source Filters)
- **Active State:**
  - Background: Electric Lime (`#D4E815`)
  - Text: Deep Slate (`#1A1D21`)
  - Border: Electric Lime (`#D4E815`)
  - Shadow: Electric Lime at 20% opacity
  - Badge: Deep Slate at 20% opacity background, Deep Slate text

- **Inactive State:**
  - Background: White (`#FFFFFF`)
  - Text: Slate-600
  - Border: Slate-200
  - Hover: Slate-50 background, Slate-300 border
  - Badge: Slate-100 background, Slate-500 text

### Search Input
- Background: White (`#FFFFFF`)
- Border: Slate-200 ring
- Focus: Electric Lime at 20% opacity ring, Electric Lime shadow
- Icon: Slate-400, transitions to Deep Slate on focus

### Table/Results Area
- **Table Header:**
  - Background: White
  - Text: Slate-400, uppercase, tracking-wider
  - Border: Slate-200

- **Results Container:**
  - Background: White
  - Border: Slate-200
  - Border Radius: Rounded corners (top: xl, bottom: xl)
  - Shadow: Small

### Pagination
- **Active Page:**
  - Background: Slate-900
  - Text: White
- **Inactive Page:**
  - Background: White with border
  - Text: Slate-700
  - Hover: Slate-50 background

### Loading States
- **Progress Indicator:**
  - Background: Electric Lime at 10% opacity
  - Border: Electric Lime at 30% opacity
  - Spinner: Electric Lime border with transparent top
- **Skeleton Rows:** Opacity 50%

### Empty States
- Icon container: Slate-50 background, Slate-100 border
- Icon: Slate-300
- Heading: Slate-900, bold
- Subtext: Slate-400

