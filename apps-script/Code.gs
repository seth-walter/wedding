/**
 * Julie & Seth — RSVP backend (Google Apps Script)
 *
 * Bound to the guest-list spreadsheet. Deployed as a web app, this exposes two
 * actions to the website:
 *   search  — look up a guest by full name, return their household
 *   submit  — record RSVPs for that household
 *
 * The guest list never leaves the spreadsheet: search returns only the one
 * matching household, never a list, so the endpoint cannot be used to
 * enumerate who is invited.
 *
 * See SETUP.md for deployment steps.
 */

const CONFIG = {
  // Tab names in this spreadsheet. The RSVP and log tabs are created if missing.
  guestSheetName: 'Guests',
  rsvpSheetName: 'RSVPs',
  logSheetName: 'Lookup Log',

  // Which row holds the column headers. 'auto' scans the first few rows and
  // picks the one with the most recognizable headers, which handles sheets
  // where row 1 is a merged group label like "RSVP | Hotel".
  headerRow: 'auto',

  // Let a guest with a plus one RSVP for them too. If the Plus One Name column
  // is filled in, that name is shown; otherwise the guest can type it in.
  plusOnes: true,

  // Plated-meal choices offered to each guest. Leave empty to hide the question
  // entirely — currently empty because catering is likely a food truck, where
  // guests choose on the day. If that changes, list the options here, e.g.
  // ['Beef', 'Chicken', 'Vegetarian'], and redeploy.
  mealOptions: [],

  // Ask each guest for dietary restrictions.
  askDietary: true,

  // Optional fun extras on the RSVP form.
  askSongRequest: true,

  // Reject lookups once this many arrive in a 60-second window (all visitors
  // combined). Wedding traffic never approaches this; scripted guessing does.
  maxSearchesPerMinute: 20,

  // Allow a guest to submit again to correct a mistake. Each submission is
  // appended, and the newest row for a household is the authoritative one.
  allowResubmit: true,

  // Record every lookup attempt on the Lookup Log tab.
  enableLogging: true,
};

/**
 * Column headers understood in the Guests tab, in priority order. Matching is
 * case- and punctuation-insensitive, so "First Name" and "first_name" both work.
 * Add your own header text to the front of a list if it is not recognized.
 */
const COLUMN_ALIASES = {
  firstName: ['first name', 'first', 'firstname', 'given name', 'guest first name'],
  lastName: ['last name', 'last', 'lastname', 'surname', 'family name', 'guest last name'],
  fullName: ['full name', 'name', 'guest', 'guest name', 'invitee'],
  household: ['household', 'household id', 'party', 'party id', 'group', 'family', 'invitation'],
  address: ['address', 'mailing address', 'street address', 'home address'],
  email: ['email', 'e mail', 'email address'],
  plusOneName: ['plus one name', 'plus 1 name', 'guest of', 'plus one guest'],
  plusOneAllowed: ['plus one', 'plus 1', 'plus one allowed', 'guest allowed'],
};

/* ------------------------------------------------------------------ *
 * Web app entry points
 * ------------------------------------------------------------------ */

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');

    if (action === 'search') return json(handleSearch(body));
    if (action === 'submit') return json(handleSubmit(body));
    return json({ ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server_error' });
  }
}

