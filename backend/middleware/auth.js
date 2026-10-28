const { authClient, db } = require("../supabase");

async function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Please log in to continue." });
    const { data, error } = await authClient.auth.getUser(match[1]);
    if (error || !data.user) return res.status(401).json({ error: "Your session is invalid or expired. Please log in again." });
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id, full_name, role, email").eq("id", data.user.id).maybeSingle();
    if (profileError || !profile) return res.status(403).json({ error: "Your account profile could not be found." });
    req.user = { id: profile.id, full_name: profile.full_name, role: profile.role, email: profile.email };
    next();
  } catch {
    return res.status(500).json({ error: "Could not verify your session." });
  }
}
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "You do not have permission to perform this action." });
    next();
  };
}
module.exports = { requireAuth, allowRoles };
