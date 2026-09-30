// Student page (index.html): event catalog and registration form.
// Depends on data.js, which must be loaded first.
"use strict";

(() => {
  const { ALLOWED_DOMAIN, events, loadRegistrations, saveRegistrations, seatsLeft, isValidStudentEmail, el } = CampusData;
  let registrations = loadRegistrations();

  const $ = (sel) => document.querySelector(sel);

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

      // Date stub: <time> is the container, so the machine-readable date covers all three parts
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
        el("p", { class: "event-meta" },
          `${e.category}, ${d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}, ${e.venue}`),
        el("p", {}, e.description),
        el("p", { class: "seats" + (left <= 0 ? " full" : left <= 5 ? " low" : "") },
          left <= 0 ? "Full: no seats left" : `${left} of ${e.capacity} seats left`)
      );

      const btn = el("button", { type: "button", class: "btn-secondary" },
        left <= 0 ? "Event full" : "Register for this event");
      btn.setAttribute("aria-label", left <= 0 ? `${e.title} is full` : `Register for ${e.title}`);
      if (left <= 0) btn.disabled = true;
      btn.addEventListener("click", () => {
        $("#event-select").value = String(e.id);
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
      const left = seatsLeft(e, registrations);
      const opt = el("option", { value: String(e.id) }, `${e.title}${left <= 0 ? " (full)" : ""}`);
      if (left <= 0) opt.disabled = true;
      sel.append(opt);
    }
    sel.value = keep;
  }

  function setError(inputId, errorId, message) {
    const input = inputId ? document.getElementById(inputId) : null;
    document.getElementById(errorId).textContent = message;
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
    return !message;
  }

  function handleSubmit(evt) {
    evt.preventDefault();
    const form = evt.target;
    const data = Object.fromEntries(new FormData(form));
    const status = $("#form-status");
    status.className = "status";
    status.textContent = "";

    // Re-read storage in case the admin page or another tab changed it
    registrations = loadRegistrations();

    const name = (data.fullName || "").trim();
    const sid = (data.studentId || "").trim();
    const email = (data.email || "").trim().toLowerCase();
    const eventId = Number(data.eventId);
    const ev = events.find(e => e.id === eventId);

    const checks = [
      setError("full-name", "full-name-error", name.length >= 2 ? "" : "Enter your full name."),
      setError("student-id", "student-id-error", /^\d{4}-\d{5}$/.test(sid) ? "" : "Enter your student ID like 2022-12345."),
      setError("email", "email-error", isValidStudentEmail(email) ? "" : `Use your university email ending in ${ALLOWED_DOMAIN}.`),
      setError("event-select", "event-error", ev ? "" : "Choose an event."),
      setError(null, "year-error", data.yearLevel ? "" : "Choose your year level.")
    ];

    if (checks.includes(false)) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]') || form.querySelector('input[type="radio"]');
      firstInvalid.focus();
      status.classList.add("fail");
      status.textContent = "Registration not sent. Fix the highlighted fields.";
      return;
    }

    if (seatsLeft(ev, registrations) <= 0) {
      status.classList.add("fail");
      status.textContent = `${ev.title} is full. Choose another event.`;
      fillEventSelect();
      renderEvents();
      return;
    }
    if (registrations.some(r => r.eventId === eventId && r.email === email)) {
      status.classList.add("fail");
      status.textContent = `${email} is already registered for ${ev.title}.`;
      return;
    }

    registrations.push({ eventId, fullName: name, studentId: sid, email, yearLevel: data.yearLevel, at: new Date().toISOString() });
    const saved = saveRegistrations(registrations);

    status.classList.add("ok");
    status.textContent = saved
      ? `Registered. See you at ${ev.title}.`
      : `Registered for ${ev.title}, but this browser could not save it. It will be lost if you reload.`;
    form.reset();
    fillEventSelect();
    renderEvents();
  }

  document.addEventListener("DOMContentLoaded", () => {
    fillEventSelect();
    renderEvents();
    $("#category-filter").addEventListener("change", renderEvents);
    $("#registration-form").addEventListener("submit", handleSubmit);
  });
})();
