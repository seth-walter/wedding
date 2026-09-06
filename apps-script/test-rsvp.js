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
  ["Count", "First Name", "Last Name", "Address", "Email", "Phone",
   "Dietary Needs", "Bride, Groom, Both", "Save the Date Sent", "Invite Sent",
   "RSVP", "Hotel Yes", "Hotel No", "Meal Choice", "Table Assignment",
   "Plus One Name", "Plus One"],
  [1, "Anna", "Reed", "12 Oak St", "anna@example.com", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [2, "David", "Reed", "12 Oak St", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [3, "Priya", "Nair", "9 Elm Ave", "", "", "", "Bride", "Y", "Y", "", "", "", "", "", "Rahul Nair", ""],
  [4, "José", "García", "4 Pine Rd", "", "", "", "Groom", "Y", "Y", "", "", "", "", "", "", "Yes"],
  [5, "Mary-Kate", "O'Brien", "77 Ash Ln", "", "", "", "Bride", "Y", "Y", "", "", "", "", "", "", ""],
  [6, "Jo", "Ng", "3 Bay St", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [7, "Bo", "Ng", "5 Bay St", "", "", "", "Both", "Y", "Y", "", "", "", "", "", "", ""],
  [8, "Christopher", "Anderson", "8 Cedar Ct", "", "", "", "Groom", "Y", "Y", "", "", "", "", "", "", ""],
];

const sheets = {};

function makeSheet(name, rows) {
  return {
    name,
    rows,
    getDataRange: () => ({ getValues: () => rows }),
    getLastRow: () => rows.length,
    appendRow: (r) => rows.push(r),
    getRange: (row, col, numRows, numCols) => ({
      setValues: (vals) => {
        for (let i = 0; i < vals.length; i++) rows[row - 1 + i] = vals[i];
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
check("loads 8 invited + 2 plus ones", guests.length, 10);
check("groups Reeds by shared address", guests.filter(g => g.household === "12 Oak St").length, 2);

console.log("\n--- plus ones ---");
const namedPlus = guests.find(g => g.displayName === "Rahul Nair");
check("named plus one becomes a household member", !!namedPlus, true);
check("named plus one shares Priya's household", namedPlus.household, "9 Elm Ave");
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
  handleSearch({ firstName: "Jo", lastName: "Ng" }).household.id, "3 Bay St");
check("Bo Ng resolves to own household",
  handleSearch({ firstName: "Bo", lastName: "Ng" }).household.id, "5 Bay St");
check("Jo Ng sees only herself, not Bo",
  handleSearch({ firstName: "Jo", lastName: "Ng" }).household.members.length, 1);

console.log("\n--- search: rejections ---");
check("first name only", handleSearch({ firstName: "Anna", lastName: "" }).error, "need_full_name");
check("last name only", handleSearch({ firstName: "", lastName: "Reed" }).error, "need_full_name");
check("stranger rejected", handleSearch({ firstName: "Jane", lastName: "Doe" }).error, "not_found");
check("right first, wrong last", handleSearch({ firstName: "Anna", lastName: "Smith" }).error, "not_found");
check("empty payload", handleSearch({}).error, "need_full_name");

console.log("\n--- submit ---");
const anna = guests.find(g => g.displayName === "Anna Reed");
const david = guests.find(g => g.displayName === "David Reed");
const priya = guests.find(g => g.displayName === "Priya Nair");

r = handleSubmit({
  householdId: "12 Oak St",
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
check("wrote 2 rows", sheets["RSVPs"].rows.length, 3); // header + 2

console.log("\n--- submit: plus one names ---");
r = handleSubmit({
  householdId: "4 Pine Rd",
  responses: [
    { id: guests.find(g => g.displayName === "José García").id, attending: true },
    { id: unnamedPlus.id, attending: true, name: "Sofia Ruiz" },
  ],
});
check("accepts a named-at-RSVP plus one", r.ok, true);
check("records the supplied plus one name",
  sheets["RSVPs"].rows[sheets["RSVPs"].rows.length - 1][2],
  "Sofia Ruiz (guest of José García)");

console.log("\n--- submit: forged requests ---");
const rowsBefore = sheets["RSVPs"].rows.length;
r = handleSubmit({
  householdId: "12 Oak St",
  responses: [{ id: priya.id, attending: true }], // Priya is NOT in this household
});
check("rejects guest from another household", r.error, "bad_request");
check("no rows written for forged guest", sheets["RSVPs"].rows.length, rowsBefore);

r = handleSubmit({ householdId: "Made Up Family", responses: [{ id: anna.id, attending: true }] });
check("rejects unknown household", r.error, "not_found");

r = handleSubmit({ householdId: "12 Oak St", responses: [] });
check("rejects empty responses", r.error, "bad_request");

console.log("\n--- resubmission ---");
r = handleSearch({ firstName: "Anna", lastName: "Reed" });
check("recalls previous answer for Anna", r.household.members.find(m => m.name === "Anna Reed").previous, { attending: true });
check("recalls previous answer for David", r.household.members.find(m => m.name === "David Reed").previous, { attending: false });

console.log("\n--- rate limiting ---");
for (let i = 0; i < 25; i++) handleSearch({ firstName: "Anna", lastName: "Reed" });
check("throttles after limit", handleSearch({ firstName: "Anna", lastName: "Reed" }).error, "rate_limited");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
