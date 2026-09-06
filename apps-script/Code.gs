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

  // Plated-meal choices offered to each guest. Leave empty to hide the question.
  // e.g. ['Beef', 'Chicken', 'Vegetarian']
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
  household: ['household', 'household id', 'party', 'party id', 'group', 'family', 'invitation', 'invite', 'address'],
  email: ['email', 'e-mail', 'email address'],
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

  // Exact match on the normalized full name.
  let matches = guests.filter(function (g) { return g.normalized === target; });

  // Fall back to a small edit distance so common typos still find the guest.
  // The budget scales with name length: two edits out of "christopher anderson"
  // is a typo, but two edits out of "jo ng" is a different person entirely.
  if (matches.length === 0) {
    const budget = target.length >= 12 ? 2 : (target.length >= 8 ? 1 : 0);
    if (budget > 0) {
      matches = guests.filter(function (g) {
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

    rows.push([
      now,
      householdId,
      guest.displayName,
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

  const cols = mapColumns(values[0]);
  const guests = [];

  for (let r = 1; r < values.length; r++) {
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

    // Without a household column each row stands alone, which still works —
    // partners just RSVP one at a time. Adding the column groups them.
    const household = cols.household >= 0 && String(row[cols.household] || '').trim()
      ? String(row[cols.household]).trim()
      : 'row-' + (r + 1);

    guests.push({
      id: 'g' + (r + 1),
      displayName: displayName,
      normalized: normalize(first) + ' ' + normalize(last),
      household: household,
    });
  }

  return guests;
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
  Logger.log('Loaded %s guests.', guests.length);

  const households = {};
  guests.forEach(function (g) { households[g.household] = (households[g.household] || 0) + 1; });
  Logger.log('Across %s households.', Object.keys(households).length);

  guests.slice(0, 5).forEach(function (g) {
    Logger.log('  %s  (household: %s)', g.displayName, g.household);
  });

  if (guests.length === 0) {
    Logger.log('No guests found — check the tab name and that you have First/Last Name columns.');
  }
}
