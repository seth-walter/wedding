# RSVP setup — about 10 minutes

The website is static, so the guest list lives in your Google Sheet instead of in
this (public) repo. Nobody can read your guest list from the website's source.

## 0. First: lock down sharing on the spreadsheet

Open the sheet → **Share** → under *General access* set it to
**Restricted**, so only people you name can open it.

If it says "Anyone with the link", your guest list — names, addresses, emails,
phone numbers — is readable by anyone who has or guesses the URL. The RSVP
system does **not** need link sharing: the Apps Script runs as you and reads the
sheet with your own account's access.

## 1. Prepare the spreadsheet

Open your existing guest-list sheet. Two things matter:

**Tab name.** The tab holding guests must be called `Guests`. If yours is called
something else, either rename the tab or change `guestSheetName` at the top of
`Code.gs`. **← You almost certainly need to do this.**

**Header row.** Your sheet keeps merged group labels ("RSVP", "Hotel") on row 1
and the real headers on row 2. `headerRow: 'auto'` handles that by scanning the
first five rows for the one with the most recognizable headers, so you don't
need to change anything — but if you ever restructure the top of the sheet,
you can pin it explicitly (`headerRow: 2`).

**Columns.** These headers are recognized automatically (case and punctuation
don't matter):

| Purpose | Accepted headers |
|---|---|
| First name | `First Name`, `First`, `Given Name` |
| Last name | `Last Name`, `Last`, `Surname` |
| Full name (alternative) | `Name`, `Full Name`, `Guest` |
| Household | `Household`, `Party`, `Group`, `Family`, `Invitation` |

If your headers differ, add yours to the front of the matching list in
`COLUMN_ALIASES` in `Code.gs`.

**About grouping people onto one invitation.** For each guest the script tries
three things in order:

1. **`Household`** — everyone sharing a value RSVPs together. This is the one to
   use: it's immune to address typos and reads clearly.
2. **`Address`** — used only when `Household` is blank for that row.
3. **Neither** — that guest RSVPs alone.

So when Anna Reed looks herself up, she answers for David too, and one reply
covers the household.

⚠️ **Your `Household` column is only partly filled in.** Anyone left blank falls
through to `Address`, and anyone blank in both RSVPs alone. That's correct for
genuinely solo guests and wrong for half of a couple. Run `testGuestList`
(below) — it prints exactly who is currently set to RSVP alone, so you can scan
that list and fill in the ones that need it.

If you rely on `Address` for some rows, spelling matters there: "12 Oak St" and
"12 Oak Street" are two different households. `Household` avoids that entirely.

**Plus ones** are read from your existing columns:

- `Plus One Name` filled in → that person appears by name in the party, and can
  also look themselves up.
- `Plus One` set to Yes (or Y/X/True) with no name → the party shows "Guest of
  Anna Reed" and Anna types their name when she RSVPs.
- Both blank → no plus one offered.

The script only ever reads the name, address, and plus-one columns. Everything
else you keep — phone, notes, table assignments, who's a bridesmaid — is ignored
and never leaves the sheet.

## 2. Add the script

1. In the spreadsheet: **Extensions → Apps Script**.
2. Delete the placeholder `myFunction` code.
3. Paste in the entire contents of `Code.gs` from this folder.
4. Save (disk icon).

Now test it before deploying: in the toolbar function dropdown pick
**`testGuestList`**, click **Run**, and approve the permission prompt
(it's your own script reading your own sheet — choose your account, then
*Advanced → Go to project → Allow*).

Open **Execution log**. You should see:

- how many people and households were loaded, and how many are plus ones;
- **a list of every guest currently set to RSVP alone** — scan this and fill in
  `Household` for anyone who should be grouped with someone else;
- a sample of how parties will look when a guest finds themselves.

If it says 0 guests, the tab name or the column headers don't match — fix and
re-run. Re-run it any time you edit the guest list; no redeploy needed.

## 3. Deploy it as a web app

1. **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. **Deploy**, approve if prompted, and **copy the Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

"Anyone" sounds alarming but is required — your guests aren't signed into
Google. It means anyone can *call* the endpoint, not that anyone can read your
sheet. The script only ever returns the single household matching a full name
that's already on your list.

## 4. Connect the website

Open `js/rsvp.js` and paste the URL into the first line:

```js
const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycb.../exec";
```

Commit and push. Until this is filled in, the site politely says the RSVP form
is coming soon.

## 5. Test it end to end

Visit the live site, look up your own name, and submit. Then check the
spreadsheet — two new tabs appear automatically:

- **RSVPs** — one row per guest per submission. If someone submits twice, the
  newest row wins; sort by Timestamp to see the latest.
- **Lookup Log** — every search attempt and its outcome. Worth a glance
  occasionally: a run of "not found" entries for names you don't recognize would
  mean someone is poking at it.

Also try a made-up name and confirm you get the "couldn't find that name"
message.

## Options you can change

At the top of `Code.gs`:

- `mealOptions` — set to e.g. `['Beef', 'Chicken', 'Vegetarian']` to ask
  attending guests for a meal choice. Leave `[]` to skip the question.
- `askDietary` / `askSongRequest` — toggle those fields.
- `maxSearchesPerMinute` — throttle for all visitors combined. 20 is generous
  for a wedding and low enough to frustrate scripted guessing.

**After any change to `Code.gs`, you must redeploy:** Deploy → Manage
deployments → pencil icon → Version: New version → Deploy. The URL stays the
same. Editing the sheet's guest list needs no redeploy.

If you change the matching logic, you can sanity-check it against a fake guest
list without touching your real sheet:

```
node apps-script/test-rsvp.js
```

## Honest limits of name lookup

The endpoint is public, so someone who knows a real guest's full name could RSVP
as them. Realistically that means a guest could RSVP on a friend's behalf, which
is usually harmless. What it does prevent: strangers browsing or guessing their
way onto the list, and anyone discovering who else is invited.

If you later want a harder gate, unique per-household codes printed on the
invitations are the upgrade — worth deciding before invitations go to print.
