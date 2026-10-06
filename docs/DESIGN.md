# Design notes (as built)

The FRAME Gaming Café `DESIGN.md` was never attached to the project, so this file describes the design as it was actually built from the written brief. If you have the FRAME file, send it and the tokens in `app/globals.css` can be aligned to it.

- **Direction:** minimalist, technical, editorial, monochrome. No gradients, glass effects or neon.
- **Colors:** light `#FFFFFF / #000000 / #666666 / #E5E5E5`; dark `#000000 / #EDEDED / #A0A0A0 / #2A2A2A` (text slightly softer than pure white). Follows the system light/dark setting.
- **Type:** Instrument Serif for headings and the big numerals, Geist for text, Geist Mono for timestamps, course codes, statuses and metadata. The fonts are bundled with the app (npm packages), so nothing loads from outside.
- **Layout:** thin 1px borders, generous whitespace, list rows instead of cards. Desktop: left sidebar plus content. Tablet: single-column content. Mobile: top bar with horizontally scrolling navigation, stacked metadata, full-width controls and 44px touch targets.
- **Theme:** follows the device by default; the Theme button saves a light or dark choice in a cookie so the server renders it with no flash.
- **Details:** numbered navigation and sections, hairline grid on the home page, corner marks on the connection panel, status shown as a dot shape plus a word.
- **Motion:** 150ms border/color/opacity transitions and one 250ms fade on page load. All of it is turned off with `prefers-reduced-motion`.
- **Accessibility:** semantic HTML, labelled inputs, skip link, visible focus outline, `aria-current` on navigation, `role="alert"` on form errors, and status always written as text (NEW/READ, CONNECTED, and so on), never color alone.
