// Drop-down lists taken from the spec (PAYMENT POSTING tab and the old system).
// ASSUMPTION Q-048: carried over in full; managers will be able to hide unused ones later.

export const PAT_SHARE_TYPES = [
  { code: "1", label: "CO-INSURANCE" },
  { code: "2", label: "CO-PAYMENT" },
  { code: "3", label: "DEDUCTIBLE" },
  { code: "4", label: "DENIED" },
  { code: "5", label: "NON-COVERED SERVICE" },
  { code: "6", label: "PAT RESPONSIBILITY" },
  { code: "7", label: "NO INSURANCE COVERAGE" },
] as const;

export const WRITEOFF_TYPES = [
  { code: "1", label: "PRIVATE INS WRITEOFF" },
  { code: "2", label: "MEDICARE WRITEOFF" },
  { code: "3", label: "MEDICAID WRITEOFF" },
  { code: "4", label: "MEDI/MEDI WRITEOFF" },
  { code: "5", label: "WORKERS COMP WRITEOFF" },
  { code: "6", label: "CASH ADJUSTMENT" },
  { code: "7", label: "COURTESY DISCOUNT" },
  { code: "8", label: "BAD DEBT WRITEOFF" },
  { code: "9", label: "PPO WRITEOFF" },
  { code: "A", label: "HMO WRITEOFF" },
  { code: "B", label: "HMO WITHHOLD" },
  { code: "C", label: "CHARGE REVERSAL" },
  { code: "D", label: "OTHER WRITEOFF" },
  { code: "E", label: "DENIED WRITEOFF" },
  { code: "F", label: "VSP WRITEOFF" },
  { code: "G", label: "PI WRITEOFF" },
  { code: "H", label: "CHAMPUS WRITEOFF" },
  { code: "I", label: "MEDICARE FFS WRITEOFF" },
  { code: "J", label: "COLLECTION FEE WRITEOFF" },
  { code: "K", label: "MEDICARE 2% WRITEOFF" },
  { code: "L", label: "OFFICE COLLECTIONS" },
  { code: "M", label: "LESS THAN $5" },
  { code: "N", label: "INSURANCE DISALLOWANCE" },
  { code: "O", label: "ADMINISTRATIVE ADJUSTMENT" },
  { code: "P", label: "CREDIT CARD WRITEOFF" },
] as const;

export const PAYMENT_TYPES = ["CHECK", "EFT", "CREDIT CARD", "CASH", "VCC"] as const;

export const PAYER_TYPES = [
  { code: "WC", label: "Workers' Comp" },
  { code: "VA_DIRECT", label: "VA (direct)" },
  { code: "VA_CCN", label: "VA Community Care (CCN)" },
  { code: "MEDICARE", label: "Medicare" },
  { code: "MEDICAID", label: "Medicaid" },
  { code: "COMMERCIAL", label: "Commercial" },
  { code: "SELF_PAY", label: "Self-pay" },
] as const;
export type PayerType = (typeof PAYER_TYPES)[number]["code"];

/** Payer types where the patient generally can't be billed. ASSUMPTION Q-012 / Q-046. */
export const NO_PATIENT_BILLING_PAYER_TYPES: PayerType[] = ["WC", "VA_DIRECT", "VA_CCN"];

export const RELATIONSHIPS = [
  { code: "18", label: "Self" },
  { code: "01", label: "Spouse" },
  { code: "19", label: "Child" },
  { code: "20", label: "Employee" },
  { code: "G8", label: "Other" },
] as const;

export const SEXES = [
  { code: "F", label: "F" },
  { code: "M", label: "M" },
  { code: "U", label: "U" },
] as const;

export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Separated", "Unknown"] as const;

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA",
  "MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
] as const;

/** Ledger entry kinds and their default colors from the spec (PT LEDGER tab). */
export const LEDGER_KINDS = {
  claim_data: { label: "Claim data", color: "#fbcfe8" },
  charge: { label: "Charge", color: "#d6b48a" },
  charge_on_claim: { label: "Charge (on claim)", color: "#fde68a" },
  claim_submission: { label: "Claim submission", color: "#ffffff" },
  payment: { label: "Payment", color: "#bbf7d0" },
  writeoff: { label: "Write-off", color: "#fecaca" },
  pat_share: { label: "Patient share", color: "#bfdbfe" },
  refund: { label: "Refund", color: "#e9d5ff" },
  adjustment: { label: "Adjustment", color: "#fed7aa" },
} as const;
export type LedgerKind = keyof typeof LEDGER_KINDS;
