const express = require("express");
const { authClient, db } = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

router.post("/signup", async (req, res, next) => {
  try {
    const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (fullName.length < 2 || fullName.length > 100) return res.status(400).json({ error: "Full name must be between 2 and 100 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be 8–128 characters long." });
    const { data, error } = await authClient.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) return res.status(400).json({ error: error.message });
    if (!data.user) return res.status(400).json({ error: "Account could not be created." });
    const { error: profileError } = await db.from("profiles").upsert({ id: data.user.id, full_name: fullName, email, role: "student" }, { onConflict: "id" });
    if (profileError) return res.status(500).json({ error: "Account was created, but its profile could not be initialized. Contact the project administrator." });
    if (!data.session) return res.status(201).json({ requiresEmailConfirmation: true });
    const { data: profile } = await db.from("profiles").select("id,full_name,role,email").eq("id", data.user.id).single();
    return res.status(201).json({ user: profile, session: data.session });
  } catch (error) { next(error); }
});
router.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) return res.status(401).json({ error: "Incorrect email or password, or email confirmation is required." });
    const { data: profile, error: profileError } = await db.from("profiles").select("id,full_name,role,email").eq("id", data.user.id).single();
    if (profileError || !profile) return res.status(403).json({ error: "Your profile is not ready. Contact the administrator." });
    return res.json({ user: profile, session: data.session });
  } catch (error) { next(error); }
});
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));
module.exports = router;
