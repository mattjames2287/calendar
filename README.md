# Personal Calendar (Read‑Only Howbout Mirror)

This repo contains a sleek, dark, **read‑only** calendar webpage designed for:
- Desktop + mobile browsers
- Raspberry Pi always‑on display (kiosk mode)

It mirrors your Howbout calendar by reading your **iCloud Public Calendar (ICS)** link through a small Google Apps Script proxy (JSONP).

---

## 1) Your Howbout / iCloud Public Calendar link

You shared a link that starts with:

`webcal://p108-caldav.icloud.com/published/...`

For Apps Script, convert it to **https** like this:

`https://p108-caldav.icloud.com/published/...`

(Just replace `webcal://` with `https://`)

---

## 2) Create the Apps Script proxy (read‑only)

1. Go to **script.new** and create a new Apps Script project.
2. Paste this code as `Code.gs` (replace the URL + TOKEN):

```js
const HOWBOUT_ICS_URL = "PASTE_HTTPS_ICS_URL_HERE";
const TOKEN = "CHANGE_ME_TO_A_RANDOM_STRING";

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const cb = (p.callback || "").trim();
  const route = (p.route || "").toLowerCase();

  try {
    if ((p.token || "") !== TOKEN) throw new Error("Unauthorized");

    if (route === "range") {
      const start = (p.start || "").trim(); // YYYY-MM-DD
      const end = (p.end || "").trim();     // YYYY-MM-DD (exclusive)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error("Bad start/end");
      const events = fetchAndParseIcs_(start, end);
      return jsonp_(cb, { ok:true, start, end, events });
    }

    return jsonp_(cb, { ok:false, error:"Unknown route" }, 400);
  } catch (err) {
    return jsonp_(cb, { ok:false, error: String(err && err.message ? err.message : err) }, 400);
  }
}

function fetchAndParseIcs_(startIso, endIso) {
  const resp = UrlFetchApp.fetch(HOWBOUT_ICS_URL, { muteHttpExceptions:true, followRedirects:true });
  const ics = resp.getContentText();

  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");

  const blocks = ics.split("BEGIN:VEVENT").slice(1).map(s => "BEGIN:VEVENT" + s.split("END:VEVENT")[0] + "END:VEVENT");
  const out = [];

  for (const b of blocks) {
    const summary = getIcsField_(b, "SUMMARY") || "(No title)";
    const dtStartRaw = getIcsField_(b, "DTSTART");
    const dtEndRaw = getIcsField_(b, "DTEND");
    if (!dtStartRaw) continue;

    const ds = parseIcsDate_(dtStartRaw);
    const de = dtEndRaw ? parseIcsDate_(dtEndRaw) : null;
    if (!ds) continue;

    // overlap with range
    if (ds >= end || (de && de <= start)) continue;

    const allDay = /^\d{8}$/.test(dtStartRaw);

    out.push({
      title: summary,
      start: ds.toISOString(),
      end: de ? de.toISOString() : "",
      allDay
    });
  }

  out.sort((a,b) => a.start.localeCompare(b.start));
  return out;
}

function getIcsField_(block, key) {
  const unfolded = block.replace(/\r?\n[ \t]/g, "");
  const re = new RegExp("^" + key + "(?:;[^:]*)?:(.*)$", "m");
  const m = unfolded.match(re);
  return m ? m[1].trim() : "";
}

function parseIcsDate_(raw) {
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0,4), m = raw.slice(4,6), d = raw.slice(6,8);
    return new Date(`${y}-${m}-${d}T00:00:00Z`);
  }
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const y = raw.slice(0,4), m = raw.slice(4,6), d = raw.slice(6,8);
    const hh = raw.slice(9,11), mm = raw.slice(11,13), ss = raw.slice(13,15);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
  }
  if (/^\d{8}T\d{6}$/.test(raw)) {
    const y = raw.slice(0,4), m = raw.slice(4,6), d = raw.slice(6,8);
    const hh = raw.slice(9,11), mm = raw.slice(11,13), ss = raw.slice(13,15);
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
  }
  return null;
}

function jsonp_(cb, obj) {
  const payload = JSON.stringify(obj);
  const body = cb ? `${cb}(${payload});` : payload;
  return ContentService.createTextOutput(body)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
```

3. **Deploy** → *New deployment* → **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the **Web app URL**.

---

## 3) Configure the website

Open `config.js` and paste:
- `API_BASE` = your Apps Script Web App URL
- `TOKEN` = the same TOKEN you set in Apps Script

---

## 4) GitHub Pages

Enable GitHub Pages for this repo (Settings → Pages):
- Source: **Deploy from a branch**
- Branch: `main` (or `master`) / root

Your calendar will be at:
- `https://<your-username>.github.io/<repo-name>/`

---

## Notes

- The page is **read-only**.
- Times are displayed in the viewer’s **local timezone**.
- If you want this to always show the current month on your Raspberry Pi, use Chromium kiosk mode.

