export interface SessionInfo {
  user: { id: number; email: string; name: string; initials: string; role: string; roleLabel: string; userType: string; mustChangePassword: boolean; portalPatientId: number | null };
  permissions: string[];
  viewAs: { realName: string; reason: string } | null;
  aiReader: "on" | "off";
  aiReaderNote: string;
  clients: { id: number; name: string }[];
  activeClient: { id: number; name: string } | null;
}

export interface PatientSummary {
  id: number;
  accountNumber: string;
  lastName: string;
  firstName: string;
  dob: string;
  coverageType: string;
  balanceCents?: number;
}

export interface Dashboard {
  patientCount: number;
  claimsNotBilled: number;
  insuranceOwedCents: number;
  patientOwedCents: number;
  entriesPostedToday: number;
  recent: (PatientSummary & { balanceCents: number; lastActivity: string })[];
  closedThrough: string | null;
}

export interface Insurance {
  id?: number;
  rank: number;
  payerId: number;
  payerName?: string;
  payerType?: string;
  claimNumber?: string | null;
  copayCents?: number | null;
  deductibleCents?: number | null;
  eligibleFrom?: string | null;
  eligibleTo?: string | null;
  relationshipToInsured: string;
  subscriberLastName?: string | null;
  subscriberFirstName?: string | null;
  subscriberDob?: string | null;
  subscriberSex?: string | null;
  memberIdMasked?: string | null;
  groupNumber?: string | null;
  groupName?: string | null;
  dateOfInjury?: string | null;
  employerName?: string | null;
  adjusterName?: string | null;
  adjusterPhone?: string | null;
  referralNumber?: string | null;
  authorizationNumber?: string | null;
}

export interface Payer { id: number; name: string; payerType: string; state: string | null }
export interface Code { code: string; shortDescription?: string; description?: string; source: string }

export interface LedgerEntry {
  id: number;
  kind: string;
  postDate: string;
  serviceDateFrom: string | null;
  serviceDateTo: string | null;
  depositDate: string | null;
  code: string | null;
  description: string;
  quantity: number | null;
  insuranceDeltaCents: number;
  patientDeltaCents: number;
  payerName: string | null;
  checkNumber: string | null;
  reasonCode: string | null;
  reversesEntryId: number | null;
  reversed: boolean;
  encounterId: number | null;
  createdAt: string;
  createdBy: string;
}

export interface Encounter {
  id: number;
  serviceDateFrom: string;
  serviceDateTo: string;
  diagnosisCodes: string[];
  claimStatus: string;
  insuranceRank: number;
  createdAt: string;
  createdBy: string;
  lines: { id: number; lineNumber: number; hcpcsCode: string; modifiers: string[]; description: string; diagnosisPointers: string; quantity: number; unitPriceCents: number; chargeCents: number }[];
}

export interface LedgerView {
  patient: PatientSummary;
  insurances: { rank: number; payerName: string; payerType: string; claimNumber: string | null; memberIdMasked: string | null }[];
  encounters: Encounter[];
  entries: LedgerEntry[];
  balances: { insuranceBalanceCents: number; patientBalanceCents: number; totalBalanceCents: number };
  summary: { aging: Record<string, number>; totalsByKind: Record<string, number> };
  closedThrough: string | null;
}

export interface Doc {
  id: number;
  patientId: number | null;
  intakeId: number | null;
  docType: string;
  typeLabel: string;
  title: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  source: string;
  receivedAt: string;
  uploadedBy: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface Checklist {
  items: { docType: string; label: string; status: "verified" | "received" | "missing"; documentId: number | null; neededFor: string[] }[];
  complete: boolean;
  missingCount: number;
  unverifiedCount: number;
}

export interface Note { id: number; body: string; category: string; followUpDate: string | null; createdAt: string; createdBy: string }
export interface Task { id: number; patientId: number | null; title: string; dueDate: string; status: string; assignedInitials: string | null; createdBy: string; patientName?: string | null; accountNumber?: string | null; balanceCents?: number; overdue?: boolean; dueToday?: boolean }

export type TimelineItem =
  | { at: string; type: "note"; category: string; text: string; by: string; followUpDate: string | null }
  | { at: string; type: "money"; kind: string; text: string; amountCents: number; code: string | null; by: string; reversal: boolean }
  | { at: string; type: "claim"; text: string; by: string }
  | { at: string; type: "document"; text: string; documentId: number; verified: boolean; by: string };

export interface Overview {
  patient: PatientSummary & {
    middleInitial: string | null; sex: string; phone: string | null; cellPhone: string | null; email: string | null; address1: string | null; city: string | null; state: string | null; zip: string | null;
    employer: string | null; referringPhysician: string | null; ssnMasked: string | null; createdAt: string; createdBy: string;
    insurances: (Insurance & { id: number; memberIdMasked: string | null })[];
  };
  balances: { insuranceCents: number; patientCents: number; totalCents: number };
  aging: Record<string, number>;
  claims: { id: number; serviceDateFrom: string; serviceDateTo: string; status: string; insuranceRank: number; payerName: string | null; billedCents: number; paidCents: number; balanceCents: number; codes: string[] }[];
  lastPayment: { date: string; amountCents: number; payerName: string | null; checkNumber: string | null } | null;
  checklist: Checklist;
  alerts: { id: number; body: string; createdAt: string; createdBy: string }[];
  tasks: Task[];
  notes: Note[];
  timeline: TimelineItem[];
}

export interface Template { id: number; name: string; category: string; body: string; followUpDays: number | null; active: boolean; sortOrder: number }
export interface ListItem { id: number; list: string; code: string; label: string; active: boolean; sortOrder: number }
