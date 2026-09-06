# RSVP setup — about 10 minutes

The website is static, so the guest list lives in your Google Sheet instead of in
this (public) repo. Nobody can read your guest list from the website's source.

## 1. Prepare the spreadsheet

Open your existing guest-list sheet. Two things matter:

**Tab name.** The tab holding guests must be called `Guests`. If yours is called
something else, either rename the tab or change `guestSheetName` at the top of
`Code.gs`.

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

**About the Household column.** This is what groups people onto one invitation.
Put the same value in it for everyone invited together — the household name,
an address, anything consistent:

| First Name | Last Name | Household |
|---|---|---|
| Anna | Reed | Reed Family |
| David | Reed | Reed Family |
| Priya | Nair | Nair |

When Anna looks herself up, she'll RSVP for David too. Without this column each
person RSVPs individually, which still works — it's just more steps for couples.

The script only ever reads these columns. Any other columns you keep (address,
phone, notes) are ignored and stay private.

## 2. Add the script

1. In the spreadsheet: **Extensions → Apps Script**.
2. Delete the placeholder `myFunction` code.
3. Paste in the entire contents of `Code.gs` from this folder.
4. Save (disk icon).

Now test it before deploying: in the toolbar function dropdown pick
**`testGuestList`**, click **Run**, and approve the permission prompt
(it's your own script reading your own sheet — choose your account, then
*Advanced → Go to project → Allow*).

Open **Execution log**. You should see your guest count and a few sample names.
If it says 0 guests, the tab name or the column headers don't match — fix and
re-run.

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
