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
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_ROLES = [
  "owner",
  "billing_manager",
  "biller",
  "payment_poster",
  "collections",
  "auditor",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner / Super Admin",
  billing_manager: "Billing Manager",
  biller: "Biller",
  payment_poster: "Payment Poster",
  collections: "Collections / AR",
  auditor: "Read-only / Auditor",
};

const ALL: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  owner: ALL,
  // ASSUMPTION Q-003 / Q-005: managers can reveal SSNs and close the books.
  billing_manager: ALL,
  biller: ["patient.view", "patient.create", "patient.edit", "note.create", "alert.manage", "charge.post", "codes.view"],
  payment_poster: ["patient.view", "note.create", "payment.post", "codes.view"],
  collections: ["patient.view", "note.create", "alert.manage", "codes.view"],
  auditor: ["patient.view", "audit.view", "codes.view"],
};

export function roleHas(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as StaffRole];
  return Array.isArray(perms) && perms.includes(permission);
}
