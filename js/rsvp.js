/* ============================================================
   Julie & Seth — RSVP form
   Talks to the Google Apps Script backend in apps-script/Code.gs.
   Paste your deployed web-app URL below (see apps-script/SETUP.md).
   ============================================================ */

const RSVP_ENDPOINT = ""; // e.g. "https://script.google.com/macros/s/AKfy.../exec"

const el = {
  root: document.getElementById("rsvp-app"),
  search: document.getElementById("rsvp-search"),
  first: document.getElementById("rsvp-first"),
  last: document.getElementById("rsvp-last"),
  searchBtn: document.getElementById("rsvp-search-btn"),
  error: document.getElementById("rsvp-error"),
  form: document.getElementById("rsvp-form"),
  guests: document.getElementById("rsvp-guests"),
  extras: document.getElementById("rsvp-extras"),
  submitBtn: document.getElementById("rsvp-submit-btn"),
  backBtn: document.getElementById("rsvp-back-btn"),
  done: document.getElementById("rsvp-done"),
  doneMsg: document.getElementById("rsvp-done-msg"),
};

let household = null;
let options = null;

/* ---------- Networking ---------- */

// Apps Script rejects a JSON content-type preflight, so send text/plain — the
// script parses the body itself and this stays a simple CORS request.
async function callApi(payload) {
  const res = await fetch(RSVP_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error("http_" + res.status);
  return res.json();
}

/* ---------- Views ---------- */

function show(view) {
  el.search.hidden = view !== "search";
  el.form.hidden = view !== "form";
  el.done.hidden = view !== "done";
}

function showError(msg) {
  el.error.textContent = msg;
  el.error.hidden = !msg;
}

const ERRORS = {
  need_full_name: "Please enter both your first and last name.",
  not_found:
    "We couldn't find that name on our guest list. Please try the name exactly as it appears on your invitation — or reach out to us directly and we'll sort it out.",
  ambiguous:
    "We found more than one possible match. Please enter your name exactly as it appears on your invitation.",
  rate_limited: "Things are busy right now. Please wait a moment and try again.",
  server_error: "Something went wrong on our end. Please try again in a minute.",
};

/* ---------- Search ---------- */

async function doSearch() {
  const firstName = el.first.value.trim();
  const lastName = el.last.value.trim();

  if (!firstName || !lastName) {
    showError(ERRORS.need_full_name);
    return;
  }

  showError("");
  el.searchBtn.disabled = true;
  el.searchBtn.textContent = "Looking…";

  try {
    const data = await callApi({ action: "search", firstName, lastName });

    if (!data.ok) {
      showError(ERRORS[data.error] || ERRORS.server_error);
      return;
    }

    household = data.household;
    options = data.options;
    renderForm();
    show("form");
  } catch (err) {
    showError(ERRORS.server_error);
  } finally {
    el.searchBtn.disabled = false;
    el.searchBtn.textContent = "Find my invitation";
  }
}

/* ---------- RSVP form ---------- */

function renderForm() {
  el.guests.innerHTML = "";

  household.members.forEach((m) => {
    const row = document.createElement("div");
    row.className = "rsvp-guest";
    row.dataset.guestId = m.id;

    const yesChecked = m.previous && m.previous.attending === true ? "checked" : "";
    const noChecked = m.previous && m.previous.attending === false ? "checked" : "";

    row.innerHTML = `
      <p class="rsvp-guest-name">${escapeHtml(m.name)}</p>
      ${m.needsName
        ? `<label class="rsvp-field rsvp-plusone-name">
             <span>Your guest's name</span>
             <input type="text" class="rsvp-name" maxlength="80" placeholder="Who are you bringing?">
           </label>`
        : ""}
      <div class="rsvp-choice">
        <label>
          <input type="radio" name="att-${m.id}" value="yes" ${yesChecked}>
          <span>Joyfully accepts</span>
        </label>
        <label>
          <input type="radio" name="att-${m.id}" value="no" ${noChecked}>
          <span>Regretfully declines</span>
        </label>
      </div>
      <div class="rsvp-guest-extra" hidden>
        ${options.meals && options.meals.length ? mealField(m.id, options.meals) : ""}
        ${options.askDietary
          ? `<label class="rsvp-field">
               <span>Dietary restrictions or allergies (optional)</span>
               <input type="text" class="rsvp-dietary" maxlength="200">
             </label>`
          : ""}
      </div>
    `;

    // Meal and dietary questions only matter for guests who are coming.
    row.querySelectorAll(`input[name="att-${m.id}"]`).forEach((input) => {
      input.addEventListener("change", () => {
        row.querySelector(".rsvp-guest-extra").hidden = input.value !== "yes";
      });
    });

    if (yesChecked) row.querySelector(".rsvp-guest-extra").hidden = false;

    el.guests.appendChild(row);
  });

  el.extras.innerHTML = `
    <label class="rsvp-field">
      <span>Email address (optional — so we can send updates)</span>
      <input type="email" id="rsvp-email" maxlength="200">
    </label>
    ${options.askSongRequest
      ? `<label class="rsvp-field">
           <span>A song that will get you on the dance floor (optional)</span>
           <input type="text" id="rsvp-song" maxlength="200">
         </label>`
      : ""}
    <label class="rsvp-field">
      <span>A note for Julie &amp; Seth (optional)</span>
      <textarea id="rsvp-note" rows="3" maxlength="800"></textarea>
    </label>
  `;
}

function mealField(id, meals) {
  const opts = meals.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  return `
    <label class="rsvp-field">
      <span>Meal choice</span>
      <select class="rsvp-meal">
        <option value="">Please choose…</option>
        ${opts}
      </select>
    </label>`;
}

/* ---------- Submit ---------- */

async function doSubmit() {
  const rows = [];
  let missing = false;
  let needsGuestName = false;

  el.guests.querySelectorAll(".rsvp-guest").forEach((row) => {
    const id = row.dataset.guestId;
    const picked = row.querySelector(`input[name="att-${id}"]:checked`);
    if (!picked) { missing = true; return; }

    const mealEl = row.querySelector(".rsvp-meal");
    const dietEl = row.querySelector(".rsvp-dietary");
    const nameEl = row.querySelector(".rsvp-name");

    // A plus one who is coming needs a name; one who is declining does not.
    if (nameEl && picked.value === "yes" && !nameEl.value.trim()) {
      needsGuestName = true;
    }

    rows.push({
      id,
      attending: picked.value === "yes",
      name: nameEl ? nameEl.value.trim() : "",
      meal: mealEl ? mealEl.value : "",
      dietary: dietEl ? dietEl.value.trim() : "",
    });
  });

  if (missing) {
    showError("Please choose a response for everyone in your party.");
    return;
  }

  if (needsGuestName) {
    showError("Please tell us the name of the guest you're bringing.");
    return;
  }

  showError("");
  el.submitBtn.disabled = true;
  el.submitBtn.textContent = "Sending…";

  try {
    const data = await callApi({
      action: "submit",
      householdId: household.id,
      responses: rows,
      email: value("rsvp-email"),
      songRequest: value("rsvp-song"),
      note: value("rsvp-note"),
    });

    if (!data.ok) {
      showError(ERRORS[data.error] || ERRORS.server_error);
      return;
    }

    el.doneMsg.textContent = data.attending > 0
      ? "We can't wait to celebrate with you. See you on July 17th!"
      : "Thank you for letting us know — you'll be missed, and we're grateful you told us.";
    show("done");
  } catch (err) {
    showError(ERRORS.server_error);
  } finally {
    el.submitBtn.disabled = false;
    el.submitBtn.textContent = "Send our response";
  }
}

/* ---------- Helpers ---------- */

function value(id) {
  const node = document.getElementById(id);
  return node ? node.value.trim() : "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- Wire up ---------- */

if (el.root) {
  if (!RSVP_ENDPOINT) {
    // Not configured yet — say so plainly rather than failing silently.
    el.root.innerHTML =
      '<p class="rsvp-unconfigured">Our RSVP form is being set up and will be ' +
      'ready shortly. Please check back soon!</p>';
  } else {
    el.searchBtn.addEventListener("click", doSearch);
    el.submitBtn.addEventListener("click", doSubmit);
    el.backBtn.addEventListener("click", () => { showError(""); show("search"); });

    [el.first, el.last].forEach((input) =>
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); })
    );

    show("search");
  }
}
