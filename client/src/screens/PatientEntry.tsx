// Patient Entry (Ctrl+R). Follows the PT ENTRY tab and the old "Register New Patient" screen.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import type { Insurance, Payer } from "@/lib/types";
import { DateInput, ErrorBox, Field, MoneyInput, Select, TextInput } from "@/components/inputs";
import { MARITAL_STATUSES, PAYER_TYPES, RELATIONSHIPS, SEXES, US_STATES } from "@shared/picklists";
import { ageOn, todayIso, isoToDisplay } from "@shared/dates";
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

export function PatientEntry({ patientId, onSaved }: { patientId?: number; onSaved: (id: number, label: string) => void }) {
  const qc = useQueryClient();
  const { can } = useSession();
  const [form, setForm] = useState<Form>(empty);
  const [ssnMasked, setSsnMasked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
    }
  }, [existing.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Spec: subscriber fills in automatically once "Relationship to Insured" is chosen. "Self" copies the patient.
  const syncSelf = (ins: Form["insurances"][number], f: Form) =>
    ins.relationshipToInsured === "18"
      ? { ...ins, subscriberLastName: f.lastName, subscriberFirstName: f.firstName, subscriberDob: f.dob, subscriberSex: f.sex }
      : ins;
  useEffect(() => {
    setForm((f) => ({ ...f, insurances: f.insurances.map((i) => syncSelf(i, f)) }));
  }, [form.lastName, form.firstName, form.dob, form.sex]);

  const setIns = (rank: number, patch: Partial<Form["insurances"][number]>) => {
    setSaved(false);
    setForm((f) => ({
      ...f,
      insurances: f.insurances.map((i) => (i.rank === rank ? syncSelf({ ...i, ...patch }, f) : i)),
    }));
  };
  const addIns = (rank: number) =>
    setForm((f) => ({ ...f, insurances: [...f.insurances, syncSelf({ rank, payerId: 0, relationshipToInsured: "18" }, f)].sort((a, b) => a.rank - b.rank) }));
  const removeIns = (rank: number) => setForm((f) => ({ ...f, insurances: f.insurances.filter((i) => i.rank !== rank) }));

  const save = useMutation({
    mutationFn: () => (patientId ? put<{ id: number; lastName: string; firstName: string }>(`/api/patients/${patientId}`, clean(form)) : post<{ id: number; lastName: string; firstName: string }>("/api/patients", clean(form))),
    onSuccess: (p) => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", p.id] });
      qc.invalidateQueries({ queryKey: ["ledger", p.id] });
      onSaved(p.id, `${p.lastName}, ${p.firstName}`);
    },
  });
  const reveal = useMutation({ mutationFn: () => post<{ ssn: string | null }>(`/api/patients/${patientId}/reveal-ssn`), onSuccess: (r) => setRevealed(r.ssn) });
  const remove = useMutation({
    mutationFn: () => del(`/api/patients/${patientId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      onSaved(0, "Removed");
    },
  });

  const payerType = (id: number) => payers.data?.find((p) => p.id === id)?.payerType;
  const age = useMemo(() => (form.dob ? ageOn(form.dob, todayIso()) : null), [form.dob]);
  const canEdit = patientId ? can("patient.edit") : can("patient.create");

  if (patientId && existing.isLoading) return <div className="p-6 text-slate-500">Loading…</div>;
  if (existing.error) return <div className="p-6"><ErrorBox error={existing.error} /></div>;

  return (
    <form
      className="space-y-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="no-print flex items-center gap-2">
        <button className="btn btn-primary" type="submit" disabled={!canEdit || save.isPending}>
          {save.isPending ? "Saving…" : "OK / Save"}
        </button>
        {patientId && can("patient.remove") && (
          <button
            type="button"
            className="btn"
            onClick={() => confirm("Remove this patient? (Management only. The record is hidden, not erased.)") && remove.mutate()}
          >
            Remove
          </button>
        )}
        {existing.data && (
          <span className="ml-auto text-[11px] text-slate-500">
            Acct #{existing.data.accountNumber} · entered {new Date(existing.data.createdAt).toLocaleDateString()} by {existing.data.createdBy}
            {existing.data.updatedAt && ` · modified ${new Date(existing.data.updatedAt).toLocaleDateString()} by ${existing.data.updatedBy}`}
          </span>
        )}
        {saved && <span className="text-green-700">Saved ✓</span>}
      </div>
      <ErrorBox error={save.error ?? remove.error} />

      <section className="panel">
        <div className="panel-title">Patient</div>
        <div className="grid grid-cols-12 gap-2 p-3">
          <Field label="Pt ID" className="col-span-2" hint="assigned">
            <input className="input" disabled value={existing.data?.accountNumber ?? "(new)"} />
          </Field>
          <Field label="Ext (rep)" className="col-span-1">
            <TextInput value={form.repInitials} onChange={(v) => set("repInitials", v)} maxLength={5} upper />
          </Field>
          <Field label="SSN" className="col-span-3">
            <div className="flex gap-1">
              <TextInput value={form.ssn} onChange={(v) => set("ssn", v)} maxLength={11} placeholder={revealed ?? ssnMasked ?? "000-00-0000"} />
              {patientId && ssnMasked && can("ssn.reveal") && !revealed && (
                <button type="button" className="btn" onClick={() => reveal.mutate()} title="Show full SSN (this is logged)">
                  Show
                </button>
              )}
            </div>
          </Field>
          <Field label="Alias" className="col-span-2">
            <TextInput value={form.alias} onChange={(v) => set("alias", v)} maxLength={20} upper />
          </Field>
          <Field label="Coverage type" className="col-span-2">
            <Select value={form.coverageType} onChange={(v) => set("coverageType", v)} options={PAYER_TYPES} />
          </Field>
          <Field label="Old system ID" className="col-span-2">
            <TextInput value={form.legacyId} onChange={(v) => set("legacyId", v)} maxLength={20} />
          </Field>

          <Field label="Last name" className="col-span-3">
            <TextInput value={form.lastName} onChange={(v) => set("lastName", v)} maxLength={50} upper autoFocus />
          </Field>
          <Field label="First name" className="col-span-3">
            <TextInput value={form.firstName} onChange={(v) => set("firstName", v)} maxLength={50} upper />
          </Field>
          <Field label="MI" className="col-span-1">
            <TextInput value={form.middleInitial} onChange={(v) => set("middleInitial", v)} maxLength={1} upper />
          </Field>
          <Field label="Title" className="col-span-1">
            <TextInput value={form.title} onChange={(v) => set("title", v)} maxLength={5} upper />
          </Field>
          <Field label="DOB" className="col-span-2" hint={age !== null ? `age ${age}` : undefined}>
            <DateInput value={form.dob} onChange={(v) => set("dob", v)} />
          </Field>
          <Field label="Sex" className="col-span-1">
            <Select value={form.sex} onChange={(v) => set("sex", v)} options={SEXES} />
          </Field>
          <Field label="Marital" className="col-span-1">
            <Select value={form.maritalStatus ?? ""} onChange={(v) => set("maritalStatus", v)} options={MARITAL_STATUSES.map((m) => ({ code: m, label: m }))} blank="" />
          </Field>

          <Field label="Address 1" className="col-span-4">
            <TextInput value={form.address1} onChange={(v) => set("address1", v)} maxLength={80} upper />
          </Field>
          <Field label="Address 2" className="col-span-3">
            <TextInput value={form.address2} onChange={(v) => set("address2", v)} maxLength={80} upper />
          </Field>
          <Field label="Zip" className="col-span-1">
            <TextInput value={form.zip} onChange={(v) => set("zip", v)} maxLength={10} />
          </Field>
          <Field label="City" className="col-span-2">
            <TextInput value={form.city} onChange={(v) => set("city", v)} maxLength={40} upper />
          </Field>
          <Field label="ST" className="col-span-1">
            <Select value={form.state ?? ""} onChange={(v) => set("state", v)} options={US_STATES.map((s) => ({ code: s, label: s }))} blank="" />
          </Field>
          <Field label="Country" className="col-span-1">
            <TextInput value={form.country} onChange={(v) => set("country", v)} maxLength={20} upper />
          </Field>

          <Field label="Phone" className="col-span-2">
            <TextInput value={form.phone} onChange={(v) => set("phone", v)} maxLength={20} />
          </Field>
          <Field label="Cell phone" className="col-span-2">
            <TextInput value={form.cellPhone} onChange={(v) => set("cellPhone", v)} maxLength={20} />
          </Field>
          <Field label="Email" className="col-span-3">
            <TextInput value={form.email} onChange={(v) => set("email", v)} maxLength={80} />
          </Field>
          <Field label="Employer" className="col-span-3">
            <TextInput value={form.employer} onChange={(v) => set("employer", v)} maxLength={60} upper />
          </Field>
          <Field label="Language" className="col-span-1">
            <TextInput value={form.language} onChange={(v) => set("language", v)} maxLength={20} />
          </Field>
          <Field label="Deceased" className="col-span-1">
            <select className="input" value={form.deceased ? "Y" : "N"} onChange={(e) => set("deceased", e.target.value === "Y")}>
              <option value="N">N</option>
              <option value="Y">Y</option>
            </select>
          </Field>
          <Field label="Referring physician" className="col-span-4">
            <TextInput value={form.referringPhysician} onChange={(v) => set("referringPhysician", v)} maxLength={60} upper />
          </Field>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <section className="panel">
          <div className="panel-title">Responsible party</div>
          <div className="grid grid-cols-6 gap-2 p-3">
            <Field label="Relationship" className="col-span-2">
              <TextInput value={form.respRelationship} onChange={(v) => set("respRelationship", v)} maxLength={20} upper />
            </Field>
            <Field label="Last" className="col-span-2">
              <TextInput value={form.respLastName} onChange={(v) => set("respLastName", v)} maxLength={50} upper />
            </Field>
            <Field label="First" className="col-span-2">
              <TextInput value={form.respFirstName} onChange={(v) => set("respFirstName", v)} maxLength={50} upper />
            </Field>
            <Field label="Phone" className="col-span-2">
              <TextInput value={form.respPhone} onChange={(v) => set("respPhone", v)} maxLength={20} />
            </Field>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">Nearest relative</div>
          <div className="grid grid-cols-6 gap-2 p-3">
            <Field label="Name" className="col-span-3">
              <TextInput value={form.relativeName} onChange={(v) => set("relativeName", v)} maxLength={60} upper />
            </Field>
            <Field label="Relationship" className="col-span-3">
              <TextInput value={form.relativeRelationship} onChange={(v) => set("relativeRelationship", v)} maxLength={20} upper />
            </Field>
            <Field label="Phone" className="col-span-2">
              <TextInput value={form.relativePhone} onChange={(v) => set("relativePhone", v)} maxLength={20} />
            </Field>
          </div>
        </section>
      </div>

      {[1, 2, 3].map((rank) => {
        const ins = form.insurances.find((i) => i.rank === rank);
        const title = ["Primary", "Secondary", "Tertiary"][rank - 1];
        if (!ins)
          return (
            <button key={rank} type="button" className="btn" disabled={rank > 1 && !form.insurances.find((i) => i.rank === rank - 1)} onClick={() => addIns(rank)}>
              + Add {title.toLowerCase()} insurance
            </button>
          );
        const type = payerType(ins.payerId);
        const self = ins.relationshipToInsured === "18";
        return (
          <section key={rank} className="panel">
            <div className="panel-title flex items-center justify-between">
              <span>{title} insurance & subscriber</span>
              <button type="button" className="text-red-700 normal-case" onClick={() => removeIns(rank)}>
                remove
              </button>
            </div>
            <div className="grid grid-cols-12 gap-2 p-3">
              <Field label="Carrier" className="col-span-4">
                <select className="input" value={ins.payerId || ""} onChange={(e) => setIns(rank, { payerId: Number(e.target.value) })}>
                  <option value="">Pick a payer…</option>
                  {payers.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.payerType})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Claim #" className="col-span-2">
                <TextInput value={ins.claimNumber} onChange={(v) => setIns(rank, { claimNumber: v })} maxLength={30} upper />
              </Field>
              <Field label="Copay" className="col-span-1">
                <MoneyInput cents={ins.copayCents} onChange={(v) => setIns(rank, { copayCents: v })} />
              </Field>
              <Field label="Ded" className="col-span-1">
                <MoneyInput cents={ins.deductibleCents} onChange={(v) => setIns(rank, { deductibleCents: v })} />
              </Field>
              <Field label="Elig from" className="col-span-2">
                <DateInput value={ins.eligibleFrom} onChange={(v) => setIns(rank, { eligibleFrom: v })} />
              </Field>
              <Field label="Elig to" className="col-span-2">
                <DateInput value={ins.eligibleTo} onChange={(v) => setIns(rank, { eligibleTo: v })} />
              </Field>

              <Field label="Pat relationship to insured" className="col-span-3">
                <Select value={ins.relationshipToInsured} onChange={(v) => setIns(rank, { relationshipToInsured: v })} options={RELATIONSHIPS} />
              </Field>
              <Field label="Subscriber last" className="col-span-2">
                <TextInput value={ins.subscriberLastName} onChange={(v) => setIns(rank, { subscriberLastName: v })} disabled={self} className={self ? "input-auto" : ""} upper />
              </Field>
              <Field label="Subscriber first" className="col-span-2">
                <TextInput value={ins.subscriberFirstName} onChange={(v) => setIns(rank, { subscriberFirstName: v })} disabled={self} className={self ? "input-auto" : ""} upper />
              </Field>
              <Field label="Sub. DOB" className="col-span-2">
                <DateInput value={ins.subscriberDob} onChange={(v) => setIns(rank, { subscriberDob: v })} disabled={self} />
              </Field>
              <Field label="Sex" className="col-span-1">
                <Select value={ins.subscriberSex ?? ""} onChange={(v) => setIns(rank, { subscriberSex: v })} options={SEXES} disabled={self} blank="" />
              </Field>
              <Field label="Primary ID / member ID" className="col-span-2">
                <TextInput value={ins.memberId} onChange={(v) => setIns(rank, { memberId: v })} maxLength={30} placeholder={ins.memberIdMasked ?? ""} upper />
              </Field>
              <Field label="Group / policy #" className="col-span-2">
                <TextInput value={ins.groupNumber} onChange={(v) => setIns(rank, { groupNumber: v })} maxLength={30} upper />
              </Field>
              <Field label="Group / plan name" className="col-span-3">
                <TextInput value={ins.groupName} onChange={(v) => setIns(rank, { groupName: v })} maxLength={60} upper />
              </Field>

              {type === "WC" && (
                <>
                  <Field label="Date of injury" className="col-span-2">
                    <DateInput value={ins.dateOfInjury} onChange={(v) => setIns(rank, { dateOfInjury: v })} />
                  </Field>
                  <Field label="Employer (WC)" className="col-span-3">
                    <TextInput value={ins.employerName} onChange={(v) => setIns(rank, { employerName: v })} maxLength={60} upper />
                  </Field>
                  <Field label="Adjuster" className="col-span-2">
                    <TextInput value={ins.adjusterName} onChange={(v) => setIns(rank, { adjusterName: v })} maxLength={60} upper />
                  </Field>
                  <Field label="Adjuster phone" className="col-span-2">
                    <TextInput value={ins.adjusterPhone} onChange={(v) => setIns(rank, { adjusterPhone: v })} maxLength={20} />
                  </Field>
                </>
              )}
              {(type === "VA_DIRECT" || type === "VA_CCN") && (
                <>
                  <Field label="VA referral #" className="col-span-3">
                    <TextInput value={ins.referralNumber} onChange={(v) => setIns(rank, { referralNumber: v })} maxLength={30} upper />
                  </Field>
                  <Field label="Authorization #" className="col-span-3">
                    <TextInput value={ins.authorizationNumber} onChange={(v) => setIns(rank, { authorizationNumber: v })} maxLength={30} upper />
                  </Field>
                </>
              )}
              {ins.eligibleTo && <div className="col-span-12 text-[11px] text-slate-500">Eligible through {isoToDisplay(ins.eligibleTo)}</div>}
            </div>
          </section>
        );
      })}
    </form>
  );
}
