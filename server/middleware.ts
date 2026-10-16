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
  }
}

export interface AuthedUser {
  id: number;
  email: string;
  name: string;
  initials: string;
  role: string;
  userType: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
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

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) throw new HttpError(401, "Please log in");
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || !u.active) {
    req.session.destroy(() => undefined);
    throw new HttpError(401, "Please log in");
  }
  req.user = { id: u.id, email: u.email, name: u.name, initials: u.initials, role: u.role, userType: u.userType };
  next();
}

/** Is this user allowed to work in this client? Checked on EVERY request, not just at switch time. */
export async function userCanAccessClient(userId: number, clientId: number): Promise<boolean> {
  const db = getControlDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || !u.active) return false;
  if (u.userType === "client_portal") return u.portalClientId === clientId;
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
  const clientId = req.session.activeClientId;
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
    userId: req.user.id,
    userInitials: req.user.initials,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId === undefined ? null : String(entry.entityId),
    patientId: entry.patientId ?? null,
    details: entry.details ?? null,
  });
}
