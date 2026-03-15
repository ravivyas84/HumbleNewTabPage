# Improvement Plan for Humble New Tab Page

## Design Philosophies (preserved)

- Zero dependencies, vanilla JS, no build step
- Lightweight and fast-loading
- Highly customizable via the options panel
- Clean, minimal aesthetic
- localStorage for all state
- Dynamic CSS generation for live theming

---

## A. General Improvements

### A1. Accessibility Enhancements
- Add `aria-expanded` attributes to folder toggles
- Add `aria-label` to icon-only buttons (options, close)
- Add `role="menu"` and `role="menuitem"` to context menus
- Ensure all interactive elements have visible focus indicators (currently suppressed on mouse but shown on keyboard — good, just needs ARIA)

### A2. Search/Filter Bookmarks
- Add a subtle search bar (hidden by default, toggled via a keyboard shortcut like `/` or a small icon)
- Filters visible bookmarks in real-time as the user types
- Stays true to the "humble" philosophy — no server calls, just client-side DOM filtering
- Configurable: `show_search` toggle in Settings

### A3. Keyboard Shortcut for Quick Access
- Press `1-9` to expand/collapse the Nth top-level folder
- Press `Escape` to collapse all open folders
- Documented in a small help tooltip accessible from the options panel

### A4. Dark Mode Auto-Detection
- Add a "System" option to the theme selector
- Uses `prefers-color-scheme` media query to automatically switch between a light theme (Default) and a dark theme (Midnight)
- No new dependencies, just a `matchMedia` listener

### A5. Favicon Caching (Performance)
- Cache favicons as data URIs in localStorage (with a size cap)
- Reduces repeated network requests on every new tab open
- Particularly useful for Firefox where favicons come from third-party providers

---

## B. Timezone Feature (User Request)

### Concept

A horizontal timezone comparison widget rendered above or below the bookmark columns. Up to 4 timezone slots, each displayed as a labeled horizontal slider representing a 24-hour timeline. Moving any slider adjusts all sliders simultaneously so users can instantly see the corresponding time in every configured timezone.

### Design

```
 New York (EST)    ──────────────●──────────────  2:30 PM
 London (GMT)      ───────────────────●─────────  7:30 PM
 Mumbai (IST)      ────────────────────────●────  12:00 AM
 Tokyo (JST)       ──────────────────────────●──  4:00 AM
```

Each row:
- **Label**: City name + abbreviation (user-configurable)
- **Slider**: HTML `<input type="range">` spanning 0–1439 (minutes in a day)
- **Time display**: Formatted time at the right end

### Behavior

1. On page load, all sliders are set to the current time in their respective timezones
2. Dragging any slider computes the offset from "now" and applies it to all other sliders
3. The time labels update in real-time as sliders move
4. Double-click any slider to reset all to "now"
5. A subtle tick every minute updates the "now" baseline (no heavy polling — just a single `setInterval`)

### Implementation Details

- **No external APIs** — uses the built-in `Intl.DateTimeFormat` with IANA timezone names (e.g., `America/New_York`). Zero dependencies.
- **Configuration** stored in localStorage:
  - `options.show_timezones` — toggle (0/1), default 0
  - `options.tz_1` through `options.tz_4` — IANA timezone strings (e.g., `"America/New_York"`)
  - `options.tz_label_1` through `options.tz_label_4` — display labels (e.g., `"New York"`)
- **Options panel**: New "Timezones" fields in the Settings section:
  - Checkbox: "Show timezones"
  - Up to 4 rows: label text input + timezone select/text input
- **Rendering**: A new `<div id="timezones">` inserted above `#main`, styled to match the current theme (uses the same font, colors, highlight, and animation settings)
- **Theming**: Slider track and thumb styled via dynamic CSS, inheriting `font_color`, `highlight_color`, `shadow_color` from the active theme
- **CSS**: Custom range slider styling with `-webkit-` and `-moz-` prefixes for cross-browser support. Slider track uses a gradient to indicate day (light) vs night (dark) portions

### Files Modified

| File | Changes |
|------|---------|
| `newtab.html` | Add `#timezones` container div; add timezone config fields in Settings section |
| `newtab.css` | Add styles for `#timezones`, slider tracks, labels, time displays |
| `newtab.js` | Add `renderTimezones()`, timezone config defaults, slider event handlers, `Intl.DateTimeFormat` formatting, minute-tick interval |

### Respecting Extension Philosophy

- **Zero dependencies**: Uses only `Intl.DateTimeFormat` (built into all modern browsers)
- **Off by default**: `show_timezones` defaults to 0 — users opt in
- **Lightweight**: No background processes, no API calls, minimal DOM
- **Customizable**: Users pick their own timezones and labels
- **Themeable**: Inherits all color/font settings from the active theme
- **No new permissions**: No additional Chrome/Firefox permissions needed

---

## Implementation Order

1. **B. Timezone feature** (user's explicit request — top priority)
2. A4. Dark mode auto-detection (quick win, high user value)
3. A1. Accessibility (important for inclusivity)
4. A2. Search/filter (quality-of-life improvement)
5. A3. Keyboard shortcuts (power-user feature)
6. A5. Favicon caching (performance optimization)
