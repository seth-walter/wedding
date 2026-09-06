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

const guestRows = [
  ["First Name", "Last Name", "Household", "Address"],
  ["Anna", "Reed", "Reed Family", "12 Oak St"],
  ["David", "Reed", "Reed Family", "12 Oak St"],
  ["Priya", "Nair", "Nair", "9 Elm Ave"],
  ["José", "García", "Garcia", "4 Pine Rd"],
  ["Mary-Kate", "O'Brien", "OBrien", "77 Ash Ln"],
  ["Jo", "Ng", "Ng", "3 Bay St"],
  ["Bo", "Ng", "Ng Two", "5 Bay St"],
  ["Christopher", "Anderson", "Anderson", "8 Cedar Ct"],
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

console.log("\n--- readGuests ---");
const guests = readGuests();
check("loads all 8 guests", guests.length, 8);
check("groups Reed household", guests.filter(g => g.household === "Reed Family").length, 2);
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
  handleSearch({ firstName: "Jo", lastName: "Ng" }).household.id, "Ng");
check("Bo Ng resolves to own household",
  handleSearch({ firstName: "Bo", lastName: "Ng" }).household.id, "Ng Two");

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
  householdId: "Reed Family",
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

console.log("\n--- submit: forged requests ---");
r = handleSubmit({
  householdId: "Reed Family",
  responses: [{ id: priya.id, attending: true }], // Priya is NOT in this household
});
check("rejects guest from another household", r.error, "bad_request");
check("no rows written for forged guest", sheets["RSVPs"].rows.length, 3);

r = handleSubmit({ householdId: "Made Up Family", responses: [{ id: anna.id, attending: true }] });
check("rejects unknown household", r.error, "not_found");

r = handleSubmit({ householdId: "Reed Family", responses: [] });
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
