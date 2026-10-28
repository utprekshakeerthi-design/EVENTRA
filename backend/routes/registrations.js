const express = require("express");
const { db } = require("../supabase");
const { requireAuth, allowRoles } = require("../middleware/auth");
const router = express.Router();

router.post("/events/:id/registrations", requireAuth, allowRoles("student"), async (req, res, next) => {
  try {
    const { data, error } = await db.rpc("register_for_event", { p_event_id: req.params.id, p_user_id: req.user.id });
    if (error) {
      if (error.message.includes("EVENT_NOT_FOUND")) return res.status(404).json({ error: "Event not found." });
      if (error.message.includes("EVENT_CLOSED")) return res.status(409).json({ error: "This event is closed or has already ended." });
      if (error.message.includes("EVENT_FULL")) return res.status(409).json({ error: "Sorry, this event is full." });
      if (error.message.includes("ALREADY_REGISTERED")) return res.status(409).json({ error: "You are already registered for this event." });
      throw error;
    }
    return res.status(201).json({ registration: data });
  } catch (error) { next(error); }
});
router.get("/registrations/me", requireAuth, allowRoles("student"), async (req, res, next) => {
  try {
    const { data, error } = await db.from("registrations").select("id,status,created_at,event:events(id,title,venue,starts_at,ends_at,status)")
      .eq("user_id", req.user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return res.json({ registrations: (data || []).filter((r) => r.event).map((r) => ({ ...r, event: r.event })) });
  } catch (error) { next(error); }
});
router.delete("/registrations/:id", requireAuth, allowRoles("student"), async (req, res, next) => {
  try {
    const { data, error } = await db.from("registrations").update({ status: "cancelled" })
      .eq("id", req.params.id).eq("user_id", req.user.id).eq("status", "registered").select("id").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Active registration not found." });
    return res.json({ message: "Registration cancelled." });
  } catch (error) { next(error); }
});
router.get("/events/:id/registrations", requireAuth, allowRoles("organizer", "admin"), async (req, res, next) => {
  try {
    const { data: event, error: eventError } = await db.from("events").select("id,organizer_id,title").eq("id", req.params.id).maybeSingle();
    if (eventError) throw eventError;
    if (!event) return res.status(404).json({ error: "Event not found." });
    if (req.user.role !== "admin" && event.organizer_id !== req.user.id) return res.status(403).json({ error: "You can view participants only for your own events." });
    const { data, error } = await db.from("registrations").select("id,status,created_at,profile:profiles(full_name,email)")
      .eq("event_id", event.id).eq("status", "registered").order("created_at", { ascending: true });
    if (error) throw error;
    return res.json({ registrations: (data || []).map((r) => ({ id:r.id, status:r.status, created_at:r.created_at, full_name:r.profile?.full_name || "Student", email:r.profile?.email || "" })) });
  } catch (error) { next(error); }
});
module.exports = router;
