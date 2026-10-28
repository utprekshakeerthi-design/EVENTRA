const API = "/api";
const state = { token: localStorage.getItem("cc_token"), user: null, events: [], mode: "login" };
const $ = (selector) => document.querySelector(selector);
const authModal = $("#authModal"), eventModal = $("#eventModal"), registrationsModal = $("#registrationsModal"), participantsModal = $("#participantsModal");

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function showNotice(message, type = "success") {
  const el = $("#notice"); el.textContent = message; el.className = `notice${type === "error" ? " error" : ""}`; el.hidden = false;
  window.setTimeout(() => { el.hidden = true; }, 5000);
}
function setFormMessage(selector, message, success = false) {
  const el = $(selector); el.textContent = message; el.className = `form-message${success ? " success" : ""}`;
}
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) { clearSession(false); }
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}
function dateText(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function categoryClass(value) { return String(value || "other").toLowerCase().replace(/[^a-z]/g, ""); }
function symbolFor(category) { return ({ Technical:"⌘", Cultural:"✳", Sports:"↗", Workshop:"✎", Seminar:"◉", Other:"✦" })[category] || "✦"; }
function canManage(event) { return state.user && (state.user.role === "admin" || (state.user.role === "organizer" && event.organizer_id === state.user.id)); }

function updateAuthUI() {
  const loggedIn = Boolean(state.user);
  $("#authActions").hidden = loggedIn; $("#userActions").hidden = !loggedIn;
  $("#userLabel").textContent = loggedIn ? `${state.user.full_name} · ${state.user.role}` : "";
  $("#myEventsBtn").hidden = !loggedIn;
  $("#dashboardBtn").hidden = !(loggedIn && ["organizer", "admin"].includes(state.user.role));
  $("#createEventOpen").hidden = !(loggedIn && ["organizer", "admin"].includes(state.user.role));
  $("#ctaCreate").hidden = !(loggedIn && ["organizer", "admin"].includes(state.user.role));
  $("#ctaLogin").hidden = loggedIn;
}
async function loadSession() {
  if (!state.token) { updateAuthUI(); return; }
  try {
    const data = await api("/auth/me"); state.user = data.user;
  } catch { clearSession(false); }
  updateAuthUI();
}
function clearSession(showMessage = true) {
  state.token = null; state.user = null; localStorage.removeItem("cc_token"); updateAuthUI();
  if (showMessage) showNotice("You have logged out.");
}
async function loadEvents() {
  $("#eventGrid").innerHTML = '<div class="loading-card">Loading campus events…</div>';
  try {
    const data = await api("/events");
    state.events = data.events;
    $("#eventCount").textContent = state.events.length;
    renderEvents();
  } catch (error) {
    $("#eventGrid").innerHTML = '<div class="loading-card">Events could not be loaded. Check your server and Supabase setup, then refresh.</div>';
    showNotice(error.message, "error");
  }
}
function renderEvents() {
  const query = $("#searchInput").value.trim().toLowerCase(), category = $("#categoryFilter").value, sort = $("#sortFilter").value;
  let events = state.events.filter((e) => (!category || e.category === category) && (!query || `${e.title} ${e.description} ${e.venue} ${e.category}`.toLowerCase().includes(query)));
  events.sort((a,b) => sort === "latest" ? new Date(b.starts_at)-new Date(a.starts_at) : new Date(a.starts_at)-new Date(b.starts_at));
  $("#eventCount").textContent = events.length;
  $("#emptyState").hidden = events.length > 0;
  $("#eventGrid").innerHTML = events.map((e) => {
    const remaining = Math.max(0, Number(e.capacity) - Number(e.registration_count || 0));
    const management = canManage(e);
    const action = state.user ? (state.user.role === "student" ? `<button class="button button-primary" data-register="${escapeHTML(e.id)}" ${remaining < 1 || new Date(e.ends_at) < new Date() ? "disabled" : ""}>${remaining < 1 ? "Full" : "Register"}</button>` : "") : '<button class="button button-primary" data-login-required>Log in to register</button>';
    return `<article class="event-card">
      <div class="event-cover ${categoryClass(e.category)}"><span class="category-chip">${escapeHTML(e.category)}</span><span class="cover-symbol">${symbolFor(e.category)}</span></div>
      <div class="event-content"><span class="event-date">${escapeHTML(dateText(e.starts_at))}</span>
      <h3>${escapeHTML(e.title)}</h3><p class="event-description">${escapeHTML(e.description)}</p>
      <div class="event-meta"><span>⌖ ${escapeHTML(e.venue)}</span><span>♙ ${remaining} seats left</span></div>
      <div class="event-footer">${action}${management ? `<button class="button button-quiet" data-edit="${escapeHTML(e.id)}">Edit</button><button class="button button-quiet" data-cancel-event="${escapeHTML(e.id)}">Cancel event</button><button class="button button-quiet" data-participants="${escapeHTML(e.id)}">People</button>` : ""}</div></div></article>`;
  }).join("");
}
function openAuth(mode) {
  state.mode = mode; $("#authTitle").textContent = mode === "signup" ? "Create your account" : "Log in";
  $("#authEyebrow").textContent = mode === "signup" ? "JOIN THE COMMUNITY" : "WELCOME BACK";
  $("#authSubtitle").textContent = mode === "signup" ? "Create a student account to register for events." : "Sign in to manage your campus plans.";
  $("#nameField").hidden = mode !== "signup";
  $("#nameField").querySelector("input").required = mode === "signup";
  $("#authForm").elements.password.autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("#authSubmit").textContent = mode === "signup" ? "Create account" : "Log in";
  $("#authSwitch").innerHTML = mode === "signup" ? 'Already have an account? <button type="button" class="text-button" id="switchToLogin">Log in</button>' : 'New here? <button type="button" class="text-button" id="switchToSignup">Create an account</button>';
  setFormMessage("#authMessage", ""); authModal.showModal();
}
$("#authSwitch").addEventListener("click", (event) => {
  if (event.target.id === "switchToSignup") openAuth("signup");
  if (event.target.id === "switchToLogin") openAuth("login");
});
$("#loginOpen").addEventListener("click", () => openAuth("login"));
$("#signupOpen").addEventListener("click", () => openAuth("signup"));
$("#ctaLogin").addEventListener("click", () => openAuth("signup"));
$("#logoutBtn").addEventListener("click", () => { clearSession(); renderEvents(); });
$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  const payload = { email: form.get("email"), password: form.get("password") };
  if (state.mode === "signup") { payload.fullName = form.get("fullName"); }
  const button = $("#authSubmit"); button.disabled = true; button.textContent = "Please wait…"; setFormMessage("#authMessage", "");
  try {
    const data = await api(`/auth/${state.mode}`, { method: "POST", body: JSON.stringify(payload) });
    if (data.requiresEmailConfirmation) {
      setFormMessage("#authMessage", "Account created. Check your email to confirm it, then log in.", true);
    } else {
      state.token = data.session.access_token; localStorage.setItem("cc_token", state.token); state.user = data.user;
      authModal.close(); event.currentTarget.reset(); updateAuthUI(); await loadEvents(); showNotice("Welcome to CampusConnect!");
    }
  } catch (error) { setFormMessage("#authMessage", error.message); }
  finally { button.disabled = false; button.textContent = state.mode === "signup" ? "Create account" : "Log in"; }
});
$("#searchInput").addEventListener("input", renderEvents);
$("#categoryFilter").addEventListener("change", renderEvents);
$("#sortFilter").addEventListener("change", renderEvents);

