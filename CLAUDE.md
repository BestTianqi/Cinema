# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

智能影院选座系统 (Smart Cinema Seat Selection) — a 4-person team university project. The goal is a cinema seat selection web app that helps users (students, couples, families, elderly, groups) quickly find optimal seats via intelligent recommendations, heatmaps, and experience scoring.

**Core principle**: "Don't Make Me Think" — the system proactively recommends seats; users complete selection in ≤3 steps.

## Tech Stack & Constraints

- **HTML5 + CSS3 + vanilla JavaScript (ES6+)** — no frameworks
- **Canvas API** — mandatory for drawing cinema layout and heatmap (no third-party chart libs like ECharts, D3, AntV)
- **LocalStorage** — all data persistence (orders, preferences), no backend/database
- **Responsive** — must work on PC, iPad, and mobile
- **No build tools required** — pure static files, open `index.html` directly

## Key Modules (from README)

1. **Smart Recommendation** — recommends seats from per-member **name + numeric age** input. Ages are classified by the assignment's thresholds (teen `<15`, adult `15–59`, senior `≥60`). Hard rules: teens never in the front 3 rows, seniors never in the back 3 rows, adults unrestricted. Ticket-type strategy: couple→middle-area consecutive pair, family→mid/back consecutive, group→**must be same row consecutive** (no fallback). Top-3 candidates with per-rule reasoning text.
2. **Manual Selection** — click to select, Ctrl+click for multi-select, drag-select (bonus)
3. **Heatmap** — Canvas-drawn heat distribution overlay (red=hot, yellow=normal, green=cold)
4. **Experience Scoring** — rates seats on viewing angle, screen distance, surrounding vacancy
5. **Accessibility** — large font, high contrast, color-blind friendly modes
6. **Order Center** — book, pay, cancel orders; stored in LocalStorage

## Planned Architecture

The implementation plan (`实现思路文档.md`, ~50000 chars) defines this architecture:

- **Event-driven**: Pub-Sub via `EventBus` for inter-module communication
- **Single source of truth**: `seatData.js` manages all seat state centrally
- **Separation of concerns**: `engine/` (logic), `render/` (Canvas), `ui/` (DOM panels), `data/` (persistence)
- **Rule engine pattern** for recommendations: condition + action + priority, stored in an array (not hardcoded if-else chains)
- **Canvas rendering**: rAF-driven redraw loop with dirty flag to avoid redundant repaints
- **CSS variables** for theming (normal / large-font / high-contrast / color-blind)

### Recommended File Structure

```
js/
  main.js              # Entry, module initialization
  config.js            # Hall dimensions, seat layout params
  data/
    seatData.js        # Seat state (available/recommended/selected/sold)
    hallConfig.js      # Hall layout config (rows, cols, aisles)
    orderStorage.js    # LocalStorage CRUD for orders
  engine/
    recommendEngine.js # Recommendation rule engine
    scoreEngine.js     # Viewing experience scorer
    heatmapEngine.js   # Heat data calculation
  render/
    canvasRenderer.js  # Core Canvas drawing (seats, screen, labels)
    heatmapRenderer.js # Heat color overlay
    interactionLayer.js# Hover/selection highlight & animation
  ui/
    recommendPanel.js  # User input form + recommendation results
    orderPanel.js      # Order list sidebar
    scorePanel.js      # Score detail panel
    accessibilityPanel.js
  utils/
    geometry.js        # Angle, distance calculations
    eventBus.js        # Pub-Sub event bus
```

## Critical Implementation Details

- **Canvas `width`/`height` attrs** set resolution, CSS `width`/`height` sets display size. Always do `canvas.width = clientWidth * devicePixelRatio` to avoid blurriness.
- **Hit testing**: Compute row/col from click coordinates via math (O(1)) rather than iterating all seats (O(n)).
- **Seat data model**: `{ id, row, col, status, score, heatLevel }` — status is `available | recommended | selected | sold | locked`.
- **Mobile touch**: Use `pointerdown`/`pointerup` to avoid 300ms click delay; ensure touch targets ≥44px logical area.
- **LocalStorage**: Wrap in try-catch (may throw in private browsing or when quota exceeded).

## Design Reference

- Visual style: dark tech aesthetic inspired by Apple/Tesla/OpenAI — deep navy background (`#0a0e27`), electric blue accents (`#4FC3F7`), semi-transparent glassmorphism panels
- Color-blind mode: replace red/green with blue/orange throughout
