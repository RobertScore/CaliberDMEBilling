// Register or edit a patient. Follows the PT ENTRY tab / old "Register New Patient" screen, reorganized so the
// essentials come first and the rarely used fields sit under "More details".
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, Plus, ShieldCheck, Trash2, UserRound, MapPin, Lock } from "lucide-react";
import { get, post, put, del } from "@/lib/api";
import type { Insurance, Payer } from "@/lib/types";
import { DateInput, ErrorBox, Field, MoneyInput, Segmented, Select, TextInput } from "@/components/inputs";
import { CoverageBadge, useToast } from "@/components/ui";
import { MARITAL_STATUSES, PAYER_TYPES, RELATIONSHIPS, SEXES, US_STATES } from "@shared/picklists";
import { ageOn, todayIso } from "@shared/dates";
import { useSession } from "@/lib/session";

type Form = {
  repInitials?: string; ssn?: string; alias?: string; lastName: string; firstName: string; middleInitial?: string; title?: string;
  dob?: string; sex: string; maritalStatus?: string; address1?: string; address2?: string; zip?: string; city?: string; state?: string;
  country?: string; phone?: string; cellPhone?: string; email?: string; employer?: string; occupation?: string; language?: string;
  deceased: boolean; respRelationship?: string; respLastName?: string; respFirstName?: string; respPhone?: string;
  relativeName?: string; relativeRelationship?: string; relativePhone?: string; referringPhysician?: string; legacyId?: string;
  coverageType: string; insurances: (Insurance & { memberId?: string })[];
};

const empty: Form = { lastName: "", firstName: "", sex: "U", deceased: false, coverageType: "WC", country: "USA", insurances: [] };

const PATIENT_KEYS = [
  "repInitials", "ssn", "alias", "lastName", "firstName", "middleInitial", "title", "dob", "sex", "maritalStatus", "address1",
  "address2", "zip", "city", "state", "country", "phone", "cellPhone", "email", "employer", "occupation", "language", "deceased",
  "respRelationship", "respLastName", "respFirstName", "respPhone", "relativeName", "relativeRelationship", "relativePhone",
  "referringPhysician", "legacyId", "coverageType",
] as const;
const INSURANCE_KEYS = [
  "rank", "payerId", "claimNumber", "copayCents", "deductibleCents", "eligibleFrom", "eligibleTo", "relationshipToInsured",
  "subscriberLastName", "subscriberFirstName", "subscriberDob", "subscriberSex", "memberId", "groupNumber", "groupName",
  "dateOfInjury", "employerName", "adjusterName", "adjusterPhone", "referralNumber", "authorizationNumber",
] as const;

