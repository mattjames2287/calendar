# Personal Calendar (Standalone)

A sleek, dark, read-only calendar display for desktop/mobile + Raspberry Pi.

- **Calendar events** are mirrored from a public iCloud/Howbout **ICS** feed (via Apps Script JSONP).
- **Slideshow photos** are loaded from a **Google Drive folder** (no images stored in this GitHub repo).
- **Month-only** view (current month), with **Today highlighted**.
- In **landscape** (Pi display), the slideshow appears on the left.

## Setup

1. Create a Google Apps Script Web App using the provided `Code.gs` (paste from chat).
2. Deploy as Web App (Execute as: Me, Who has access: Anyone).
3. Put the `/exec` URL into `config.js` as `API_BASE`.
4. Ensure your Drive slideshow folder is shared as **Anyone with the link: Viewer**.

## Diagnostics

- Add `?diag=1` to the page URL to show the diagnostics overlay (optional if enabled in app.js).
