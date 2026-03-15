# Humble New Tab Page - Repository Documentation

> **Version:** 1.26.2 | **Author:** Isaiah Billingsley | **License:** MIT | **Since:** July 2011

## Overview

Humble New Tab Page (HNTP) is a browser extension for Chrome and Firefox that replaces the default new tab page with a customizable dashboard. Users can organize bookmarks, apps, most-visited sites, recently closed tabs, and sessions from other devices in a flexible multi-column, drag-and-drop layout.

- [Chrome Web Store](https://chrome.google.com/webstore/detail/mfgdmpfihlmdekaclngibpjhdebndhdj)
- [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/humble-new-tab/)

---

## Tech Stack

| Layer       | Technology                    |
|-------------|-------------------------------|
| Language    | Vanilla JavaScript (ES5+)     |
| Markup      | HTML5                         |
| Styling     | CSS3 + dynamic CSS generation |
| Extension   | Chrome Manifest V3            |
| Build       | None (no bundler/transpiler)  |

There is **no build step**. The source files are the extension files directly.

---

## Project Structure

```
HumbleNewTabPage/
├── manifest.json          # Extension manifest (Manifest V3)
├── newtab.html            # Main UI: new tab page + inline options panel
├── newtab.css             # Base styles and layout
├── newtab.js              # All application logic (~1,600 lines)
├── README.md              # User-facing readme with changelog
├── REPOSITORY.md          # This file - developer documentation
├── privacy.md             # Privacy policy
├── LICENSE_MIT.txt         # MIT license
├── icons/                 # Extension & UI icons
│   ├── icon_16.png         # Extension icon (16px)
│   ├── icon_48.png         # Extension icon (48px)
│   ├── icon_128.png        # Extension icon (128px)
│   ├── folder.png/folder_open.png  # Folder icons (+ 2x variants)
│   ├── closed.png, recent.png, top.png, window.png, phone.png
│   ├── apps.png, page.png, options.png, revert.png, error.png
│   └── LICENSE_chromium_BSD.txt    # License for Chromium-sourced icons
└── media/                 # Promotional assets
    ├── icon.svg, promo.svg, promo.png
    └── shot.1.png - shot.5.png    # Store screenshots
```

### Key Files

- **`newtab.js`** — Single-file application containing all logic: rendering, drag-and-drop, configuration management, context menus, themes, and browser API interactions.
- **`newtab.html`** — The new tab page structure plus the full options/settings panel (shown/hidden via JavaScript).
- **`newtab.css`** — Base styles; many styles are dynamically generated and injected by `newtab.js` based on user configuration.
- **`manifest.json`** — Manifest V3 extension definition, declares permissions, chrome_url_overrides, and options_ui.

---

## Development Setup

### Loading the Extension Locally

**Chrome / Chromium-based browsers:**
1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** and select the repository root directory
4. Open a new tab to see the extension in action

**Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from the repository root
4. Open a new tab

### Testing

There is no automated test suite. Testing is manual:
- Open new tabs and verify the layout renders correctly
- Test drag-and-drop of folders between and within columns
- Toggle settings in the options panel and verify live updates
- Test context menus (right-click folders, columns)
- Verify keyboard navigation (Tab, Enter, Escape)
- Test import/export of settings

---

## Architecture

### Single-Page Application

The entire extension is a single page (`newtab.html`) driven by one JavaScript file (`newtab.js`). There are no modules, no imports, no framework — just a self-contained script that:

1. Reads configuration from `localStorage`
2. Fetches bookmark data from browser APIs
3. Renders the multi-column layout into the DOM
4. Attaches event handlers for interactivity
5. Dynamically generates CSS for theming

### Data Flow

```
Browser APIs (bookmarks, topSites, sessions)
        │
        ▼
   Data Retrieval Functions (getSubTree, getTop, getClosed, getDevices)
        │
        ▼
   Rendering Functions (render, renderAll, renderColumn, renderColumns)
        │
        ▼
   DOM (newtab.html body)
        │
        ▼
   Event Handlers (click, drag, context menu, keyboard)
        │
        ▼
   State Updates (localStorage ↔ saveColumns/loadColumns)
```

### Storage

All state is stored in `localStorage` with these key patterns:

| Key Pattern             | Purpose                                      |
|-------------------------|----------------------------------------------|
| `column.{x}.{y}`       | Folder ID at column x, row y                 |
| `open.{folderId}`       | Whether a folder is expanded (if remember_open enabled) |
| `options.{configKey}`   | User configuration values                    |

---

## Code Reference (`newtab.js`)

### Initialization

The entry point is an `addEventListener('DOMContentLoaded', ...)` handler that:
1. Calls `loadSettings()` to apply configuration to the page
2. Calls `renderColumns()` to build the layout
3. Calls `initSettings()` to wire up the options panel
4. Sets up global event listeners (keyboard, tooltips)

### Core Functions

#### Rendering

| Function | Description |
|----------|-------------|
| `render(node, target)` | Renders a single bookmark or folder node as an `<li>` element |
| `renderAll(nodes, target, toplevel)` | Renders an array of nodes into a target `<ul>` |
| `renderColumn(index, target)` | Renders an entire column with all its folders |
| `renderColumns()` | Main render — builds all columns and appends to page |
| `renderMenu(items, x, y)` | Creates and displays a context menu at given coordinates |

#### Folder Management

| Function | Description |
|----------|-------------|
| `toggle(node, a)` | Opens/closes a folder with slide animation |
| `addFolderHandlers(node, a)` | Attaches click and context-menu handlers to a folder |
| `addColumnHandlers(index, ul)` | Attaches context-menu and drop handlers to a column |

#### Drag and Drop

| Function | Description |
|----------|-------------|
| `enableDragColumn(id, column)` | Makes a column header draggable |
| `enableDragFolder(node, a)` | Makes a folder draggable |
| `enableDragDrop()` | Initializes the main drop zone on `<body>` |
| `getDropTarget(event)` | Determines the valid drop target from a drag event |
| `addColumn(ids, index)` | Creates or moves a column at a given index |
| `addRow(id, xpos, ypos)` | Adds or moves a folder within a column |
| `removeColumn(index)` | Deletes a column and its stored data |
| `removeRow(x, y)` | Removes a folder from a column |

#### Data Retrieval

| Function | Description |
|----------|-------------|
| `getChildrenFunction(node)` | Returns a callback that fetches children for a node type |
| `getSubTree(id, callback)` | Fetches a bookmark subtree or special folder contents |
| `getTop(callback)` | Fetches most-visited sites via `chrome.topSites` |
| `getClosed(callback)` | Fetches recently closed tabs via `chrome.sessions` |
| `getDevices(callback)` | Fetches sessions from other devices |

#### Configuration

| Function | Description |
|----------|-------------|
| `getConfig(key)` | Gets a config value, falling back to defaults |
| `setConfig(key, value)` | Stores a config value and applies it live |
| `getStyle(key, value)` | Generates CSS rule(s) for a given config key/value |
| `loadSettings()` | Applies all config values to the page |
| `loadColumns()` | Reads column layout from localStorage |
| `saveColumns()` | Persists column layout to localStorage |
| `initSettings()` | Initializes the options panel UI controls |
| `initConfig(key)` | Wires up a single option control |
| `showConfig(key)` | Reflects a stored value back into its UI control |
| `showOptions(show)` | Shows or hides the options panel |

#### Utility

| Function | Description |
|----------|-------------|
| `scale(value, mid, max, min)` | Maps values from `[0, 1, 2]` to `[min, mid, max]` — used for slider normalization |
| `getIcon(node)` | Returns the appropriate icon URL for a node |
| `openLink(node, newtab)` | Opens a URL respecting the user's tab preference |
| `updateTooltips()` | Adds title attributes to elements with truncated text |

---

## Configuration Schema

The `config` object defines all user-configurable options with their defaults:

```javascript
{
  // Typography
  font: 'Sans-serif',       // Font family
  font_size: 16,             // Font size in pixels (6-100)
  font_weight: 400,          // Font weight (100-900)

  // Theme & Colors
  theme: 'Default',
  font_color: '#555555',
  background_color: '#ffffff',
  highlight_color: '#e4f4ff',
  highlight_font_color: '#000000',
  shadow_color: '#57b0ff',

  // Background Image
  background_image: '',       // URL
  background_image_file: '',  // Local file (data URI)
  background_align: 'left top',
  background_repeat: 'repeat',
  background_size: 'auto',

  // Layout
  shadow_blur: 1,            // Highlight shadow (0=off, 1=normal, 2=max)
  highlight_round: 1,        // Border radius (0=none, 1=normal, 2=max)
  fade: 1,                   // Page fade-in duration
  spacing: 1,                // Item spacing
  width: 1,                  // Column width
  h_pos: 1,                  // Horizontal alignment
  v_margin: 1,               // Top margin
  slide: 1,                  // Folder animation speed

  // Behavior
  hide_options: 0,           // Hide options button
  lock: 0,                   // Lock layout (prevent drag)
  show_top: 1,               // Show most visited
  show_apps: 1,              // Show apps link
  show_recent: 1,            // Show recent bookmarks
  show_closed: 1,            // Show recently closed
  show_devices: 1,           // Show other devices
  show_root: 0,              // Show top-level bookmark folders
  newtab: 0,                 // 0=current tab, 1=new foreground, 2=new background
  remember_open: 1,          // Remember which folders are open
  auto_close: 0,             // Auto-close sibling folders
  auto_scale: 1,             // Auto-scale HiDPI

  // Advanced
  css: '',                   // Custom CSS
  number_top: 10,            // Number of most visited items (1-10)
  number_closed: 10,         // Number of recently closed items (1-25)
  number_recent: 10          // Number of recent bookmarks (1-1000)
}
```

### Built-in Themes

11 themes are available: **Default**, **Classic**, **Dusk**, **Elegant**, **Frosty**, **Hacker**, **Melon**, **Midnight**, **Slate**, **Trees**, **Valentine**, **Warm**. Each theme overrides the color-related config keys.

---

## Browser API Permissions

Declared in `manifest.json`:

| Permission     | Usage                                           |
|----------------|-------------------------------------------------|
| `bookmarks`    | Read the user's bookmark tree                   |
| `favicon`      | Access favicon images for bookmarked URLs       |
| `topSites`     | Retrieve most-visited sites                     |
| `tabs`         | Open and manage browser tabs                    |
| `fontSettings` | List system fonts for the font picker           |
| `sessions`     | Access recently closed tabs and other devices    |

**Optional permission:** `file:///` — allows opening local file URLs.

---

## Browser Compatibility

| Browser             | Support Level |
|---------------------|---------------|
| Chrome (v104+)      | Full          |
| Firefox             | Full (with favicon provider option) |
| Vivaldi             | Full (hides separators) |
| Other Chromium-based | Should work   |

Firefox-specific differences:
- Uses third-party favicon providers (DuckDuckGo, Google, Ecosia, Icon Horse) since Firefox lacks a native favicon API
- Some Chrome-specific APIs are shimmed or conditionally used

---

## Privacy

- **No data collection.** All user data (bookmarks, settings) stays in the browser's local storage.
- **Firefox only:** Domain names may be sent to the selected third-party favicon provider. This is configurable in settings.
- See [privacy.md](privacy.md) for the full privacy policy.

---

## Contributing

1. Fork the repository
2. Load the extension locally (see Development Setup above)
3. Make changes — no build step needed, just reload the extension
4. Test manually across browsers
5. Submit a pull request

Since this is a zero-dependency, no-build project, contributing is straightforward: edit the source files and reload.
