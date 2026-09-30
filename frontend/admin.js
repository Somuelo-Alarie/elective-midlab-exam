// Admin page (admin.html): registered attendees per event.
// Depends on data.js, which must be loaded first.
"use strict";

(() => {
  const { events, loadRegistrations, el } = CampusData;
  const $ = (sel) => document.querySelector(sel);

  function fillEventSelect() {
    const sel = $("#attendee-event");
    sel.replaceChildren();
    for (const e of events) sel.append(el("option", { value: String(e.id) }, e.title));
  }

  function renderAttendees() {
    const registrations = loadRegistrations();
    const id = Number($("#attendee-event").value);
    const ev = events.find(e => e.id === id);
    const rows = registrations
      .filter(r => r.eventId === id)
      .sort((a, b) => new Date(a.at) - new Date(b.at));

    $("#attendee-caption").textContent =
      `${ev ? ev.title : "Event"}: ${rows.length} of ${ev ? ev.capacity : 0} seats taken`;

    const tbody = $("#attendee-body");
    tbody.replaceChildren();
    if (rows.length === 0) {
      const tr = el("tr");
      tr.append(el("td", { colspan: "4" }, "No registrations yet for this event."));
      tbody.append(tr);
      return;
    }
    for (const r of rows) {
      const tr = el("tr");
      tr.append(
        el("td", {}, r.fullName),
        el("td", {}, r.studentId),
        el("td", {}, r.email),
        el("td", {}, new Date(r.at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }))
      );
      tbody.append(tr);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    fillEventSelect();
    renderAttendees();
    $("#attendee-event").addEventListener("change", renderAttendees);
    // Update live when a student registers in another tab
    window.addEventListener("storage", (e) => {
      if (e.key === CampusData.STORAGE_KEY) renderAttendees();
    });
  });
})();
