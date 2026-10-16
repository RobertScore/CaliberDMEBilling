// Roles and permissions. Deny by default: a role can only do what is listed here.
// ASSUMPTION Q-001: starting role list, waiting on Caliber to confirm.

export const PERMISSIONS = [
  "patient.view",
  "patient.create",
  "patient.edit",
  "patient.remove", // spec: "ONLY MANAGEMENT HAS ACCESS TO REMOVE ANYTHING"
  "ssn.reveal",
  "note.create",
  "alert.manage",
  "charge.post",
  "payment.post",
  "ledger.reverse",
  "period.close",
  "audit.view",
  "codes.view",
  "document.view",
  "document.upload",
  "document.verify",
  "intake.process",
  "task.manage",
  "report.view",
  "users.manage",
  "users.view_as",
  "settings.manage",
  "portal.invite",
  // Client portal (a client's own staff)
  "portal.client.view",
  "portal.client.upload",
  "portal.client.users",
  // Patient portal
  "portal.patient.self",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_ROLES = ["owner", "billing_manager", "biller", "payment_poster", "collections", "auditor"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const CLIENT_PORTAL_ROLES = ["client_admin", "client_user"] as const;
export const PATIENT_PORTAL_ROLES = ["patient"] as const;
export type Role = StaffRole | (typeof CLIENT_PORTAL_ROLES)[number] | (typeof PATIENT_PORTAL_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner / Super Admin",
  billing_manager: "Billing Manager",
  biller: "Biller",
  payment_poster: "Payment Poster",
  collections: "Collections / AR",
  auditor: "Read-only / Auditor",
  client_admin: "Client admin",
  client_user: "Client user",
  patient: "Patient",
};

const STAFF_ALL: Permission[] = PERMISSIONS.filter((p) => !p.startsWith("portal.") || p === "portal.invite");
const WORK: Permission[] = ["patient.view", "note.create", "codes.view", "document.view", "task.manage", "report.view"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: STAFF_ALL,
  // ASSUMPTION Q-003 / Q-005: managers can reveal SSNs, close the books and manage users in their clients.
  billing_manager: STAFF_ALL,
  biller: [...WORK, "patient.create", "patient.edit", "alert.manage", "charge.post", "document.upload", "document.verify", "intake.process"],
  payment_poster: [...WORK, "payment.post", "document.upload"],
  collections: [...WORK, "alert.manage", "document.upload"],
  auditor: ["patient.view", "audit.view", "codes.view", "document.view", "report.view"],
  // Client portal: their own client only, view and upload; admins manage their own users.
  client_admin: ["portal.client.view", "portal.client.upload", "portal.client.users", "report.view"],
  client_user: ["portal.client.view", "portal.client.upload", "report.view"],
  // Patient portal: only their own account.
  patient: ["portal.patient.self"],
};

/** Roles a manager may hand out. Only the owner can create owners or managers. */
export function rolesAssignableBy(role: string): Role[] {
  if (role === "owner") return [...STAFF_ROLES, ...CLIENT_PORTAL_ROLES, ...PATIENT_PORTAL_ROLES];
  if (role === "billing_manager") return ["biller", "payment_poster", "collections", "auditor", ...CLIENT_PORTAL_ROLES, ...PATIENT_PORTAL_ROLES];
  return [];
}

export function roleHas(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  return Array.isArray(perms) && perms.includes(permission);
}

export const NOTE_CATEGORIES = [
  { code: "general", label: "General" },
  { code: "call", label: "Phone call" },
  { code: "email", label: "Email" },
  { code: "fax", label: "Fax" },
  { code: "authorization", label: "Authorization" },
  { code: "denial", label: "Denial follow-up" },
  { code: "payment", label: "Payment" },
  { code: "documents", label: "Documents" },
  { code: "intake", label: "Intake" },
  { code: "portal", label: "Portal message" },
] as const;
