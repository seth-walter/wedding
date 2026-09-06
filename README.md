# Julie & Seth — Wedding Website

A static wedding website hosted on GitHub Pages.

## Editing content

- **Text** (story, times, FAQ, registry, hotels…): edit `index.html` — every
  section is labeled with an HTML comment.
- **Date / venue / calendar event**: edit the `WEDDING` config at the top of
  `js/main.js` (drives the countdown, add-to-calendar buttons) and the visible
  text in `index.html`. The map iframe URL is in the Travel section of
  `index.html`.
- **Colors / fonts**: the `:root` variables at the top of `css/style.css`.
- **Photos**: see `images/README.md`.
- **RSVP**: the guest list lives in a private Google Sheet, not in this repo.
  See `apps-script/SETUP.md` to connect it. Run `node apps-script/test-rsvp.js`
  after editing `apps-script/Code.gs`.

## Local preview

Open `index.html` in a browser, or run `python -m http.server` in this folder.
