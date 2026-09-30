// Shared data layer for index.html (students) and admin.html (staff).
// Prototype only: registrations are saved in this browser's localStorage.
// In production these functions become calls to the backend API.
"use strict";

const CampusData = (() => {
  const STORAGE_KEY = "campusEvents.registrations.v1";
  const ALLOWED_DOMAIN = "@univ.edu.ph";

  const events = [
    {
      id: 1, title: "Intro to Generative AI Workshop", category: "Academic",
      start: "2026-10-14T13:00", venue: "IT Building, Room 301", capacity: 40,
      description: "Hands-on session on prompt design and verifying AI output. Bring a laptop.",
      image: "images/workshop.svg",
      alt: "Illustration of a laptop screen next to a presenter at a workshop"
    },
    {
      id: 2, title: "Inter-College Futsal Cup", category: "Sports",
      start: "2026-10-21T15:30", venue: "University Covered Court", capacity: 3,
      description: "Eight college teams, single-elimination. Spectator seats are limited.",
      image: "images/sports.svg",
      alt: "Illustration of a futsal court seen from above with a yellow ball"
    },
    {
      id: 3, title: "Harana Night: Acoustic Showcase", category: "Culture",
      start: "2026-11-06T18:00", venue: "Open-Air Amphitheater", capacity: 120,
      description: "Student bands and soloists perform OPM classics under the stars.",
      image: "images/culture.svg",
      alt: "Illustration of a stage at night with a yellow moon above rolling hills"
    }
  ];

  // No sample attendees: the list starts empty and only holds real registrations.
  const seedRegistrations = [];

  function loadRegistrations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedRegistrations.map(r => ({ ...r }));
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : seedRegistrations.map(r => ({ ...r }));
    } catch (err) {
      // Storage blocked (private mode, file:// restrictions) or corrupted JSON
      console.warn("Could not read saved registrations; using sample data.", err);
      return seedRegistrations.map(r => ({ ...r }));
    }
  }

  function saveRegistrations(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      console.warn("Could not save registrations; they will be lost on reload.", err);
      return false;
    }
  }

  function seatsLeft(event, registrations) {
    return event.capacity - registrations.filter(r => r.eventId === event.id).length;
  }

  // Same rule as the backend RegistrationValidator: exact domain, no look-alikes.
  function isValidStudentEmail(email) {
    if (!email) return false;
    return /^[A-Za-z0-9._%+-]+@univ\.edu\.ph$/i.test(email.trim());
  }

  // Builds elements with textContent only, so data is never parsed as HTML (XSS-safe).
  function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  return { ALLOWED_DOMAIN, STORAGE_KEY, events, loadRegistrations, saveRegistrations, seatsLeft, isValidStudentEmail, el };
})();
