// Student page (index.html): event catalog and registration form.
// Depends on data.js, which must be loaded first.
"use strict";

(() => {
  const { ALLOWED_DOMAIN, events, loadRegistrations, saveRegistrations, seatsLeft, isValidStudentEmail, el } = CampusData;
  let registrations = loadRegistrations();

  const $ = (sel) => document.querySelector(sel);
  const fmtDate = (d) => d.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const fmtTime = (d) => d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  const seatText = (left, cap) => left <= 0 ? "Full: no seats left" : `${left} of ${cap} seats left`;

  /* ---------------------------- Event catalog ---------------------------- */

  function renderEvents() {
    const list = $("#event-list");
    const filter = $("#category-filter").value;
    list.replaceChildren();

    const shown = events.filter(e => filter === "all" || e.category === filter);
    if (shown.length === 0) {
      list.append(el("p", {}, "No events in this category yet. Choose another category."));
      return;
    }

    for (const e of shown) {
      const d = new Date(e.start);
      const left = seatsLeft(e, registrations);
      const headingId = `event-title-${e.id}`;

      const article = el("article", { class: "event", "aria-labelledby": headingId });

      const time = el("time", { class: "event-date", datetime: e.start });
      time.append(
        el("span", { class: "month" }, d.toLocaleString("en-PH", { month: "short" })),
        el("span", { class: "day" }, String(d.getDate())),
        el("span", { class: "weekday" }, d.toLocaleString("en-PH", { weekday: "short" }))
      );

      const body = el("div", { class: "event-body" });
      const img = el("img", { class: "event-img", src: e.image, alt: e.alt, width: "320", height: "180" });
      const text = el("div", { class: "event-text" });
      text.append(
        el("h3", { id: headingId }, e.title),
        el("p", { class: "event-meta" }, `${e.category}, ${fmtTime(d)}, ${e.venue}`),
        el("p", {}, e.description),
        el("p", { class: "seats" + (left <= 0 ? " full" : left <= 5 ? " low" : "") }, seatText(left, e.capacity))
      );

      const btn = el("button", { type: "button", class: "btn-secondary" },
        left <= 0 ? "Event full" : "Register for this event");
      btn.setAttribute("aria-label", left <= 0 ? `${e.title} is full` : `Register for ${e.title}`);
      if (left <= 0) btn.disabled = true;
      btn.addEventListener("click", () => {
        showForm();
        $("#event-select").value = String(e.id);
        validateField("event");
        renderSummary();
        $("#register").scrollIntoView();
        $("#full-name").focus();
      });
      text.append(btn);

      body.append(img, text);
      article.append(time, body);
      list.append(article);
    }
  }

  function fillEventSelect() {
    const sel = $("#event-select");
    const keep = sel.value;
    sel.replaceChildren(el("option", { value: "" }, "Choose an event"));
    for (const e of events) {
      const d = new Date(e.start);
      const left = seatsLeft(e, registrations);
      const when = d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      const label = left <= 0
        ? `${e.title}, ${when} (full)`
        : `${e.title}, ${when} (${left} seats left)`;
      const opt = el("option", { value: String(e.id) }, label);
      if (left <= 0) opt.disabled = true;
      sel.append(opt);
    }
    sel.value = keep;
  }

  /* ------------------------ Selected-event summary ------------------------ */

  function renderSummary() {
    const box = $("#summary-body");
    box.replaceChildren();
    const ev = events.find(e => e.id === Number($("#event-select").value));
    if (!ev) {
      box.append(el("p", { class: "summary-empty" }, "Choose an event to see its date, venue and seats left."));
      return;
    }
    const d = new Date(ev.start);
    const left = seatsLeft(ev, registrations);
    box.append(
      el("img", { class: "summary-img", src: ev.image, alt: ev.alt, width: "320", height: "180" }),
      el("p", { class: "summary-title" }, ev.title)
    );
    const dl = el("dl", { class: "summary-list" });
    for (const [k, v] of [["Date", fmtDate(d)], ["Time", fmtTime(d)], ["Venue", ev.venue], ["Seats", seatText(left, ev.capacity)]]) {
      dl.append(el("dt", {}, k), el("dd", {}, v));
    }
    box.append(dl);
  }

  /* ------------------------------ Validation ------------------------------ */

  // Each rule returns an error message, or "" when the value is valid.
  const rules = {
    name: {
      input: "full-name", error: "full-name-error",
      check: () => $("#full-name").value.trim().length >= 2 ? "" : "Enter your full name."
    },
    sid: {
      input: "student-id", error: "student-id-error",
      check: () => /^\d{4}-\d{5}$/.test($("#student-id").value.trim()) ? "" : "Enter your 9-digit student ID, like 2022-12345."
    },
    email: {
      input: "email", error: "email-error",
      check: () => {
        const v = $("#email").value.trim();
        if (!v) return `Enter your university email ending in ${ALLOWED_DOMAIN}.`;
        return isValidStudentEmail(v) ? "" : `Use your university email ending in ${ALLOWED_DOMAIN}.`;
      }
    },
    event: {
      input: "event-select", error: "event-error",
      check: () => $("#event-select").value ? "" : "Choose an event."
    },
    year: {
      input: null, error: "year-error",
      check: () => document.querySelector('input[name="yearLevel"]:checked') ? "" : "Choose your year level."
    }
  };

  function validateField(key) {
    const rule = rules[key];
    const message = rule.check();
    document.getElementById(rule.error).textContent = message;
    if (rule.input) {
      const input = document.getElementById(rule.input);
      input.setAttribute("aria-invalid", message ? "true" : "false");
      input.classList.toggle("is-valid", !message);
    }
    // Once every flagged field is fixed, remove the "fix N fields" summary so it doesn't go stale
    const status = $("#form-status");
    if (status.classList.contains("fail") && status.dataset.kind === "validation" &&
        Object.values(rules).every(r => !document.getElementById(r.error).textContent)) {
      status.className = "status";
      status.textContent = "";
    }
    return !message;
  }

  function clearValidation() {
    for (const rule of Object.values(rules)) {
      document.getElementById(rule.error).textContent = "";
      if (rule.input) {
        const input = document.getElementById(rule.input);
        input.removeAttribute("aria-invalid");
        input.classList.remove("is-valid");
      }
    }
    $("#email-suggest").hidden = true;
    const status = $("#form-status");
    status.className = "status";
    status.textContent = "";
  }

  /* ---------------------------- Input helpers ---------------------------- */

  // Student ID: keep digits only and insert the dash after the 4th digit.
  function formatStudentId() {
    const input = $("#student-id");
    const digits = input.value.replace(/\D/g, "").slice(0, 9);
    input.value = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  }

  // Email: if the user typed only a username (or a different domain), offer the fix in one click.
  function updateEmailSuggestion() {
    const v = $("#email").value.trim();
    const local = v.split("@")[0];
    const wrap = $("#email-suggest");
    if (v && !isValidStudentEmail(v) && /^[A-Za-z0-9._%+-]+$/.test(local)) {
      const fixed = `${local}${ALLOWED_DOMAIN}`;
      $("#email-suggest-btn").textContent = `Use ${fixed}`;
      $("#email-suggest-btn").dataset.value = fixed;
      wrap.hidden = false;
    } else {
      wrap.hidden = true;
    }
  }

  /* ------------------------- Submit / confirmation ------------------------- */

  function showForm() {
    $("#confirmation").hidden = true;
    $("#register-layout").hidden = false;
  }

  function showConfirmation(reg, ev) {
    const d = new Date(ev.start);
    const dl = $("#confirm-details");
    dl.replaceChildren();
    for (const [k, v] of [["Event", ev.title], ["When", `${fmtDate(d)}, ${fmtTime(d)}`], ["Where", ev.venue], ["Name", reg.fullName], ["Email", reg.email]]) {
      dl.append(el("dt", {}, k), el("dd", {}, v));
    }
    $("#register-layout").hidden = true;
    $("#confirmation").hidden = false;
    $("#confirm-title").focus(); // announce the result to screen-reader and keyboard users
  }

  function handleSubmit(evt) {
    evt.preventDefault();
    const form = evt.target;
    const status = $("#form-status");
    status.className = "status";
    status.textContent = "";
    status.dataset.kind = "";

    // Re-read storage in case another tab changed it
    registrations = loadRegistrations();

    const results = Object.keys(rules).map(validateField);
    if (results.includes(false)) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]') ||
                           form.querySelector('input[name="yearLevel"]');
      firstInvalid.focus();
      const count = results.filter(ok => !ok).length;
      status.classList.add("fail");
      status.dataset.kind = "validation";
      status.textContent = `Registration not sent. Fix ${count} ${count === 1 ? "field" : "fields"} marked in red.`;
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    const name = data.fullName.trim();
    const sid = data.studentId.trim();
    const email = data.email.trim().toLowerCase();
    const eventId = Number(data.eventId);
    const ev = events.find(e => e.id === eventId);

    if (seatsLeft(ev, registrations) <= 0) {
      status.classList.add("fail");
      status.textContent = `${ev.title} just filled up. Choose another event.`;
      fillEventSelect(); renderEvents(); renderSummary();
      return;
    }
    if (registrations.some(r => r.eventId === eventId && r.email === email)) {
      status.classList.add("fail");
      status.textContent = `${email} is already registered for ${ev.title}.`;
      $("#email").focus();
      return;
    }

    const reg = { eventId, fullName: name, studentId: sid, email, yearLevel: data.yearLevel, at: new Date().toISOString() };
    registrations.push(reg);
    const saved = saveRegistrations(registrations);

    form.reset();
    clearValidation();
    fillEventSelect();
    renderEvents();
    renderSummary();
    showConfirmation(reg, ev);
    if (!saved) {
      $("#confirm-title").textContent = "You're registered (not saved)";
      $("#confirm-details").after(el("p", { class: "status fail" }, "This browser could not save your registration. It will be lost if you reload."));
    }
  }

  /* -------------------------------- Wiring -------------------------------- */

  document.addEventListener("DOMContentLoaded", () => {
    fillEventSelect();
    renderEvents();
    renderSummary();

    $("#category-filter").addEventListener("change", renderEvents);
    const form = $("#registration-form");
    form.addEventListener("submit", handleSubmit);
    form.addEventListener("reset", () => setTimeout(() => { clearValidation(); renderSummary(); }, 0));

    // Validate a field when the user leaves it (not while typing), then
    // re-check on every keystroke once it has been flagged, so errors clear immediately.
    for (const [key, rule] of Object.entries(rules)) {
      if (!rule.input) continue;
      const input = document.getElementById(rule.input);
      input.addEventListener("blur", () => { if (input.value.trim()) validateField(key); });
      input.addEventListener("input", () => {
        if (input.getAttribute("aria-invalid") === "true") validateField(key);
      });
    }
    document.querySelectorAll('input[name="yearLevel"]').forEach(r =>
      r.addEventListener("change", () => validateField("year")));

    $("#student-id").addEventListener("input", formatStudentId);
    $("#email").addEventListener("input", updateEmailSuggestion);
    $("#email").addEventListener("blur", updateEmailSuggestion);
    $("#email-suggest-btn").addEventListener("click", (e) => {
      $("#email").value = e.currentTarget.dataset.value;
      $("#email-suggest").hidden = true;
      validateField("email");
      $("#email").focus();
    });
    $("#event-select").addEventListener("change", () => { validateField("event"); renderSummary(); });

    $("#register-another").addEventListener("click", () => {
      showForm();
      $("#full-name").focus();
    });
  });
})();