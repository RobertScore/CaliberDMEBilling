import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { getControlDb } from "./db/control";
import { getTenant, type Tenant } from "./db/tenantDb";
import { clients, users, userClientAssignments } from "@shared/schema/control";
import { auditLog } from "@shared/schema/tenant";
import { roleHas, type Permission } from "@shared/permissions";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    /** The one client this user is working in right now. Set only by POST /api/session/client. */
    activeClientId?: number;
    /** "View as" (read-only): the user a manager is looking through. Set only by POST /api/session/view-as. */
    viewAsUserId?: number;
    viewAsReason?: string;
  }
}

export interface AuthedUser {
  id: number;
  email: string;
  name: string;
  initials: string;
  role: string;
  userType: string;
  portalClientId: number | null;
  portalPatientId: number | null;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
      /** Set while a manager is using "View as": the real person behind the request. */
      realUser?: AuthedUser;
      tenant?: Tenant;
    }
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const toAuthed = (u: typeof users.$inferSelect): AuthedUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  initials: u.initials,
  role: u.role,
  userType: u.userType,
  portalClientId: u.portalClientId,
  portalPatientId: u.portalPatientId,
  mustChangePassword: u.mustChangePassword,
});

// While viewing as someone else, only these changes are allowed (to leave "View as" or sign out).
const VIEW_AS_ALLOWED_WRITES = new Set(["DELETE /api/session/view-as", "POST /api/auth/logout", "POST /api/session/client"]);

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) throw new HttpError(401, "Please log in");
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || !u.active) {
    req.session.destroy(() => undefined);
    throw new HttpError(401, "Please log in");
  }
  req.user = toAuthed(u);

  if (req.session.viewAsUserId) {
    const [t] = await db.select().from(users).where(eq(users.id, req.session.viewAsUserId));
    if (!t || !t.active || !roleHas(u.role, "users.view_as")) {
      req.session.viewAsUserId = undefined;
    } else {
      req.realUser = req.user;
      req.user = toAuthed(t);
      // "View as" is strictly read-only.
      if (req.method !== "GET" && !VIEW_AS_ALLOWED_WRITES.has(`${req.method} ${req.path}`)) {
        throw new HttpError(403, "You're viewing as someone else, which is read-only. Leave “View as” to make changes.");
      }
    }
  }
  // A temporary password must be changed before anything else.
  if (u.mustChangePassword && !req.realUser && !["/api/session", "/api/auth/change-password", "/api/auth/logout"].includes(req.path)) {
    throw new HttpError(428, "Please set a new password first");
  }
  next();
}

/** Is this user allowed to work in this client? Checked on EVERY request, not just at switch time. */
export async function userCanAccessClient(userId: number, clientId: number): Promise<boolean> {
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || !u.active) return false;
  if (u.userType === "client_portal" || u.userType === "patient_portal") return u.portalClientId === clientId;
  const [row] = await db
    .select()
    .from(userClientAssignments)
    .where(and(eq(userClientAssignments.userId, userId), eq(userClientAssignments.clientId, clientId)));
  return !!row;
}

/**
 * Attaches req.tenant: the database of the client chosen in the user's SESSION.
 * Never reads a client ID from the URL, query, body or headers. (CLAUDE.md 3.1)
 */
export async function requireClient(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new HttpError(401, "Please log in");
  // Portal users are always in their one client; staff use the client picked in their session.
  const clientId = req.user.userType === "staff" ? req.session.activeClientId : (req.user.portalClientId ?? undefined);
  if (!clientId) throw new HttpError(409, "Pick a client first");
  if (!(await userCanAccessClient(req.user.id, clientId))) {
    req.session.activeClientId = undefined;
    throw new HttpError(403, "You don't have access to that client");
  }
  const [c] = await getControlDb().select().from(clients).where(eq(clients.id, clientId));
  if (!c || c.status !== "active") throw new HttpError(403, "That client isn't active");
  req.tenant = await getTenant(c.id, c.slug);
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roleHas(req.user.role, permission)) {
      throw new HttpError(403, "Your role doesn't allow this");
    }
    next();
  };
}

/** Write one audit entry in the CURRENT client's own audit log. Never pass PHI values in details. */
export async function audit(
  req: Request,
  entry: { action: string; entityType: string; entityId?: string | number; patientId?: number; details?: string },
) {
  if (!req.tenant || !req.user) throw new Error("audit() needs a logged-in user and a client");
  await req.tenant.db.insert(auditLog).values({
    // Under "View as" the record names the real person and who they were viewing as.
    userId: (req.realUser ?? req.user).id,
    userInitials: req.realUser ? `${req.realUser.initials} as ${req.user.initials}` : req.user.initials,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId === undefined ? null : String(entry.entityId),
    patientId: entry.patientId ?? null,
    details: entry.details ?? null,
  });
}