function doGet() {
  // Browsers hitting the URL directly get a harmless response, not the config.
  return json({ ok: true, service: 'rsvp' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

function handleSearch(body) {
  const first = normalize(body.firstName);
  const last = normalize(body.lastName);

  if (!first || !last) {
    return { ok: false, error: 'need_full_name' };
  }

  if (!underRateLimit()) {
    logLookup(body.firstName, body.lastName, 'throttled');
    return { ok: false, error: 'rate_limited' };
  }

  const guests = readGuests();
  const target = first + ' ' + last;

  // Unnamed plus ones have no name to match against, so they are never a
  // search result — only ever a row inside the household that found them.
  const searchable = guests.filter(function (g) { return !!g.normalized; });

  // Exact match on the normalized full name.
  let matches = searchable.filter(function (g) { return g.normalized === target; });

  // Fall back to a small edit distance so common typos still find the guest.
  // The budget scales with name length: two edits out of "christopher anderson"
  // is a typo, but two edits out of "jo ng" is a different person entirely.
  if (matches.length === 0) {
    const budget = target.length >= 12 ? 2 : (target.length >= 8 ? 1 : 0);
    if (budget > 0) {
      matches = searchable.filter(function (g) {
        return editDistance(g.normalized, target) <= budget;
      });
    }
  }

  if (matches.length === 0) {
    logLookup(body.firstName, body.lastName, 'not found');
    return { ok: false, error: 'not_found' };
  }

  // A fuzzy match landing on two different households is too ambiguous to guess
  // at — ask for the exact spelling rather than showing someone else's party.
  const distinctHouseholds = {};
  matches.forEach(function (m) { distinctHouseholds[m.household] = true; });
  if (Object.keys(distinctHouseholds).length > 1) {
    logLookup(body.firstName, body.lastName, 'ambiguous');
    return { ok: false, error: 'ambiguous' };
  }

  // Everyone sharing the matched guest's household is invited together.
  const householdId = matches[0].household;
  const members = guests.filter(function (g) { return g.household === householdId; });

  logLookup(body.firstName, body.lastName, 'found: ' + householdId);

  const previous = CONFIG.allowResubmit ? previousResponses(householdId) : {};

  return {
    ok: true,
    household: {
      id: householdId,
      members: members.map(function (g) {
        return {
          id: g.id,
          name: g.displayName,
          isPlusOne: !!g.isPlusOne,
          needsName: !!g.needsName,
          previous: previous[g.id] || null,
        };
      }),
    },
    options: {
      meals: CONFIG.mealOptions,
      askDietary: CONFIG.askDietary,
      askSongRequest: CONFIG.askSongRequest,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Submit
 * ------------------------------------------------------------------ */

function handleSubmit(body) {
  const householdId = String(body.householdId || '');
  const responses = body.responses;

  if (!householdId || !Array.isArray(responses) || responses.length === 0) {
    return { ok: false, error: 'bad_request' };
  }

  const guests = readGuests();
  const members = guests.filter(function (g) { return g.household === householdId; });

  if (members.length === 0) {
    return { ok: false, error: 'not_found' };
  }

  // Only accept responses for guests who really belong to this household, so a
  // crafted request cannot add names to the list.
  const validIds = {};
  members.forEach(function (g) { validIds[g.id] = g; });

  const rows = [];
  const now = new Date();

  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    const guest = validIds[String(r.id)];
    if (!guest) continue;

    // An unnamed plus one is the one case where the guest supplies the name.
    let name = guest.displayName;
    if (guest.needsName && r.name) {
      name = truncate(String(r.name).trim(), 80) + ' (guest of ' + guest.hostName + ')';
    }

    rows.push([
      now,
      householdId,
      name,
      r.attending ? 'Yes' : 'No',
      truncate(r.meal, 100),
      truncate(r.dietary, 500),
      truncate(body.email, 200),
      truncate(body.songRequest, 300),
      truncate(body.note, 1000),
    ]);
  }

  if (rows.length === 0) {
    return { ok: false, error: 'bad_request' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getOrCreateSheet(CONFIG.rsvpSheetName, [
      'Timestamp', 'Household', 'Guest', 'Attending',
      'Meal', 'Dietary', 'Email', 'Song Request', 'Note',
    ]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  } finally {
    lock.releaseLock();
  }

  const attending = rows.filter(function (r) { return r[3] === 'Yes'; }).length;
  return { ok: true, attending: attending, total: rows.length };
}

/* ------------------------------------------------------------------ *
 * Reading the guest list
 * ------------------------------------------------------------------ */

function readGuests() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.guestSheetName);
  if (!sheet) {
    throw new Error('No tab named "' + CONFIG.guestSheetName + '" in this spreadsheet.');
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headerIndex = findHeaderRow(values);
  const cols = mapColumns(values[headerIndex]);
  const guests = [];

  for (let r = headerIndex + 1; r < values.length; r++) {
    const row = values[r];

    let first = cols.firstName >= 0 ? String(row[cols.firstName] || '').trim() : '';
    let last = cols.lastName >= 0 ? String(row[cols.lastName] || '').trim() : '';

    // Some lists keep one "Name" column instead of separate first/last.
    if ((!first || !last) && cols.fullName >= 0) {
      const parts = String(row[cols.fullName] || '').trim().split(/\s+/);
      if (parts.length >= 2) {
        first = first || parts[0];
        last = last || parts[parts.length - 1];
      }
    }

    if (!first || !last) continue;

    const displayName = first + ' ' + last;

    // Household first, then a shared address, then the guest alone. Checked per
    // row rather than per column, so a blank Household cell still groups a
    // couple by their address instead of splitting them onto separate replies.
    const household = firstNonEmpty([
      cols.household >= 0 ? row[cols.household] : '',
      cols.address >= 0 ? row[cols.address] : '',
    ]) || 'row-' + (r + 1);

    guests.push({
      id: 'g' + (r + 1),
      displayName: displayName,
      normalized: normalize(first) + ' ' + normalize(last),
      household: household,
    });

    // Plus ones live on the invited guest's row rather than getting their own,
    // so give them a seat in the same household. A named plus one is shown by
    // name; an unnamed but permitted one is filled in by the guest.
    if (!CONFIG.plusOnes) continue;

    const plusName = cols.plusOneName >= 0
      ? String(row[cols.plusOneName] || '').trim()
      : '';
    const plusAllowed = cols.plusOneAllowed >= 0 && isYes(row[cols.plusOneAllowed]);

    if (plusName) {
      guests.push({
        id: 'g' + (r + 1) + 'p',
        displayName: plusName,
        normalized: normalize(plusName),
        household: household,
        isPlusOne: true,
        hostName: displayName,
      });
    } else if (plusAllowed) {
      guests.push({
        id: 'g' + (r + 1) + 'p',
        displayName: 'Guest of ' + displayName,
        normalized: '',           // unnamed: never matchable by search
        household: household,
        isPlusOne: true,
        needsName: true,
        hostName: displayName,
      });
    }
  }

  return guests;
}

/**
 * Finds the header row. Sheets often reserve row 1 for merged group labels, so
 * scan the first few rows and take whichever matches the most known headers.
 */
function findHeaderRow(values) {
  if (CONFIG.headerRow !== 'auto') return Number(CONFIG.headerRow) - 1;

  const limit = Math.min(5, values.length);
  let best = 0;
  let bestScore = -1;

  for (let r = 0; r < limit; r++) {
    const cols = mapColumns(values[r]);
    let score = 0;
    Object.keys(cols).forEach(function (k) { if (cols[k] >= 0) score++; });

    // A header row is useless without a name column.
    const hasName = cols.firstName >= 0 || cols.fullName >= 0;
    if (hasName && score > bestScore) { bestScore = score; best = r; }
  }

  return best;
}

function firstNonEmpty(candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const v = String(candidates[i] == null ? '' : candidates[i]).trim();
    if (v) return v;
  }
  return '';
}

function isYes(v) {
  const s = normalize(v);
  return s === 'yes' || s === 'y' || s === 'true' || s === '1' || s === 'x';
}

function mapColumns(headerRow) {
  const headers = headerRow.map(function (h) { return normalizeHeader(h); });
  const cols = {};

  Object.keys(COLUMN_ALIASES).forEach(function (field) {
    cols[field] = -1;
    const aliases = COLUMN_ALIASES[field];
    for (let a = 0; a < aliases.length; a++) {
      const idx = headers.indexOf(aliases[a]);
      if (idx >= 0) { cols[field] = idx; return; }
    }
  });

  return cols;
}

function previousResponses(householdId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.rsvpSheetName);
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getValues();
  const guests = readGuests();
  const byName = {};
  guests.forEach(function (g) {
    if (g.household === householdId) byName[g.displayName] = g.id;
  });

  const result = {};
  // Later rows overwrite earlier ones, so the newest answer wins.
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][1]) !== householdId) continue;
    const id = byName[String(values[r][2])];
    if (id) result[id] = { attending: String(values[r][3]) === 'Yes' };
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Logging & rate limiting
 * ------------------------------------------------------------------ */

function logLookup(firstName, lastName, outcome) {
  if (!CONFIG.enableLogging) return;
  try {
    const sheet = getOrCreateSheet(CONFIG.logSheetName, ['Timestamp', 'Searched For', 'Outcome']);
    sheet.appendRow([new Date(), truncate(firstName, 60) + ' ' + truncate(lastName, 60), outcome]);
  } catch (err) {
    console.error('log failed', err);
  }
}

function underRateLimit() {
  const cache = CacheService.getScriptCache();
  const key = 'searches-' + Math.floor(Date.now() / 60000);
  const count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), 120);
  return count <= CONFIG.maxSearchesPerMinute;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')        // strip punctuation, incl. apostrophes
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(s, n) {
  const str = String(s == null ? '' : s);
  return str.length > n ? str.slice(0, n) : str;
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;

  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/* ------------------------------------------------------------------ *
 * Run this once from the editor to check your sheet is wired up right.
 * ------------------------------------------------------------------ */

function testGuestList() {
  const guests = readGuests();

  if (guests.length === 0) {
    Logger.log('No guests found — check the tab name and that you have First/Last Name columns.');
    return;
  }

  const households = {};
  guests.forEach(function (g) {
    if (!households[g.household]) households[g.household] = [];
    households[g.household].push(g);
  });

  const plusOnes = guests.filter(function (g) { return g.isPlusOne; });

  Logger.log('%s people across %s households (%s invited guests + %s plus ones).',
    guests.length, Object.keys(households).length,
    guests.length - plusOnes.length, plusOnes.length);

  // Anyone whose household fell through to the row-number fallback has neither
  // a Household nor an Address, so they will RSVP alone. Usually that is right
  // for a single guest and wrong for half of a couple — worth eyeballing.
  const ungrouped = guests.filter(function (g) {
    return !g.isPlusOne && g.household.indexOf('row-') === 0;
  });

  if (ungrouped.length) {
    Logger.log('');
    Logger.log('%s guests have no Household or Address, so each will RSVP alone.',
      ungrouped.length);
    Logger.log('Fine for solo guests; fill in Household for anyone invited with someone else:');
    ungrouped.forEach(function (g) { Logger.log('   - %s', g.displayName); });
  }

  Logger.log('');
  Logger.log('Sample of how parties will appear when someone looks themselves up:');
  Object.keys(households).slice(0, 6).forEach(function (h) {
    Logger.log('   [%s] %s', h, households[h].map(function (g) {
      return g.displayName + (g.needsName ? ' (unnamed)' : '');
    }).join(', '));
  });
}
