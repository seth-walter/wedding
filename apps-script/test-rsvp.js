/*
 * Test harness for Code.gs.
 *
 * Stubs the Apps Script runtime (SpreadsheetApp, CacheService, LockService) so
 * the guest-matching and submission logic can run under plain Node. Worth
 * re-running after you edit Code.gs:
 *
 *   node apps-script/test-rsvp.js
 *
 * It uses a fake guest list, so it never touches your real spreadsheet.
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "Code.gs");

// ---- Fake spreadsheet ----------------------------------------------------

// Mirrors the real guest sheet: row 1 is a merged group label, row 2 is the
// actual header, households are grouped by Address, plus ones are a column.
const guestRows = [
  ["", "", "", "", "", "", "", "", "", "", "RSVP", "Hotel", "", "", "", "", ""],
  ["Count", "First Name", "Last Name", "Household", "Address", "Email", "Phone",
   "Dietary Needs", "Bride, Groom, Both", "Save the Date Sent", "Invite Sent",
   "RSVP", "Hotel Yes", "Hotel No", "Meal Choice", "Table Assignment",
   "Plus One Name", "Plus One"],
  // Household filled in — the intended path.
  [1, "Anna", "Reed", "Reed", "12 Oak St", "anna@example.com", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [2, "David", "Reed", "Reed", "12 Oak St", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  // Household blank, address shared — must still group as one party.
  [3, "Tom", "Hale", "", "5 Vine Way", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [4, "Ida", "Hale", "", "5 Vine Way", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  // Household and address both blank — RSVPs alone.
  [5, "Lena", "Frost", "", "", "", "", "", "Bride", "Y", "Y", "", "", "", "", "", "", ""],
  [6, "Priya", "Nair", "Nair", "9 Elm Ave", "", "", "", "Bride", "Y", "Y", "", "", "", "", "", "Rahul Nair", ""],
  [7, "José", "García", "Garcia", "4 Pine Rd", "", "", "", "Groom", "Y", "Y", "", "", "", "", "", "", "Yes"],
  [8, "Mary-Kate", "O'Brien", "OBrien", "77 Ash Ln", "", "", "", "Bride", "Y", "Y", "", "", "", "", "", "", ""],
  [9, "Jo", "Ng", "Ng A", "3 Bay St", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [10, "Bo", "Ng", "Ng B", "5 Bay St", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [11, "Christopher", "Anderson", "Anderson", "8 Cedar Ct", "", "", "", "Groom", "Y", "Y", "", "", "", "", "", "", ""],
  // A couple left untouched by other tests, for partial-submission checks.
  [12, "Ravi", "Quinn", "Quinn", "2 Fern Rd", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [13, "Nadia", "Quinn", "Quinn", "2 Fern Rd", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
];

const sheets = {};

function makeSheet(name, rows) {
  return {
    name,
    rows,
    // Column index (1-based) -> dropdown options, mimicking data validation.
    validation: {},
    getDataRange: () => ({ getValues: () => rows }),
    getLastRow: () => rows.length,
    appendRow: (r) => rows.push(r),
    getRange: (row, col, numRows, numCols) => ({
      setValues: (vals) => {
        for (let i = 0; i < vals.length; i++) rows[row - 1 + i] = vals[i];
      },
      // Single-cell access, used by the write-back path.
      getValue: () => (rows[row - 1] || [])[col - 1],
      getDataValidation: function () {
        const opts = sheets[name] && sheets[name].validation[col];
        if (!opts) return null;
        return {
          getCriteriaType: () => "VALUE_IN_LIST",
          getCriteriaValues: () => [opts],
        };
      },
      setValue: (v) => {
        while (rows.length < row) rows.push([]);
        if (!rows[row - 1]) rows[row - 1] = [];
        rows[row - 1][col - 1] = v;
      },
      setFontWeight: () => {},
    }),
    setFrozenRows: () => {},
  };
}

sheets["Guests"] = makeSheet("Guests", guestRows);

global.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = makeSheet(n, [])),
  }),
};

const cache = {};
global.CacheService = {
  getScriptCache: () => ({
    get: (k) => cache[k] || null,
    put: (k, v) => { cache[k] = v; },
  }),
};

global.LockService = {
  getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
};

global.ContentService = {
  MimeType: { JSON: "json" },
  createTextOutput: (s) => ({ setMimeType: () => s }),
};

global.Logger = { log: (...a) => console.log("  [log]", ...a) };

// ---- Load Code.gs into this scope ---------------------------------------

const code = fs.readFileSync(SRC, "utf8");
eval(code);

// ---- Assertions ----------------------------------------------------------

// Searches share one global per-minute budget, so clear it between sections
// that would otherwise trip the throttle on each other's behalf.
function resetRateLimit() {
  Object.keys(cache).forEach((k) => delete cache[k]);
}

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}

console.log("\n--- header detection & readGuests ---");
check("finds header on row 2, not row 1", findHeaderRow(guestRows), 1);
const guests = readGuests();
check("loads 13 invited + 2 plus ones", guests.length, 15);

console.log("\n--- household grouping: Household only, else alone ---");
check("Household groups people onto one reply",
  guests.filter(g => g.household === "Reed").length, 2);
check("Anna's household is her Household value",
  guests.find(g => g.displayName === "Anna Reed").household, "Reed");
check("Anna's reply covers David too",
  handleSearch({ firstName: "Anna", lastName: "Reed" }).household.members.length, 2);

// The Hales share an address but have no Household value. Address must NOT
// group them — a blank Household means the guest answers for themselves only.
check("shared Address does NOT group without Household",
  handleSearch({ firstName: "Tom", lastName: "Hale" }).household.members.length, 1);
check("Tom Hale sees only himself",
  handleSearch({ firstName: "Tom", lastName: "Hale" }).household.members[0].name, "Tom Hale");
check("Ida Hale RSVPs separately",
  handleSearch({ firstName: "Ida", lastName: "Hale" }).household.members.length, 1);
check("no Household -> row fallback",
  guests.find(g => g.displayName === "Tom Hale").household.startsWith("row-"), true);
check("guest with neither field also RSVPs alone",
  handleSearch({ firstName: "Lena", lastName: "Frost" }).household.members.length, 1);

console.log("\n--- plus ones ---");
const namedPlus = guests.find(g => g.displayName === "Rahul Nair");
check("named plus one becomes a household member", !!namedPlus, true);
check("named plus one shares Priya's household", namedPlus.household, "Nair");
const unnamedPlus = guests.find(g => g.needsName);
check("permitted-but-unnamed plus one is created", unnamedPlus.displayName, "Guest of José García");
check("unnamed plus one is not searchable", unnamedPlus.normalized, "");
check("guest with no plus one gets none",
  guests.filter(g => g.household === "12 Oak St" && g.isPlusOne).length, 0);
check("named plus one IS searchable by their own name",
  handleSearch({ firstName: "Rahul", lastName: "Nair" }).ok, true);
check("normalizes accents", guests.find(g => g.displayName === "José García").normalized, "jose garcia");
check("strips apostrophe/hyphen", guests.find(g => g.displayName.includes("O'Brien")).normalized, "marykate obrien");

console.log("\n--- search: happy path ---");
let r = handleSearch({ action: "search", firstName: "Anna", lastName: "Reed" });
check("finds Anna", r.ok, true);
check("returns both household members", r.household.members.length, 2);
check("member names", r.household.members.map(m => m.name), ["Anna Reed", "David Reed"]);
check("reports which member matched the search", r.household.matchedId,
  guests.find(g => g.displayName === "Anna Reed").id);
check("searching David matches David, not Anna",
  handleSearch({ firstName: "David", lastName: "Reed" }).household.matchedId,
  guests.find(g => g.displayName === "David Reed").id);

console.log("\n--- replying for only part of the household ---");
const ravi = guests.find(g => g.displayName === "Ravi Quinn");
const nadia = guests.find(g => g.displayName === "Nadia Quinn");

r = handleSubmit({ householdId: "Quinn", responses: [{ id: ravi.id, attending: true }] });
check("accepts a reply covering one member only", r.ok, true);
check("counts just the one reply", r.total, 1);

let q = handleSearch({ firstName: "Nadia", lastName: "Quinn" });
check("Ravi's reply is remembered",
  q.household.members.find(m => m.name === "Ravi Quinn").previous, { attending: true });
check("Nadia is still shown as not yet replied",
  q.household.members.find(m => m.name === "Nadia Quinn").previous, null);
check("Nadia's own lookup marks her as the match", q.household.matchedId, nadia.id);

// Nadia now replies for herself; Ravi's answer must survive untouched.
handleSubmit({ householdId: "Quinn", responses: [{ id: nadia.id, attending: false }] });
q = handleSearch({ firstName: "Ravi", lastName: "Quinn" });
check("Ravi's answer unchanged after Nadia replies",
  q.household.members.find(m => m.name === "Ravi Quinn").previous, { attending: true });
check("Nadia's answer recorded",
  q.household.members.find(m => m.name === "Nadia Quinn").previous, { attending: false });

console.log("\n--- search: case, spacing, accents, typos ---");
check("case insensitive", handleSearch({ firstName: "aNNa", lastName: "  reed " }).ok, true);
check("accent-insensitive", handleSearch({ firstName: "Jose", lastName: "Garcia" }).ok, true);
check("apostrophe-insensitive", handleSearch({ firstName: "Mary Kate", lastName: "OBrien" }).ok, true);
check("tolerates 1-char typo", handleSearch({ firstName: "Ana", lastName: "Reed" }).ok, true);
check("tolerates 2 typos in a long name",
  handleSearch({ firstName: "Christofer", lastName: "Anderson" }).ok, true);
check("rejects 3 typos even in a long name",
  handleSearch({ firstName: "Christofer", lastName: "Andersen" }).error, "not_found");

console.log("\n--- fuzzy matching does not leak across people ---");
check("short name needs exact spelling (Bo != Jo)",
  handleSearch({ firstName: "Zo", lastName: "Ng" }).error, "not_found");
check("Jo Ng resolves to own household",
  handleSearch({ firstName: "Jo", lastName: "Ng" }).household.id, "Ng A");
check("Bo Ng resolves to own household",
  handleSearch({ firstName: "Bo", lastName: "Ng" }).household.id, "Ng B");
check("Jo Ng sees only herself, not Bo",
  handleSearch({ firstName: "Jo", lastName: "Ng" }).household.members.length, 1);

console.log("\n--- search: rejections ---");
resetRateLimit();
check("first name only", handleSearch({ firstName: "Anna", lastName: "" }).error, "need_full_name");
check("last name only", handleSearch({ firstName: "", lastName: "Reed" }).error, "need_full_name");
check("stranger rejected", handleSearch({ firstName: "Jane", lastName: "Doe" }).error, "not_found");
check("right first, wrong last", handleSearch({ firstName: "Anna", lastName: "Smith" }).error, "not_found");
check("empty payload", handleSearch({}).error, "need_full_name");

console.log("\n--- submit ---");
const rsvpRowsBeforeReed = sheets["RSVPs"].rows.length;
const anna = guests.find(g => g.displayName === "Anna Reed");
const david = guests.find(g => g.displayName === "David Reed");
const priya = guests.find(g => g.displayName === "Priya Nair");

r = handleSubmit({
  householdId: "Reed",
  responses: [
    { id: anna.id, attending: true, meal: "", dietary: "No shellfish" },
    { id: david.id, attending: false },
  ],
  email: "anna@example.com",
  songRequest: "September",
});
check("submit accepted", r.ok, true);
check("counts attending", r.attending, 1);
check("counts total", r.total, 2);
check("wrote one row per guest answered",
  sheets["RSVPs"].rows.length - rsvpRowsBeforeReed, 2);

console.log("\n--- submit: plus one names ---");
r = handleSubmit({
  householdId: "Garcia",
  responses: [
    { id: guests.find(g => g.displayName === "José García").id, attending: true },
    { id: unnamedPlus.id, attending: true, name: "Sofia Ruiz" },
  ],
});
check("accepts a named-at-RSVP plus one", r.ok, true);
check("records the supplied plus one name",
  sheets["RSVPs"].rows[sheets["RSVPs"].rows.length - 1][2],
  "Sofia Ruiz (guest of José García)");

console.log("\n--- write-back into the Guests tab ---");
const G = sheets["Guests"].rows;
const H = G[1];                                  // header row
const cIdx = (name) => H.indexOf(name);
const guestRow = (name) => G.find(r => (r[1] + " " + r[2]) === name);

check("Anna's RSVP cell says RSVP'd", guestRow("Anna Reed")[cIdx("RSVP")], "RSVP'd");
check("David's RSVP cell says Declined", guestRow("David Reed")[cIdx("RSVP")], "Declined");
check("Anna's dietary note written to the blank cell",
  guestRow("Anna Reed")[cIdx("Dietary Needs")], "No shellfish");
check("guest-supplied plus one name filled in",
  guestRow("José García")[cIdx("Plus One Name")], "Sofia Ruiz");
check("plus one did NOT overwrite the host's RSVP",
  guestRow("José García")[cIdx("RSVP")], "RSVP'd");
check("untouched guest keeps a blank RSVP",
  guestRow("Lena Frost")[cIdx("RSVP")] || "", "");

// Existing notes must survive: Priya already has a dietary note and a named
// plus one, and a reply must not overwrite either.
G.find(r => r[1] === "Priya")[cIdx("Dietary Needs")] = "Coeliac";
handleSubmit({
  householdId: "Nair",
  responses: [
    { id: guests.find(g => g.displayName === "Priya Nair").id, attending: true, dietary: "None" },
    { id: namedPlus.id, attending: true },
  ],
});
check("does not overwrite an existing dietary note",
  guestRow("Priya Nair")[cIdx("Dietary Needs")], "Coeliac");
check("does not overwrite an existing plus one name",
  guestRow("Priya Nair")[cIdx("Plus One Name")], "Rahul Nair");
check("but does record Priya's own RSVP",
  guestRow("Priya Nair")[cIdx("RSVP")], "RSVP'd");

console.log("\n--- matching the RSVP dropdown ---");
// The real sheet's dropdown is Pending / RSVP'd / Declined. Point the stub's
// validation at a CURLY apostrophe, which is what Sheets often stores, and
// confirm the script writes the sheet's spelling rather than the config's.
sheets["Guests"].validation[cIdx("RSVP") + 1] = ["Pending", "RSVP’d", "Declined"];

handleSubmit({
  householdId: "Ng A",
  responses: [{ id: guests.find(g => g.displayName === "Jo Ng").id, attending: true }],
});
check("writes the dropdown's curly-apostrophe spelling",
  guestRow("Jo Ng")[cIdx("RSVP")], "RSVP’d");

handleSubmit({
  householdId: "Ng B",
  responses: [{ id: guests.find(g => g.displayName === "Bo Ng").id, attending: false }],
});
check("matches Declined through the dropdown too",
  guestRow("Bo Ng")[cIdx("RSVP")], "Declined");

// A dropdown that shares no wording with the config must not silently write a
// wrong option — fall back to the configured value.
sheets["Guests"].validation[cIdx("RSVP") + 1] = ["Alpha", "Beta"];
handleSubmit({
  householdId: "Anderson",
  responses: [{ id: guests.find(g => g.displayName === "Christopher Anderson").id, attending: true }],
});
check("unrelated dropdown falls back to the configured value",
  guestRow("Christopher Anderson")[cIdx("RSVP")], "RSVP'd");

delete sheets["Guests"].validation[cIdx("RSVP") + 1];

console.log("\n--- submit: forged requests ---");
const rowsBefore = sheets["RSVPs"].rows.length;
r = handleSubmit({
  householdId: "Reed",
  responses: [{ id: priya.id, attending: true }], // Priya is NOT in this household
});
check("rejects guest from another household", r.error, "bad_request");
check("no rows written for forged guest", sheets["RSVPs"].rows.length, rowsBefore);

r = handleSubmit({ householdId: "Made Up Family", responses: [{ id: anna.id, attending: true }] });
check("rejects unknown household", r.error, "not_found");

r = handleSubmit({ householdId: "Reed", responses: [] });
check("rejects empty responses", r.error, "bad_request");

console.log("\n--- resubmission ---");
r = handleSearch({ firstName: "Anna", lastName: "Reed" });
check("recalls previous answer for Anna", r.household.members.find(m => m.name === "Anna Reed").previous, { attending: true });
check("recalls previous answer for David", r.household.members.find(m => m.name === "David Reed").previous, { attending: false });

console.log("\n--- rate limiting ---");
resetRateLimit();
for (let i = 0; i < 25; i++) handleSearch({ firstName: "Anna", lastName: "Reed" });
check("throttles after limit", handleSearch({ firstName: "Anna", lastName: "Reed" }).error, "rate_limited");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
