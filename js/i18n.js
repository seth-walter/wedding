/* ============================================================
   Julie & Seth — language dictionary and toggle
   English is the default; Spanish for Julie's Salvadoran family.
   Every visible string lives here, so wording changes happen in
   one place and always in both languages. House style: no em
   dashes anywhere in guest-facing text.
   ============================================================ */

const I18N = {
  en: {
    "nav.story": "Our Story",
    "nav.day": "The Day",
    "nav.travel": "Travel",
    "nav.registry": "Registry",
    "nav.faq": "FAQ",
    "nav.gallery": "Gallery",
    "nav.rsvp": "RSVP",

    "hero.pre": "You are invited to celebrate",
    "hero.date": "Saturday, July 17, 2027",
    "cd.days": "days",
    "cd.hours": "hours",
    "cd.mins": "minutes",
    "cd.secs": "seconds",
    "hero.rsvp": "RSVP",
    "today": "Today's the day! ♡",

    "story.title": "Our Story",
    "story.p1": "It started freshman year at James Madison University, on the same floor of the same dorm. That hallway turned out to hold a lot more than laundry machines and late-night study sessions. We kept finding ourselves in the same classes, too, until it stopped feeling like coincidence and started feeling like the point.",
    "story.p2": "Somewhere between shared notes, dining-hall dinners, and walks across the Quad, friendship turned into something more. JMU gave us degrees, but the best thing either of us left with was each other.",
    "proposal.title": "The Proposal",
    "proposal.p1": "Years later, on our anniversary trip to Colorado, we hiked the Siamese Twins Loop Trail. At the top, with the mountains stretched out in front of us, Seth got down on one knee. Julie said yes, and the view somehow got even better.",

    "day.title": "The Day",
    "day.cel.kicker": "The Celebration",
    "day.cel.time": "3:30 in the afternoon",
    "day.cel.detail": "Ceremony &amp; reception at Rixey Manor",
    "day.arr.kicker": "Please Arrive By",
    "day.arr.detail": "So you're settled before we begin",
    "day.unplugged": "<em>We're having an unplugged ceremony. Please tuck phones and cameras away and be fully present with us; our photographer will capture it all.</em>",
    "day.gcal": "Add to Google Calendar",
    "day.ics": "Apple / Outlook (.ics)",
    "dress.title": "Dress Code",
    "dress.text": "<strong>Semi-Formal:</strong> cocktail dresses, suits, or dress shirts and slacks. Kindly, please no white.",

    "travel.title": "Travel &amp; Local Guide",
    "stay.title": "Where to Stay",
    "k.hotel": "Hotel",
    "k.alt": "Alternative",
    "k.winery": "Winery",
    "k.town": "Small Town",
    "k.outdoors": "Outdoors",
    "stay1.detail": "In Culpeper, about 15 to 20 minutes from Rixey Manor",
    "stay1.meta": "Reliable, close, and easy for groups",
    "stay2.detail": "In Culpeper, about 15 to 20 minutes from Rixey Manor",
    "stay2.meta": "Free breakfast before a day of exploring",
    "stay3.detail": "Charming countryside stays around Rixeyville &amp; Culpeper",
    "stay3.meta": "Book early; July is busy season",
    "todo.title": "Things to Do",
    "todo1.detail": "Wine, spirits, and beer at a restored 19th-century farmhouse. Virginia's first winery, distillery, and brewery in one · about 15 min",
    "todo2.detail": "Walkable Davis Street: shops, murals, coffee at Raven's Nest, and great restaurants · about 20 min",
    "todo3.detail": "Skyline Drive overlooks and legendary Blue Ridge hikes · about 45 min",
    "getting.title": "Getting There",

    "registry.title": "Registry",
    "registry.text": "Your presence is the greatest gift. Registry details are coming soon; check back here closer to the big day.",

    "faq.title": "FAQ",
    "faq.q1": "Can I bring a plus one?",
    "faq.a1": "Plus ones will be indicated on your invitation. Please check yours when it arrives.",
    "faq.q2": "Are children welcome?",
    "faq.a2": "We love your little ones, but this will be an adults-only celebration.",
    "faq.q3": "What time should I arrive?",
    "faq.a3": "Please plan to arrive by 3:00 PM, thirty minutes before the celebration begins at 3:30.",
    "faq.q4": "Is there parking at the venue?",
    "faq.a4": "Yes. Parking is available on site at Rixey Manor, and signage will guide you when you arrive. See the map above for the entrance.",

    "gallery.title": "Gallery",
    "gallery.empty": "Photos coming soon ♡",

    "rsvp.title": "RSVP",
    "rsvp.deadline": "Kindly reply by <strong>February 1, 2027</strong>. Search for your name and let us know if you can make it. We truly hope you can!",
    "rsvp.first": "First name",
    "rsvp.last": "Last name",
    "rsvp.hint": "Please enter your name as it appears on your invitation.",
    "rsvp.find": "Find my invitation",
    "rsvp.back": "Back",
    "rsvp.send": "Send our response",
    "rsvp.thanks": "Thank you!",
    "rsvp.unconfigured": "Our RSVP form is being set up and will be ready shortly. Please check back soon!",
    "btn.looking": "Looking…",
    "btn.sending": "Sending…",

    "err.need_full_name": "Please enter both your first and last name.",
    "err.not_found": "We couldn't find that name on our guest list. Please try the name exactly as it appears on your invitation, or reach out to us directly and we'll sort it out.",
    "err.ambiguous": "We found more than one possible match. Please enter your name exactly as it appears on your invitation.",
    "err.rate_limited": "Things are busy right now. Please wait a moment and try again.",
    "err.bad_request": "We couldn't read that response. Please reload the page and try again.",
    "err.server_error": "Something went wrong on our end. Please try again in a minute.",
    "err.missing": "Please let us know whether you can join us.",
    "err.guestname": "Please tell us the name of the guest you're bringing.",
    "err.empty": "Please choose a response for at least one person before sending.",

    "form.you": "you",
    "form.replied.yes": "Already replied: <strong>attending</strong>.",
    "form.replied.no": "Already replied: <strong>not attending</strong>.",
    "form.change": "Change this",
    "form.guestname": "Your guest's name",
    "form.guestname.ph": "Who are you bringing?",
    "form.accept": "Joyfully accepts",
    "form.decline": "Regretfully declines",
    "form.skip": "They'll reply themselves",
    "form.party.pending": "You can reply for everyone on your invitation, or just yourself. Whoever's left can reply later.",
    "form.party.replied": "Everyone else on your invitation has already replied. You can change their answer if you need to.",
    "form.email": "Email address (optional, so we can send updates)",
    "form.song": "A song that will get you on the dance floor (optional)",
    "form.note": "A note for Julie &amp; Seth (optional)",
    "form.meal": "Meal choice",
    "form.meal.ph": "Please choose…",
    "form.dietary": "Dietary restrictions or allergies (optional)",

    "done.yes": "We can't wait to celebrate with you. See you on July 17th!",
    "done.no": "Thank you for letting us know. You'll be missed, and we're grateful you told us.",
    "done.wait.one": "{name} hasn't replied yet. They can come back to this page and look up their own name any time.",
    "done.wait.many": "Still to reply: {names}. They can come back to this page and look up their own names any time.",

    "footer.msg": "From a dorm hallway at JMU to a mountaintop in Colorado, every step led here. Come dance the next one with us.",
  },

  es: {
    "nav.story": "Nuestra historia",
    "nav.day": "El gran día",
    "nav.travel": "Viaje",
    "nav.registry": "Regalos",
    "nav.faq": "Preguntas",
    "nav.gallery": "Galería",
    "nav.rsvp": "Confirmar",

    "hero.pre": "Están cordialmente invitados a celebrar",
    "hero.date": "Sábado, 17 de julio de 2027",
    "cd.days": "días",
    "cd.hours": "horas",
    "cd.mins": "minutos",
    "cd.secs": "segundos",
    "hero.rsvp": "Confirmar asistencia",
    "today": "¡Hoy es el gran día! ♡",

    "story.title": "Nuestra historia",
    "story.p1": "Todo comenzó en nuestro primer año en James Madison University, en el mismo piso de la misma residencia. Ese pasillo terminó guardando mucho más que lavadoras y noches de estudio. Seguimos coincidiendo en las mismas clases, hasta que dejó de parecer casualidad y empezó a parecer el destino.",
    "story.p2": "Entre apuntes compartidos, cenas en el comedor y caminatas por el campus, la amistad se convirtió en algo más. JMU nos dio títulos, pero lo mejor que nos llevamos fue el uno al otro.",
    "proposal.title": "La propuesta",
    "proposal.p1": "Años después, en nuestro viaje de aniversario a Colorado, subimos el sendero Siamese Twins Loop. En la cima, con las montañas frente a nosotros, Seth se arrodilló. Julie dijo que sí, y la vista se volvió aún más hermosa.",

    "day.title": "El gran día",
    "day.cel.kicker": "La celebración",
    "day.cel.time": "3:30 de la tarde",
    "day.cel.detail": "Ceremonia y recepción en Rixey Manor",
    "day.arr.kicker": "Favor de llegar a las",
    "day.arr.detail": "Para que estén acomodados antes de comenzar",
    "day.unplugged": "<em>Nuestra ceremonia será sin celulares. Les pedimos guardar teléfonos y cámaras y acompañarnos plenamente; nuestro fotógrafo capturará cada momento.</em>",
    "day.gcal": "Agregar a Google Calendar",
    "day.ics": "Apple / Outlook (.ics)",
    "dress.title": "Código de vestimenta",
    "dress.text": "<strong>Semiformal:</strong> vestido de cóctel, traje, o camisa de vestir con pantalón. Por favor, eviten vestir de blanco.",

    "travel.title": "Viaje y guía local",
    "stay.title": "Dónde hospedarse",
    "k.hotel": "Hotel",
    "k.alt": "Alternativa",
    "k.winery": "Viñedo",
    "k.town": "Pueblo",
    "k.outdoors": "Naturaleza",
    "stay1.detail": "En Culpeper, a unos 15 a 20 minutos de Rixey Manor",
    "stay1.meta": "Confiable, cercano y práctico para grupos",
    "stay2.detail": "En Culpeper, a unos 15 a 20 minutos de Rixey Manor",
    "stay2.meta": "Desayuno incluido antes de un día de paseo",
    "stay3.detail": "Estancias encantadoras en el campo cerca de Rixeyville y Culpeper",
    "stay3.meta": "Reserven pronto; julio es temporada alta",
    "todo.title": "Qué hacer",
    "todo1.detail": "Vino, licores y cerveza en una granja restaurada del siglo XIX. La primera bodega, destilería y cervecería de Virginia en un solo lugar · a unos 15 min",
    "todo2.detail": "La calle Davis para pasear: tiendas, murales, café en Raven's Nest y buenos restaurantes · a unos 20 min",
    "todo3.detail": "Miradores de Skyline Drive y caminatas legendarias en las Blue Ridge · a unos 45 min",
    "getting.title": "Cómo llegar",

    "registry.title": "Mesa de regalos",
    "registry.text": "Su presencia es el mejor regalo. Pronto compartiremos los detalles de la mesa de regalos; vuelvan a visitar esta página más cerca de la fecha.",

    "faq.title": "Preguntas frecuentes",
    "faq.q1": "¿Puedo llevar acompañante?",
    "faq.a1": "Los acompañantes estarán indicados en su invitación. Por favor revísenla cuando llegue.",
    "faq.q2": "¿Pueden asistir niños?",
    "faq.a2": "Queremos mucho a sus pequeños, pero será una celebración solo para adultos.",
    "faq.q3": "¿A qué hora debo llegar?",
    "faq.a3": "Por favor lleguen a más tardar a las 3:00 PM, treinta minutos antes de que la celebración comience a las 3:30.",
    "faq.q4": "¿Hay estacionamiento en el lugar?",
    "faq.a4": "Sí. Hay estacionamiento en Rixey Manor y la señalización los guiará al llegar. Vean el mapa de arriba para encontrar la entrada.",

    "gallery.title": "Galería",
    "gallery.empty": "Fotos muy pronto ♡",

    "rsvp.title": "Confirmación de asistencia",
    "rsvp.deadline": "Por favor respondan antes del <strong>1 de febrero de 2027</strong>. Busque su nombre y díganos si podrá acompañarnos. ¡Esperamos que sí!",
    "rsvp.first": "Nombre",
    "rsvp.last": "Apellido",
    "rsvp.hint": "Por favor escriba su nombre tal como aparece en su invitación.",
    "rsvp.find": "Buscar mi invitación",
    "rsvp.back": "Volver",
    "rsvp.send": "Enviar respuesta",
    "rsvp.thanks": "¡Gracias!",
    "rsvp.unconfigured": "Estamos preparando el formulario de confirmación. ¡Vuelvan pronto!",
    "btn.looking": "Buscando…",
    "btn.sending": "Enviando…",

    "err.need_full_name": "Por favor escriba su nombre y apellido.",
    "err.not_found": "No encontramos ese nombre en nuestra lista de invitados. Intente escribirlo tal como aparece en su invitación, o comuníquese con nosotros y lo resolveremos.",
    "err.ambiguous": "Encontramos más de una coincidencia. Por favor escriba su nombre exactamente como aparece en su invitación.",
    "err.rate_limited": "Hay mucha actividad en este momento. Espere un momento e intente de nuevo.",
    "err.bad_request": "No pudimos leer esa respuesta. Recargue la página e intente de nuevo.",
    "err.server_error": "Algo salió mal de nuestro lado. Intente de nuevo en un minuto.",
    "err.missing": "Por favor díganos si podrá acompañarnos.",
    "err.guestname": "Por favor díganos el nombre de su acompañante.",
    "err.empty": "Elija una respuesta para al menos una persona antes de enviar.",

    "form.you": "usted",
    "form.replied.yes": "Ya respondió: <strong>asistirá</strong>.",
    "form.replied.no": "Ya respondió: <strong>no asistirá</strong>.",
    "form.change": "Cambiar",
    "form.guestname": "Nombre de su acompañante",
    "form.guestname.ph": "¿A quién llevará?",
    "form.accept": "Acepta con alegría",
    "form.decline": "Lamenta no asistir",
    "form.skip": "Responderá por su cuenta",
    "form.party.pending": "Puede responder por todos los de su invitación o solo por usted. Los demás pueden responder después.",
    "form.party.replied": "Los demás de su invitación ya respondieron. Puede cambiar sus respuestas si es necesario.",
    "form.email": "Correo electrónico (opcional, para enviarles novedades)",
    "form.song": "Una canción que los saque a bailar (opcional)",
    "form.note": "Una nota para Julie y Seth (opcional)",
    "form.meal": "Elección de platillo",
    "form.meal.ph": "Elija una opción…",
    "form.dietary": "Restricciones alimentarias o alergias (opcional)",

    "done.yes": "¡Qué emoción celebrar con ustedes! ¡Nos vemos el 17 de julio!",
    "done.no": "Gracias por avisarnos. Los extrañaremos, y agradecemos que nos lo hayan dicho.",
    "done.wait.one": "{name} aún no ha respondido. Puede volver a esta página y buscar su nombre cuando quiera.",
    "done.wait.many": "Aún falta por responder: {names}. Pueden volver a esta página y buscar su nombre cuando quieran.",

    "footer.msg": "De un pasillo universitario en JMU a una montaña en Colorado, cada paso nos trajo hasta aquí. Vengan a bailar el siguiente con nosotros.",
  },
};

function currentLang() {
  try {
    const stored = localStorage.getItem("lang");
    if (stored === "es" || stored === "en") return stored;
  } catch (err) { /* private mode etc. */ }
  return "en";
}

function t(key) {
  const lang = I18N[currentLang()] || I18N.en;
  return lang[key] !== undefined ? lang[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
}

/** Applies the current language to every element carrying data-i18n. */
function applyLang() {
  const lang = currentLang();
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.innerHTML = t(node.getAttribute("data-i18n"));
  });

  // The toggle offers the language you are NOT currently reading.
  const btn = document.getElementById("lang-toggle");
  if (btn) btn.textContent = lang === "es" ? "English" : "Español";

  // Dynamic views (the RSVP form) re-render themselves on this signal.
  document.dispatchEvent(new CustomEvent("langchange"));
}

function setLang(lang) {
  try { localStorage.setItem("lang", lang); } catch (err) { /* fine */ }
  applyLang();
}

(function initLang() {
  const btn = document.getElementById("lang-toggle");
  if (btn) {
    btn.addEventListener("click", () => {
      setLang(currentLang() === "es" ? "en" : "es");
    });
  }
  applyLang();
})();
