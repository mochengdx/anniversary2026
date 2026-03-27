# Design System Document

## 1. Overview & Creative North Star: "The Celestial Core"

This design system is built to capture the high-octane energy of a cosmic lottery, where the boundary between reality and the "impossible" dissolves. The **Creative North Star** is defined as **The Celestial Core**: an immersive, gravity-defying experience that treats the UI not as a flat screen, but as a window into a deep-space nebula.

To move beyond generic "app" templates, this system utilizes **intentional asymmetry** and **kinetic layering**. We break the grid by allowing 3D assets—like the floating whale and avatar cards—to break container boundaries, creating a sense of infinite scale. The visual language is defined by high-contrast typography, glowing neon accents, and a sophisticated use of glassmorphism to simulate depth in the vacuum of space.

---

## 2. Colors

The palette transition from the absolute void of space to the vibrant energy of a collapsing star.

### Core Palette
*   **Primary (`#c59aff` / `primary`):** A radiant violet used for major interactive states and brand highlights.
*   **Secondary (`#00e3fd` / `secondary`):** A neon blue used to denote "energy" and futuristic tech elements.
*   **Tertiary (`#ffe483` / `tertiary`):** A celestial gold, reserved for winning moments, rare items (SSR), and "luck" indicators.
*   **Background (`#0c0c1d` / `background`):** A deep, saturated space-indigo that provides the canvas for light effects.

### The "No-Line" Rule
Sectioning must never be achieved through 1px solid borders. Instead, boundaries are defined by **Background Shifting**. To separate a content block, use `surface-container-low` against the `background` or `surface`. The eye should perceive the change in depth through color tone, not structural lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers floating in space. Use the surface-container tiers to create nested importance:
*   **Base:** `surface` (#0c0c1d)
*   **Level 1 (Subtle Lift):** `surface-container-low` (#121223)
*   **Level 2 (Active Cards):** `surface-container-highest` (#24233b)
*   **Floating Elements:** `surface-bright` (#2a2a43) with 60% opacity and a 20px Backdrop Blur.

### The "Glass & Gradient" Rule
Signature components (like the central lottery mechanism) should utilize **Glassmorphism**. Combine `primary-container` at 20% opacity with a `backdrop-filter: blur(12px)`. To add "soul," apply a subtle linear gradient from `primary` to `primary-dim` at a 135-degree angle for primary CTA buttons.

---

## 3. Typography

The typography strategy is a collision of ancient artistry and futuristic precision.

*   **Display & Headline (Epilogue):** These levels are the "voice" of the system. Large-scale headings should feel authoritative and dynamic. In high-energy moments (like "YOU WIN"), use a **calligraphic brush-stroke style** (referenced in the '26' and 'Anything is Possible' imagery) to contrast against the clean UI.
*   **Title & Body (Manrope):** A clean, modern sans-serif that ensures maximum legibility against dark, complex backgrounds.
*   **Labels (Space Grotesk):** Used for technical metadata, ID numbers, and micro-copy. Its monospaced feel reinforces the "futuristic tech" aesthetic.

**Hierarchy as Brand Identity:** Use `display-lg` (3.5rem) for the "Anything is Possible" messaging to create a sense of awe, while using `label-md` (0.75rem) for secondary UI controls to keep the interface feeling professional and unobtrusive.

---

## 4. Elevation & Depth

### The Layering Principle
Hierarchy is achieved through **Tonal Layering**. Instead of a shadow, a `surface-container-highest` card sitting on a `surface-container-low` section creates a natural "step" in the UI.

### Ambient Shadows
When an element must "float" (e.g., the 3D whale or an avatar card), use an **Extra-Diffused Shadow**. 
*   **Blur:** 40px - 80px
*   **Opacity:** 15%
*   **Color:** Use a tinted version of `primary` or `secondary` rather than black. This simulates the ambient glow of a nearby nebula casting light on the object.

### The "Ghost Border" Fallback
If an element requires a boundary for accessibility, use a **Ghost Border**:
*   **Token:** `outline-variant`
*   **Opacity:** 15% - 20%
*   **Style:** Solid 1.5px. This creates a "glass edge" effect that catches the light without boxing in the content.

---

## 5. Components

### Central Lottery Mechanism (Hero)
The focal point of the app. It should be an immersive, centered layout. Use a spherical arrangement for avatar cards (referencing the 3D orbit imagery). The active selection should use a `secondary` glow effect.

### Buttons
*   **Primary:** Background of `primary-container` with a high-glow `primary` drop shadow. Use `roundedness-full` for a sleek, aero-dynamic feel.
*   **Secondary:** Glassmorphic background (20% `on-surface`) with a `secondary` ghost border.
*   **Tertiary:** No background; `primary` text with an underline that appears on hover using a `secondary` gradient.

### Avatar Cards (3D Element)
*   **Style:** Use `surface-container-highest` with a `roundedness-md`. 
*   **Interaction:** On hover/selection, the card should scale (1.1x) and gain a `secondary` neon border-glow.
*   **Content:** Keep text to `label-md` for ID numbers and `title-sm` for usernames.

### Input Fields
*   **Structure:** No solid background. Use a `surface-container-lowest` fill with a `ghost border` using the `outline` token. 
*   **State:** On focus, the border transitions to `secondary` with a subtle outer glow.

### Cards & Lists
**Strict Rule:** No divider lines. Separate list items using `spacing-3` of vertical white space or a subtle background shift between `surface-container-low` and `surface-container-lowest`.

---

## 6. Do's and Don'ts

### Do:
*   **Do** allow 3D assets to overlap UI containers to create depth.
*   **Do** use the `tertiary` (Gold) color sparingly—only for rewards, stars, and "winning" states.
*   **Do** utilize the full `roundedness` scale, favoring `xl` and `full` for a futuristic, organic feel.
*   **Do** ensure all text on dark surfaces meets WCAG AA contrast ratios by using the `on-surface` and `on-background` tokens.

### Don't:
*   **Don't** use 100% opaque, high-contrast borders or dividers.
*   **Don't** use "flat" black for backgrounds; always use the `surface` indigo (#0c0c1d) to maintain depth.
*   **Don't** use standard drop shadows (e.g., #000 at 50%). All shadows must be diffused and color-tinted.
*   **Don't** crowd the "Celestial Core." Ensure the lottery mechanism has significant "breathing room" (using `spacing-16` or `spacing-20`).