/** Send only the form's own fields, and only filled-in values. The server re-validates everything. */
function clean(form: Form) {
  const pick = (o: Record<string, unknown>, keys: readonly string[]) =>
    Object.fromEntries(keys.map((k) => [k, o[k]]).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  return {
    ...pick(form as unknown as Record<string, unknown>, PATIENT_KEYS),
    insurances: form.insurances.map((i) => pick(i as unknown as Record<string, unknown>, INSURANCE_KEYS)),
  };
}

function Section({ icon, title, subtitle, children, right }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">{icon}</span>
        <div className="flex-1">
          <div className="font-semibold text-slate-900">{title}</div>
          {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function PatientForm({ patientId, onSaved, onCancel }: { patientId?: number; onSaved: (id: number, label: string) => void; onCancel?: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useSession();
  const [form, setForm] = useState<Form>(empty);
  const [ssnMasked, setSsnMasked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [dirty, setDirty] = useState(false);
  const payers = useQuery({ queryKey: ["payers"], queryFn: () => get<Payer[]>("/api/payers") });
  const existing = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => get<Form & { ssnMasked: string | null; accountNumber: string; createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null }>(`/api/patients/${patientId}`),
    enabled: !!patientId,
  });

  useEffect(() => {
    if (existing.data) {
      const { ssnMasked: m, ...rest } = existing.data;
      setForm({ ...empty, ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ?? undefined])), insurances: existing.data.insurances } as Form);
      setSsnMasked(m);
      setDirty(false);
    }
  }, [existing.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Spec: subscriber fills in automatically once "Relationship to Insured" is chosen. "Self" copies the patient.
  const syncSelf = (ins: Form["insurances"][number], f: Form) =>
    ins.relationshipToInsured === "18" ? { ...ins, subscriberLastName: f.lastName, subscriberFirstName: f.firstName, subscriberDob: f.dob, subscriberSex: f.sex } : ins;
  useEffect(() => {
    setForm((f) => ({ ...f, insurances: f.insurances.map((i) => syncSelf(i, f)) }));
  }, [form.lastName, form.firstName, form.dob, form.sex]);

  const setIns = (rank: number, patch: Partial<Form["insurances"][number]>) => {
    setDirty(true);
    setForm((f) => ({ ...f, insurances: f.insurances.map((i) => (i.rank === rank ? syncSelf({ ...i, ...patch }, f) : i)) }));
  };
  const addIns = () =>
    setForm((f) => {
      const rank = [1, 2, 3].find((r) => !f.insurances.some((i) => i.rank === r)) ?? 3;
      setDirty(true);
      return { ...f, insurances: [...f.insurances, syncSelf({ rank, payerId: 0, relationshipToInsured: "18" }, f)].sort((a, b) => a.rank - b.rank) };
    });
  const removeIns = (rank: number) => { setDirty(true); setForm((f) => ({ ...f, insurances: f.insurances.filter((i) => i.rank !== rank) })); };

  const save = useMutation({
    mutationFn: () => (patientId ? put<{ id: number; lastName: string; firstName: string }>(`/api/patients/${patientId}`, clean(form)) : post<{ id: number; lastName: string; firstName: string }>("/api/patients", clean(form))),
    onSuccess: (p) => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", p.id] });
      qc.invalidateQueries({ queryKey: ["ledger", p.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast(patientId ? "Patient details saved." : `${p.lastName}, ${p.firstName} is registered.`);
      onSaved(p.id, `${p.lastName}, ${p.firstName}`);
    },
  });
  const reveal = useMutation({ mutationFn: () => post<{ ssn: string | null }>(`/api/patients/${patientId}/reveal-ssn`), onSuccess: (r) => setRevealed(r.ssn) });
  const remove = useMutation({
    mutationFn: () => del(`/api/patients/${patientId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Patient removed. The record is kept for history.");
      onSaved(0, "");
    },
  });

  const payerType = (id: number) => payers.data?.find((p) => p.id === id)?.payerType;
  const age = useMemo(() => (form.dob ? ageOn(form.dob, todayIso()) : null), [form.dob]);
  const canEdit = patientId ? can("patient.edit") : can("patient.create");
  const ready = !!form.lastName.trim() && !!form.firstName.trim() && !!form.dob && form.insurances.every((i) => i.payerId > 0);

  if (patientId && existing.isLoading) return <div className="p-6 text-slate-500">Loading…</div>;
  if (existing.error) return <ErrorBox error={existing.error} />;

  return (
    <form className="space-y-5 pb-24" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <fieldset disabled={!canEdit} className="space-y-5">
        <Section icon={<UserRound size={16} />} title="Who is the patient?" subtitle="Name, date of birth and coverage."
          right={existing.data && <span className="font-mono text-sm text-slate-500">#{existing.data.accountNumber}</span>}>
          <div className="grid grid-cols-12 gap-4">
            <Field label="Last name" required className="col-span-5"><TextInput value={form.lastName} onChange={(v) => set("lastName", v)} maxLength={50} upper autoFocus={!patientId} /></Field>
            <Field label="First name" required className="col-span-5"><TextInput value={form.firstName} onChange={(v) => set("firstName", v)} maxLength={50} upper /></Field>
            <Field label="MI" className="col-span-2"><TextInput value={form.middleInitial} onChange={(v) => set("middleInitial", v)} maxLength={1} upper /></Field>
            <Field label="Date of birth" required hint={age !== null ? `${age} years old` : "type 03151985"} className="col-span-4"><DateInput value={form.dob} onChange={(v) => set("dob", v)} /></Field>
            <Field label="Sex" className="col-span-3"><Segmented value={form.sex} onChange={(v) => set("sex", v)} options={SEXES} /></Field>
            <Field label="Coverage type" className="col-span-5"><Select value={form.coverageType} onChange={(v) => set("coverageType", v)} options={PAYER_TYPES} /></Field>
            <Field label="SSN" className="col-span-4" hint={patientId && ssnMasked ? "stored encrypted" : undefined}>
              <div className="flex gap-2">
                <TextInput value={form.ssn} onChange={(v) => set("ssn", v)} maxLength={11} placeholder={revealed ?? ssnMasked ?? "000-00-0000"} />
                {patientId && ssnMasked && can("ssn.reveal") && !revealed && (
                  <button type="button" className="btn shrink-0 px-3" onClick={() => reveal.mutate()} title="Show the full SSN (this is logged)"><Eye size={16} /></button>
                )}
              </div>
            </Field>
          </div>
        </Section>

        <Section icon={<MapPin size={16} />} title="How do we reach them?">
          <div className="grid grid-cols-12 gap-4">
            <Field label="Street address" className="col-span-8"><TextInput value={form.address1} onChange={(v) => set("address1", v)} maxLength={80} upper /></Field>
            <Field label="Apt / suite" className="col-span-4"><TextInput value={form.address2} onChange={(v) => set("address2", v)} maxLength={80} upper /></Field>
            <Field label="City" className="col-span-5"><TextInput value={form.city} onChange={(v) => set("city", v)} maxLength={40} upper /></Field>
            <Field label="State" className="col-span-3"><Select value={form.state ?? ""} onChange={(v) => set("state", v)} options={US_STATES.map((s) => ({ code: s, label: s }))} blank="—" /></Field>
            <Field label="Zip" className="col-span-4"><TextInput value={form.zip} onChange={(v) => set("zip", v)} maxLength={10} /></Field>
            <Field label="Phone" className="col-span-4"><TextInput value={form.phone} onChange={(v) => set("phone", v)} maxLength={20} /></Field>
            <Field label="Cell phone" className="col-span-4"><TextInput value={form.cellPhone} onChange={(v) => set("cellPhone", v)} maxLength={20} /></Field>
            <Field label="Email" className="col-span-4"><TextInput value={form.email} onChange={(v) => set("email", v)} maxLength={80} /></Field>
          </div>
        </Section>

        <Section icon={<ShieldCheck size={16} />} title="Insurance" subtitle="Who pays. Work Comp and VA details appear once you pick the payer."
          right={form.insurances.length < 3 && <button type="button" className="btn btn-sm" onClick={addIns}><Plus size={14} /> Add insurance</button>}>
          {form.insurances.length === 0 && (
            <button type="button" onClick={addIns} className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 py-8 text-slate-500 hover:border-navy-300 hover:text-navy-700">
              <Plus size={20} /> <span className="text-sm font-medium">Add the primary insurance</span>
            </button>
          )}
          <div className="space-y-4">
            {form.insurances.map((ins) => {
              const type = payerType(ins.payerId);
              const self = ins.relationshipToInsured === "18";
              return (
                <div key={ins.rank} className="rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{["Primary", "Secondary", "Tertiary"][ins.rank - 1]}</span>
                    {type && <CoverageBadge type={type} />}
                    <button type="button" className="ml-auto rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeIns(ins.rank)} aria-label="Remove insurance"><Trash2 size={15} /></button>
                  </div>
                  <div className="grid grid-cols-12 gap-4 p-4">
                    <Field label="Payer" required className="col-span-6">
                      <select className="input" value={ins.payerId || ""} onChange={(e) => setIns(ins.rank, { payerId: Number(e.target.value) })}>
                        <option value="">Pick a payer…</option>
                        {payers.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Claim #" className="col-span-3"><TextInput value={ins.claimNumber} onChange={(v) => setIns(ins.rank, { claimNumber: v })} maxLength={30} upper /></Field>
                    <Field label="Member / primary ID" className="col-span-3"><TextInput value={ins.memberId} onChange={(v) => setIns(ins.rank, { memberId: v })} maxLength={30} placeholder={ins.memberIdMasked ?? ""} upper /></Field>

                    {type === "WC" && (
                      <div className="col-span-12 grid grid-cols-12 gap-4 rounded-lg bg-amber-50/60 p-4 ring-1 ring-inset ring-amber-100">
                        <div className="col-span-12 text-xs font-semibold text-amber-800">Work Comp details</div>
                        <Field label="Date of injury" className="col-span-3"><DateInput value={ins.dateOfInjury} onChange={(v) => setIns(ins.rank, { dateOfInjury: v })} /></Field>
                        <Field label="Employer" className="col-span-3"><TextInput value={ins.employerName} onChange={(v) => setIns(ins.rank, { employerName: v })} maxLength={60} upper /></Field>
                        <Field label="Adjuster" className="col-span-3"><TextInput value={ins.adjusterName} onChange={(v) => setIns(ins.rank, { adjusterName: v })} maxLength={60} upper /></Field>
                        <Field label="Adjuster phone" className="col-span-3"><TextInput value={ins.adjusterPhone} onChange={(v) => setIns(ins.rank, { adjusterPhone: v })} maxLength={20} /></Field>
                      </div>
                    )}
                    {(type === "VA_DIRECT" || type === "VA_CCN") && (
                      <div className="col-span-12 grid grid-cols-12 gap-4 rounded-lg bg-sky-50/60 p-4 ring-1 ring-inset ring-sky-100">
                        <div className="col-span-12 text-xs font-semibold text-sky-800">VA details</div>
                        <Field label="Referral #" className="col-span-6"><TextInput value={ins.referralNumber} onChange={(v) => setIns(ins.rank, { referralNumber: v })} maxLength={30} upper /></Field>
                        <Field label="Authorization #" className="col-span-6"><TextInput value={ins.authorizationNumber} onChange={(v) => setIns(ins.rank, { authorizationNumber: v })} maxLength={30} upper /></Field>
                      </div>
                    )}

                    <Field label="Patient's relationship to the insured" className="col-span-5">
                      <Select value={ins.relationshipToInsured} onChange={(v) => setIns(ins.rank, { relationshipToInsured: v })} options={RELATIONSHIPS} />
                    </Field>
                    <div className="col-span-7 flex items-end text-xs text-slate-500">{self && "Subscriber details are copied from the patient automatically."}</div>
                    {!self && (
                      <>
                        <Field label="Subscriber last name" className="col-span-4"><TextInput value={ins.subscriberLastName} onChange={(v) => setIns(ins.rank, { subscriberLastName: v })} upper /></Field>
                        <Field label="Subscriber first name" className="col-span-4"><TextInput value={ins.subscriberFirstName} onChange={(v) => setIns(ins.rank, { subscriberFirstName: v })} upper /></Field>
                        <Field label="Subscriber DOB" className="col-span-4"><DateInput value={ins.subscriberDob} onChange={(v) => setIns(ins.rank, { subscriberDob: v })} /></Field>
                      </>
                    )}
                    <Field label="Group / policy #" className="col-span-3"><TextInput value={ins.groupNumber} onChange={(v) => setIns(ins.rank, { groupNumber: v })} maxLength={30} upper /></Field>
                    <Field label="Group / plan name" className="col-span-3"><TextInput value={ins.groupName} onChange={(v) => setIns(ins.rank, { groupName: v })} maxLength={60} upper /></Field>
                    <Field label="Eligible from" className="col-span-3"><DateInput value={ins.eligibleFrom} onChange={(v) => setIns(ins.rank, { eligibleFrom: v })} /></Field>
                    <Field label="Eligible to" className="col-span-3"><DateInput value={ins.eligibleTo} onChange={(v) => setIns(ins.rank, { eligibleTo: v })} /></Field>
                    <Field label="Copay" className="col-span-3"><MoneyInput cents={ins.copayCents} onChange={(v) => setIns(ins.rank, { copayCents: v })} /></Field>
                    <Field label="Deductible" className="col-span-3"><MoneyInput cents={ins.deductibleCents} onChange={(v) => setIns(ins.rank, { deductibleCents: v })} /></Field>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <section className="card">
          <button type="button" className="flex w-full items-center gap-3 px-6 py-4 text-left" onClick={() => setMore((m) => !m)}>
            <ChevronDown size={18} className={`text-slate-400 transition ${more ? "rotate-180" : ""}`} />
            <div>
              <div className="font-semibold text-slate-900">More details</div>
              <div className="text-sm text-slate-500">Alias, employer, responsible party, nearest relative, referring physician and other fields from the old system.</div>
            </div>
          </button>
          {more && (
            <div className="grid grid-cols-12 gap-4 border-t border-slate-100 p-6">
              <Field label="Alias" className="col-span-3"><TextInput value={form.alias} onChange={(v) => set("alias", v)} maxLength={20} upper /></Field>
              <Field label="Title" className="col-span-2"><TextInput value={form.title} onChange={(v) => set("title", v)} maxLength={5} upper /></Field>
              <Field label="Marital status" className="col-span-3"><Select value={form.maritalStatus ?? ""} onChange={(v) => set("maritalStatus", v)} options={MARITAL_STATUSES.map((m) => ({ code: m, label: m }))} blank="—" /></Field>
              <Field label="Language" className="col-span-2"><TextInput value={form.language} onChange={(v) => set("language", v)} maxLength={20} /></Field>
              <Field label="Rep initials" className="col-span-2"><TextInput value={form.repInitials} onChange={(v) => set("repInitials", v)} maxLength={5} upper /></Field>
              <Field label="Employer" className="col-span-4"><TextInput value={form.employer} onChange={(v) => set("employer", v)} maxLength={60} upper /></Field>
              <Field label="Occupation" className="col-span-4"><TextInput value={form.occupation} onChange={(v) => set("occupation", v)} maxLength={40} upper /></Field>
              <Field label="Referring physician" className="col-span-4"><TextInput value={form.referringPhysician} onChange={(v) => set("referringPhysician", v)} maxLength={60} upper /></Field>
              <div className="col-span-12 mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Responsible party</div>
              <Field label="Relationship" className="col-span-3"><TextInput value={form.respRelationship} onChange={(v) => set("respRelationship", v)} maxLength={20} upper /></Field>
              <Field label="Last name" className="col-span-3"><TextInput value={form.respLastName} onChange={(v) => set("respLastName", v)} maxLength={50} upper /></Field>
              <Field label="First name" className="col-span-3"><TextInput value={form.respFirstName} onChange={(v) => set("respFirstName", v)} maxLength={50} upper /></Field>
              <Field label="Phone" className="col-span-3"><TextInput value={form.respPhone} onChange={(v) => set("respPhone", v)} maxLength={20} /></Field>
              <div className="col-span-12 mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Nearest relative</div>
              <Field label="Name" className="col-span-5"><TextInput value={form.relativeName} onChange={(v) => set("relativeName", v)} maxLength={60} upper /></Field>
              <Field label="Relationship" className="col-span-4"><TextInput value={form.relativeRelationship} onChange={(v) => set("relativeRelationship", v)} maxLength={20} upper /></Field>
              <Field label="Phone" className="col-span-3"><TextInput value={form.relativePhone} onChange={(v) => set("relativePhone", v)} maxLength={20} /></Field>
              <Field label="ID in the old system" className="col-span-4"><TextInput value={form.legacyId} onChange={(v) => set("legacyId", v)} maxLength={20} /></Field>
              <Field label="Deceased" className="col-span-3"><Segmented value={form.deceased ? "Y" : "N"} onChange={(v) => set("deceased", v === "Y")} options={[{ code: "N", label: "No" }, { code: "Y", label: "Yes" }]} /></Field>
            </div>
          )}
        </section>
      </fieldset>

      {existing.data && (
        <div className="text-xs text-slate-400">
          Entered {new Date(existing.data.createdAt).toLocaleDateString()} by {existing.data.createdBy}
          {existing.data.updatedAt && ` · last changed ${new Date(existing.data.updatedAt).toLocaleDateString()} by ${existing.data.updatedBy}`}
        </div>
      )}

      {/* Sticky action bar */}
      {canEdit && (
        <div className="fixed bottom-0 left-64 right-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-8 py-3">
            {patientId && can("patient.remove") && (
              <button type="button" className="btn btn-ghost text-red-600 hover:bg-red-50" onClick={() => confirm("Remove this patient? Only management can do this. The record is hidden, not erased.") && remove.mutate()}>
                <Lock size={14} /> Remove patient
              </button>
            )}
            <div className="flex-1"><ErrorBox error={save.error ?? remove.error} /></div>
            {!ready && <span className="text-xs text-slate-400">Name, date of birth and a payer for each insurance are required.</span>}
            {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
            <button type="submit" className="btn btn-primary h-11 px-6" disabled={!ready || save.isPending || (!!patientId && !dirty)}>
              {save.isPending ? "Saving…" : patientId ? (dirty ? "Save changes" : "Saved") : "Register patient"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
