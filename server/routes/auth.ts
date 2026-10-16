import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { getControlDb } from "../db/control";
import { clients, loginAudit, users, userClientAssignments } from "@shared/schema/control";
import { loginInput, switchClientInput } from "@shared/validation";
import { ROLE_PERMISSIONS, ROLE_LABELS, type StaffRole } from "@shared/permissions";
import { HttpError, requireAuth, userCanAccessClient } from "../middleware";

export const authRouter = Router();

authRouter.post("/api/auth/login", async (req, res) => {
  const { email, password } = loginInput.parse(req.body);
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  const ok = !!u && u.active && (await bcrypt.compare(password, u.passwordHash));
  await db.insert(loginAudit).values({ email, userId: u?.id ?? null, event: ok ? "login_ok" : "login_failed", ip: req.ip ?? null });
  // TODO before go-live: multi-factor login is required for staff (CLAUDE.md 3.2). Not in Phase 1.
  if (!ok || !u) throw new HttpError(401, "Wrong email or password");
  await new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
  req.session.userId = u.id;
  // Portal users only ever have their one client.
  if (u.userType === "client_portal" && u.portalClientId) req.session.activeClientId = u.portalClientId;
  res.json({ ok: true });
});

authRouter.post("/api/auth/logout", async (req, res) => {
  const userId = req.session.userId;
  if (userId) {
    const [u] = await getControlDb().select().from(users).where(eq(users.id, userId));
    if (u) await getControlDb().insert(loginAudit).values({ email: u.email, userId, event: "logout" });
  }
  req.session.destroy(() => res.json({ ok: true }));
});

/** Who am I, what can I do, and which clients can I work in. */
authRouter.get("/api/session", requireAuth, async (req, res) => {
  const db = getControlDb();
  const user = req.user!;
  let allowedIds: number[];
  if (user.userType === "client_portal") {
    const [u] = await db.select().from(users).where(eq(users.id, user.id));
    allowedIds = u?.portalClientId ? [u.portalClientId] : [];
  } else {
    allowedIds = (await db.select().from(userClientAssignments).where(eq(userClientAssignments.userId, user.id))).map(
      (r) => r.clientId,
    );
  }
  const allowed = allowedIds.length ? await db.select().from(clients).where(inArray(clients.id, allowedIds)) : [];
  const active = allowed.find((c) => c.id === req.session.activeClientId) ?? null;
  res.json({
    user: { ...user, roleLabel: ROLE_LABELS[user.role as StaffRole] ?? user.role },
    permissions: ROLE_PERMISSIONS[user.role as StaffRole] ?? [],
    clients: allowed.filter((c) => c.status === "active").map((c) => ({ id: c.id, name: c.name })),
    activeClient: active ? { id: active.id, name: active.name } : null,
  });
});

/** Switch the client you're working in. The server checks you're assigned to it. */
authRouter.post("/api/session/client", requireAuth, async (req, res) => {
  const { clientId } = switchClientInput.parse(req.body);
  if (!(await userCanAccessClient(req.user!.id, clientId))) throw new HttpError(403, "You don't have access to that client");
  req.session.activeClientId = clientId;
  await getControlDb().insert(loginAudit).values({ email: req.user!.email, userId: req.user!.id, event: "client_switch", clientId });
  res.json({ ok: true });
});
