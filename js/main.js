/* ============================================================
   Julie & Seth — site behavior
   Edit the WEDDING config below when details change.
   ============================================================ */

const WEDDING = {
  names: "Julie & Seth",
  // Local time at the venue. Format: YYYY-MM-DDTHH:MM:SS
  ceremonyStart: "2027-07-17T15:30:00",
  ceremonyEnd: "2027-07-17T22:00:00",
  venueName: "Rixey Manor",
  venueAddress: "9155 Pleasant Hill Dr, Rixeyville, VA 22737",
  description: "The wedding of Julie & Seth. See https://seth-walter.github.io/sj-wedding-website/ for details.",
};

/* ---------- Mobile nav ---------- */

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});

navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

/* ---------- Countdown ---------- */

const cd = {
  days: document.getElementById("cd-days"),
  hours: document.getElementById("cd-hours"),
  mins: document.getElementById("cd-mins"),
  secs: document.getElementById("cd-secs"),
};

function updateCountdown() {
  const target = new Date(WEDDING.ceremonyStart).getTime();
  const diff = target - Date.now();

  if (diff <= 0) {
    document.getElementById("countdown").innerHTML =
      '<p class="hero-date" style="margin:0">Today’s the day! ♡</p>';
    clearInterval(cdTimer);
    return;
  }

  const s = Math.floor(diff / 1000);
  cd.days.textContent = Math.floor(s / 86400);
  cd.hours.textContent = Math.floor((s % 86400) / 3600);
  cd.mins.textContent = Math.floor((s % 3600) / 60);
  cd.secs.textContent = s % 60;
}

const cdTimer = setInterval(updateCountdown, 1000);
updateCountdown();

/* ---------- Add to calendar ---------- */

function pad(n) { return String(n).padStart(2, "0"); }

// Render a local date as a floating (no-TZ) iCal timestamp: guests see venue local time.
function icsStamp(dateStr) {
  const d = new Date(dateStr);
  return (
    d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
    "T" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds())
  );
}

const venueLoc = WEDDING.venueName + ", " + WEDDING.venueAddress;
const title = "Wedding of " + WEDDING.names;

const gcalUrl =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=" + encodeURIComponent(title) +
  "&dates=" + icsStamp(WEDDING.ceremonyStart) + "/" + icsStamp(WEDDING.ceremonyEnd) +
  "&details=" + encodeURIComponent(WEDDING.description) +
  "&location=" + encodeURIComponent(venueLoc);

document.getElementById("gcal-link").href = gcalUrl;

document.getElementById("ics-btn").addEventListener("click", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Julie and Seth//Wedding//EN",
    "BEGIN:VEVENT",
    "UID:" + Date.now() + "@sj-wedding",
    "DTSTAMP:" + icsStamp(new Date().toISOString().slice(0, 19)) + "Z",
    "DTSTART:" + icsStamp(WEDDING.ceremonyStart),
    "DTEND:" + icsStamp(WEDDING.ceremonyEnd),
    "SUMMARY:" + title,
    "DESCRIPTION:" + WEDDING.description.replace(/,/g, "\\,"),
    "LOCATION:" + venueLoc.replace(/,/g, "\\,"),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "julie-and-seth-wedding.ics";
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- Hero photo (auto-detect images/hero.jpg) ---------- */

(function tryHeroPhoto() {
  const img = new Image();
  img.onload = () => {
    const hero = document.getElementById("hero");
    hero.style.backgroundImage = "url('images/hero.jpg')";
    hero.classList.add("has-photo");
  };
  img.src = "images/hero.jpg";
})();

/* ---------- Gallery (auto-detect images/gallery-1.jpg, -2, ...) ---------- */

(function loadGallery() {
  const grid = document.getElementById("gallery-grid");
  const empty = document.getElementById("gallery-empty");
  const MAX = 60;
  let found = 0;

  function tryNext(i) {
    if (i > MAX) return;
    const img = new Image();
    img.onload = () => {
      if (found === 0) empty.remove();
      found++;
      img.alt = "Julie & Seth — photo " + i;
      img.loading = "lazy";
      img.addEventListener("click", () => openLightbox(img.src));
      grid.appendChild(img);
      tryNext(i + 1);
    };
    // Stop at the first missing number — name photos sequentially.
    img.onerror = () => {};
    img.src = "images/gallery-" + i + ".jpg";
  }

  tryNext(1);
})();

/* ---------- Lightbox ---------- */

const lightbox = document.createElement("div");
lightbox.className = "lightbox";
lightbox.hidden = true;
lightbox.innerHTML = "<img alt='Enlarged photo'>";
document.body.appendChild(lightbox);

function openLightbox(src) {
  lightbox.querySelector("img").src = src;
  lightbox.hidden = false;
}

lightbox.addEventListener("click", () => { lightbox.hidden = true; });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") lightbox.hidden = true;
});