$("#eventGrid").addEventListener("click", async (event) => {
  const register = event.target.closest("[data-register]"), edit = event.target.closest("[data-edit]"), people = event.target.closest("[data-participants]"), cancelEvent = event.target.closest("[data-cancel-event]"), login = event.target.closest("[data-login-required]");
  if (login) { openAuth("login"); return; }
  if (register) {
    register.disabled = true;
    try { await api(`/events/${register.dataset.register}/registrations`, { method: "POST", body: JSON.stringify({}) }); showNotice("You're registered for this event!"); await loadEvents(); }
    catch (error) { showNotice(error.message, "error"); register.disabled = false; }
  }
  if (edit) openEventForm(state.events.find((e) => e.id === edit.dataset.edit));
  if (cancelEvent) {
    if (!confirm("Cancel this event? Students will no longer be able to register.")) return;
    try { await api(`/events/${cancelEvent.dataset.cancelEvent}`, { method: "DELETE" }); showNotice("Event cancelled."); await loadEvents(); }
    catch (error) { showNotice(error.message, "error"); }
  }
  if (people) await loadParticipants(people.dataset.participants);
});
function toLocalInput(value) {
  const d = new Date(value); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
}
function openEventForm(eventData = null) {
  $("#eventForm").reset(); $("#eventForm").elements.eventId.value = eventData?.id || "";
  $("#eventModalTitle").textContent = eventData ? "Edit event" : "Create an event";
  $("#eventSubmit").textContent = eventData ? "Save changes" : "Publish event";
  if (eventData) {
    const f = $("#eventForm").elements; f.title.value = eventData.title; f.category.value = eventData.category;
    f.venue.value = eventData.venue; f.description.value = eventData.description; f.startsAt.value = toLocalInput(eventData.starts_at);
    f.endsAt.value = toLocalInput(eventData.ends_at); f.capacity.value = eventData.capacity;
  }
  setFormMessage("#eventMessage", ""); eventModal.showModal();
}
$("#createEventOpen").addEventListener("click", () => openEventForm());
$("#ctaCreate").addEventListener("click", () => openEventForm());
$("#dashboardBtn").addEventListener("click", () => { $("#events").scrollIntoView({behavior:"smooth"}); showNotice("Use the Create event button or Edit / People actions on your events."); });
$("#eventForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const f = event.currentTarget.elements;
  const payload = { title:f.title.value.trim(), category:f.category.value, venue:f.venue.value.trim(), description:f.description.value.trim(), startsAt:new Date(f.startsAt.value).toISOString(), endsAt:new Date(f.endsAt.value).toISOString(), capacity:Number(f.capacity.value) };
  const id = f.eventId.value, button = $("#eventSubmit"); button.disabled = true; setFormMessage("#eventMessage", "");
  try {
    await api(id ? `/events/${id}` : "/events", { method:id ? "PATCH" : "POST", body:JSON.stringify(payload) });
    eventModal.close(); showNotice(id ? "Event updated." : "Event published."); await loadEvents();
  } catch (error) { setFormMessage("#eventMessage", error.message); }
  finally { button.disabled = false; }
});
$("#myEventsBtn").addEventListener("click", async () => {
  $("#myRegistrations").innerHTML = '<div class="loading-card">Loading registrations…</div>'; setFormMessage("#registrationMessage", ""); registrationsModal.showModal();
  try {
    const data = await api("/registrations/me");
    $("#myRegistrations").innerHTML = data.registrations.length ? data.registrations.map((r) => `<div class="registration-item"><div><strong>${escapeHTML(r.event.title)}</strong><small>${escapeHTML(dateText(r.event.starts_at))} · ${escapeHTML(r.event.venue)} · ${escapeHTML(r.status)}</small></div><button class="button button-quiet" data-cancel-registration="${escapeHTML(r.id)}">Cancel</button></div>`).join("") : '<div class="loading-card">You have not registered for any events yet.</div>';
  } catch (error) { setFormMessage("#registrationMessage", error.message); }
});
$("#myRegistrations").addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-cancel-registration]"); if (!btn) return;
  if (!confirm("Cancel this event registration?")) return;
  try { await api(`/registrations/${btn.dataset.cancelRegistration}`, { method:"DELETE" }); showNotice("Registration cancelled."); $("#myEventsBtn").click(); await loadEvents(); }
  catch (error) { setFormMessage("#registrationMessage", error.message); }
});
async function loadParticipants(eventId) {
  const e = state.events.find((item) => item.id === eventId); $("#participantsTitle").textContent = e ? `Participants · ${e.title}` : "Participants";
  $("#participantsList").innerHTML = '<div class="loading-card">Loading participants…</div>'; participantsModal.showModal();
  try {
    const data = await api(`/events/${eventId}/registrations`);
    $("#participantsList").innerHTML = data.registrations.length ? data.registrations.map((r) => `<div class="registration-item"><div><strong>${escapeHTML(r.full_name)}</strong><small>${escapeHTML(r.email)} · ${escapeHTML(r.status)}</small></div></div>`).join("") : '<div class="loading-card">No registrations yet.</div>';
  } catch (error) { $("#participantsList").innerHTML = `<div class="loading-card">${escapeHTML(error.message)}</div>`; }
}
(async function init() { await loadSession(); await loadEvents(); })();
