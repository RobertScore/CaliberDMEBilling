export interface SessionInfo {
  user: { id: number; email: string; name: string; initials: string; role: string; roleLabel: string; userType: string };
  permissions: string[];
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
