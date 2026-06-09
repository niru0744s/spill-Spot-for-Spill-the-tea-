---
name: Tea
colors:
  surface: '#0f150e'
  surface-dim: '#0f150e'
  surface-bright: '#353b33'
  surface-container-lowest: '#0a1009'
  surface-container-low: '#171d16'
  surface-container: '#1b211a'
  surface-container-high: '#262b24'
  surface-container-highest: '#31362f'
  on-surface: '#dfe4d9'
  on-surface-variant: '#becab9'
  inverse-surface: '#dfe4d9'
  inverse-on-surface: '#2c322b'
  outline: '#899485'
  outline-variant: '#3f4a3d'
  surface-tint: '#7adc7d'
  primary: '#ffffff'
  on-primary: '#00390d'
  primary-container: '#96f996'
  on-primary-container: '#037524'
  inverse-primary: '#006e21'
  secondary: '#ffb59c'
  on-secondary: '#5c1a00'
  secondary-container: '#8e2c01'
  on-secondary-container: '#ffaa8d'
  tertiary: '#ffffff'
  on-tertiary: '#313030'
  tertiary-container: '#e5e2e1'
  on-tertiary-container: '#656464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#96f996'
  primary-fixed-dim: '#7adc7d'
  on-primary-fixed: '#002105'
  on-primary-fixed-variant: '#005316'
  secondary-fixed: '#ffdbcf'
  secondary-fixed-dim: '#ffb59c'
  on-secondary-fixed: '#380c00'
  on-secondary-fixed-variant: '#822800'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474646'
  background: '#0f150e'
  on-background: '#dfe4d9'
  surface-variant: '#31362f'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Sora
    fontSize: 36px
    fontWeight: '800'
    lineHeight: '1.1'
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  chat-bubble:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  container-margin: 20px
  chat-gap: 12px
---

## Brand & Style

The brand personality is high-energy, unfiltered, and unapologetically social. Designed for a Gen Z audience that communicates through motion, memes, and rapid-fire messaging, the aesthetic centers on the concept of "spill the tea." 

The design style is **Modern-Vibrant with a hint of Glassmorphism**. It prioritizes fluid motion, high-contrast interactive elements, and a sense of depth that feels digital-native. The UI should evoke an emotional response of excitement and inclusivity—a virtual "third space" where the atmosphere is always "on." Expect oversized touch targets, playful micro-interactions, and a layout that feels alive.

## Colors

The palette is optimized for a dark-mode-first experience to cater to late-night social habits. 

- **Matcha Green (Primary):** Used for primary actions, active states, and "new message" indicators. It represents growth and fresh energy.
- **Bright Peach (Secondary):** Used for alerts, heart reactions, and high-emphasis notifications. It provides a warm, energetic contrast to the green.
- **Deep Charcoal (Neutral):** The foundation of the UI. It isn't a true black, allowing for better depth perception and softer contrast for long chat sessions.
- **Cream (Accent):** Used sparingly for text on dark backgrounds or as a subtle "paper" effect for secondary containers to keep the UI from feeling too cold.

## Typography

The typography system is dynamic and expressive. We use **Sora** for headlines to provide a tech-forward, geometric, and bold personality that stands out in a crowded feed. 

For the core chat experience and body text, **Plus Jakarta Sans** provides a friendly, soft, and highly readable environment. **Space Grotesk** is utilized for functional labels and metadata (like timestamps or "seen" receipts) to add a slight "technical" edge that resonates with digital-first users. Typography should feel bouncy; use variable font weights to emphasize the "loudness" of certain messages.

## Layout & Spacing

This design system utilizes a **Fluid Grid** with generous inner padding to allow content to breathe. 

- **Mobile:** A 4-column grid with 20px side margins. Chat bubbles should have a dynamic width ranging from 60% to 85% of the screen width.
- **Desktop/Tablet:** A centered max-width layout (1200px) with a 12-column grid. The chat interface utilizes a three-pane system: Navigation (Left), Active Conversation (Center), and Thread Info/Media (Right).
- **Rhythm:** We follow an 8px base unit. Spacing between chat messages from different users is 12px, while grouped messages from the same user are tucked tighter at 4px.

## Elevation & Depth

Depth is conveyed through **Tonal Layers** and **Glassmorphism**, moving away from traditional heavy drop shadows.

- **Level 0 (Base):** Deep Charcoal background.
- **Level 1 (Surface):** Slightly lighter charcoal with a 1px low-opacity border. Used for the main chat feed.
- **Level 2 (Float):** Glassmorphic panels with a `backdrop-filter: blur(20px)` and 15% opacity Matcha or Peach tints. Used for sticky headers, navigation bars, and pop-up menus.
- **Level 3 (Pop):** High-contrast elements like Matcha buttons that appear to "sit" on top of the glass. These use a soft, primary-colored glow (shadow) instead of a black shadow to simulate light emission.

## Shapes

The shape language is **Pill-shaped and Ultra-Rounded**. Sharp corners are non-existent in this design system. 

Chat bubbles use asymmetrical rounding: the corner pointing toward the user's side is sharper (8px) while all other corners are fully pill-shaped. This provides a clear directional flow to the conversation. Buttons and input fields should always be fully rounded (capsule style) to maintain the playful, soft aesthetic.

## Components

- **Buttons:** Primary buttons are "Matcha" with black text. They should have a subtle "squish" animation on press (scale 0.95). Secondary buttons use an outline style with "Peach" text.
- **Chat Bubbles:** Outgoing bubbles are "Matcha" with dark text. Incoming bubbles are "Surface Level 1" with "Cream" text. Bubbles should support "reactions" that sit on the bottom edge, overlapping the border.
- **Input Fields:** Search and message bars are dark, recessed capsules. On focus, the border glows with the primary color.
- **Chips:** Used for "Tea Tags" (topics). These are small, semi-transparent pills with high-contrast text.
- **Lists:** User lists (Contact list) use large circular avatars (48px+) with a secondary "Active" ring glow.
- **Cards:** Media cards (images/videos) use a `rounded-xl` (3rem) corner to fit the ultra-round theme, with metadata overlaid using a glassmorphic bottom bar.
- **The "Spill" Indicator:** A custom animated loading state that looks like liquid tea being poured, used for refreshing feeds.