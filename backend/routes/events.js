const express = require("express");
const { db } = require("../supabase");
const { requireAuth, allowRoles } = require("../middleware/auth");
const router = express.Router();
const categories = ["Technical", "Cultural", "Sports", "Workshop", "Seminar", "Other"];

function validateEvent(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const category = body.category;
  const startsAt = new Date(body.startsAt), endsAt = new Date(body.endsAt);
  const capacity = Number(body.capacity);
  if (title.length < 3 || title.length > 140) return { error: "Title must be between 3 and 140 characters." };
  if (description.length < 10 || description.length > 3000) return { error: "Description must be between 10 and 3000 characters." };
  if (venue.length < 2 || venue.length > 180) return { error: "Venue must be between 2 and 180 characters." };
  if (!categories.includes(category)) return { error: "Choose a valid category." };
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { error: "Enter valid start and end dates." };
  if (startsAt <= new Date()) return { error: "Event start time must be in the future." };
  if (endsAt <= startsAt) return { error: "Event end time must be after its start time." };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return { error: "Capacity must be a whole number between 1 and 10000." };
  return { value: { title, description, venue, category, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), capacity } };
}
async function eventCounts(events) {
  if (!events.length) return [];
  const ids = events.map((e) => e.id);
  const { data: regs, error } = await db.from("registrations").select("event_id").in("event_id", ids).eq("status", "registered");
  if (error) throw error;
  const counts = {};
  for (const r of regs || []) counts[r.event_id] = (counts[r.event_id] || 0) + 1;
  return events.map((e) => ({ ...e, registration_count: counts[e.id] || 0 }));
}
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db.from("events").select("id,title,description,category,venue,starts_at,ends_at,capacity,status,organizer_id,created_at")
      .eq("status", "published").gte("ends_at", new Date().toISOString()).order("starts_at", { ascending: true });
    if (error) throw error;
    return res.json({ events: await eventCounts(data || []) });
  } catch (error) { next(error); }
});
router.post("/", requireAuth, allowRoles("organizer", "admin"), async (req, res, next) => {
  try {
    const validated = validateEvent(req.body || {});
    if (validated.error) return res.status(400).json({ error: validated.error });
    const { data, error } = await db.from("events").insert({ ...validated.value, organizer_id: req.user.id, status: "published" }).select().single();
    if (error) throw error;
    return res.status(201).json({ event: { ...data, registration_count: 0 } });
  } catch (error) { next(error); }
});
router.patch("/:id", requireAuth, allowRoles("organizer", "admin"), async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await db.from("events").select("*").eq("id", req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: "Event not found." });
    if (req.user.role !== "admin" && existing.organizer_id !== req.user.id) return res.status(403).json({ error: "You can edit only events you organize." });
    const validated = validateEvent(req.body || {});
    if (validated.error) return res.status(400).json({ error: validated.error });
    const { count, error: countError } = await db.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", existing.id).eq("status", "registered");
    if (countError) throw countError;
    if (validated.value.capacity < (count || 0)) return res.status(400).json({ error: `Capacity cannot be lower than the ${count} current registrations.` });
    const { data, error } = await db.from("events").update(validated.value).eq("id", existing.id).select().single();
    if (error) throw error;
    return res.json({ event: data });
  } catch (error) { next(error); }
});
router.delete("/:id", requireAuth, allowRoles("organizer", "admin"), async (req, res, next) => {
  try {
    const { data: existing, error } = await db.from("events").select("id,organizer_id").eq("id", req.params.id).maybeSingle();
    if (error) throw error;
    if (!existing) return res.status(404).json({ error: "Event not found." });
    if (req.user.role !== "admin" && existing.organizer_id !== req.user.id) return res.status(403).json({ error: "You can cancel only events you organize." });
    const { error: updateError } = await db.from("events").update({ status: "cancelled" }).eq("id", existing.id);
    if (updateError) throw updateError;
    return res.json({ message: "Event cancelled." });
  } catch (error) { next(error); }
});
module.exports = router;
