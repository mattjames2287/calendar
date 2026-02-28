# Personal Calendar (Standalone)

Dark, modern month-only calendar (current month) + optional week view, with:
- Today highlighted
- Read-only events pulled from Howbout via iCloud public calendar (ICS)
- Landscape-only slideshow (ideal for Raspberry Pi display) pulled from an iCloud Shared Album

## Setup

### 1) Apps Script (backend)
Use the Apps Script provided in chat (Code.gs). Deploy as Web App:
- Execute as: Me
- Who has access: Anyone

### 2) config.js (frontend)
Open `config.js` and set:

- `API_BASE`: your Apps Script Web App URL (ends with `/exec`)
- `TOKEN`: the same token you set in Code.gs

### 3) GitHub Pages
Commit & push, then enable GitHub Pages for this repo.

## Notes
- The calendar always shows the *current month* (28/30/31 days) and does not navigate to other months.
- Slideshow appears only in landscape/wide screens.
