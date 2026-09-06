/* ============================================================
   Julie & Seth — RSVP form
   Talks to the Google Apps Script backend in apps-script/Code.gs.
   Paste your deployed web-app URL below (see apps-script/SETUP.md).
   ============================================================ */

// Redeploying the Apps Script as a NEW deployment changes this URL; updating an
// existing deployment to a new version keeps it. See apps-script/SETUP.md.
const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbzSw_S0pl1ZB1UNVqaZYU_5b1lNOo4ArwgVgZHdMmmP8NiQGeXvcip7iuLbg8tSjT8GKw/exec";

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
  doneRemaining: document.getElementById("rsvp-done-remaining"),
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
  bad_request: "We couldn't read that response. Please reload the page and try again.",
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

  // An older deployment of the Apps Script does not send matchedId. Without a
  // fallback nobody would be marked "you", every row would default to "they'll
  // reply themselves", and submitting would post an empty reply.
  const matchedId = household.matchedId ||
    (household.members[0] && household.members[0].id);

  const others = household.members.filter((m) => m.id !== matchedId);
  const pending = others.filter((m) => !m.previous);

  household.members.forEach((m) => {
    const isYou = m.id === matchedId;
    // Someone else's existing reply stands unless this guest chooses to change
    // it, so it starts collapsed behind a summary rather than as live radios.
    const locked = !isYou && !!m.previous;

    const row = document.createElement("div");
    row.className = "rsvp-guest" + (isYou ? " is-you" : "");
    row.dataset.guestId = m.id;
    row.dataset.required = isYou ? "yes" : "no";

    const yesChecked = m.previous && m.previous.attending === true ? "checked" : "";
    const noChecked = m.previous && m.previous.attending === false ? "checked" : "";

    row.innerHTML = `
      <p class="rsvp-guest-name">
        ${escapeHtml(m.name)}${isYou ? '<span class="rsvp-you">you</span>' : ""}
      </p>

      ${locked
        ? `<div class="rsvp-replied">
             <p>Already replied — <strong>${m.previous.attending ? "attending" : "not attending"}</strong>.</p>
             <button type="button" class="rsvp-change">Change this</button>
           </div>`
        : ""}

      ${m.needsName
        ? `<label class="rsvp-field rsvp-plusone-name">
             <span>Your guest's name</span>
             <input type="text" class="rsvp-name" maxlength="80" placeholder="Who are you bringing?">
           </label>`
        : ""}

      <div class="rsvp-choice" ${locked ? "hidden" : ""}>
        <label>
          <input type="radio" name="att-${m.id}" value="yes" ${yesChecked}>
          <span>Joyfully accepts</span>
        </label>
        <label>
          <input type="radio" name="att-${m.id}" value="no" ${noChecked}>
          <span>Regretfully declines</span>
        </label>
        ${!isYou && !m.previous
          ? `<label class="rsvp-skip">
               <input type="radio" name="att-${m.id}" value="skip" checked>
               <span>They'll reply themselves</span>
             </label>`
          : ""}
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

    if (yesChecked && !locked) row.querySelector(".rsvp-guest-extra").hidden = false;

    const changeBtn = row.querySelector(".rsvp-change");
    if (changeBtn) {
      changeBtn.addEventListener("click", () => {
        row.querySelector(".rsvp-replied").hidden = true;
        row.querySelector(".rsvp-choice").hidden = false;
        row.dataset.changed = "yes";
      });
    }

    el.guests.appendChild(row);
  });

  // Say plainly that answering for the rest of the party is welcome but not
  // required, so nobody feels blocked waiting on someone else.
  el.guests.insertAdjacentHTML(
    "afterbegin",
    others.length
      ? `<p class="rsvp-party-note">${
          pending.length
            ? "You can reply for everyone on your invitation, or just yourself — whoever's left can reply later."
            : "Everyone else on your invitation has already replied. You can change their answer if you need to."
        }</p>`
      : ""
  );

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
    const required = row.dataset.required === "yes";
    const picked = row.querySelector(`input[name="att-${id}"]:checked`);

    // A reply someone else already gave, left untouched, is not resubmitted.
    if (row.querySelector(".rsvp-replied") && row.dataset.changed !== "yes") return;

    if (!picked) {
      if (required) missing = true;
      return;
    }

    // "They'll reply themselves" — leave this person for their own visit.
    if (picked.value === "skip") return;

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
    showError("Please let us know whether you can join us.");
    return;
  }

  if (needsGuestName) {
    showError("Please tell us the name of the guest you're bringing.");
    return;
  }

  // Nothing to send: everyone was left for someone else to answer for. Say so
  // rather than posting an empty reply and surfacing a server error.
  if (rows.length === 0) {
    showError("Please choose a response for at least one person before sending.");
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

    const answered = {};
    rows.forEach((r) => { answered[r.id] = true; });
    const stillWaiting = household.members.filter(
      (m) => !answered[m.id] && !m.previous
    );

    el.doneMsg.textContent = data.attending > 0
      ? "We can't wait to celebrate with you. See you on July 17th!"
      : "Thank you for letting us know — you'll be missed, and we're grateful you told us.";

    // Whoever was left unanswered can still come back and reply themselves.
    // Guarded: a browser holding a stale index.html has no such element, and
    // throwing here would report failure for a reply the server already saved.
    if (el.doneRemaining) {
      el.doneRemaining.hidden = stillWaiting.length === 0;
    }
    if (el.doneRemaining && stillWaiting.length) {
      el.doneRemaining.textContent =
        (stillWaiting.length === 1
          ? stillWaiting[0].name + " hasn't replied yet"
          : "Still to reply: " + stillWaiting.map((m) => m.name).join(", ")) +
        " — they can come back to this page and look up their own name any time.";
    }

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
