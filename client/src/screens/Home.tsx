import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Receipt, Wallet, Search, FileText, Clock, ArrowRight, Users, Landmark, User, CircleDollarSign } from "lucide-react";
import { get } from "@/lib/api";
import type { Dashboard } from "@/lib/types";
import { useSession } from "@/lib/session";
import { useNav } from "@/lib/nav";
import { Page } from "@/components/Shell";
import { Avatar, CoverageBadge, EmptyState } from "@/components/ui";
import { ErrorBox, Money } from "@/components/inputs";
import { isoToDisplay } from "@shared/dates";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function ActionCard({ icon, title, body, shortcut, onClick, disabled, tone }: { icon: ReactNode; title: string; body: string; shortcut: string; onClick: () => void; disabled?: boolean; tone: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className="card group flex flex-col items-start gap-3 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-card">
      <div className="flex w-full items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
        <span className="kbd">{shortcut}</span>
      </div>
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="mt-0.5 text-sm text-slate-500">{body}</div>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-navy-700 opacity-0 transition group-hover:opacity-100">
        Start <ArrowRight size={14} />
      </span>
    </button>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Home() {
  const s = useSession();
  const nav = useNav();
  const { data, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => get<Dashboard>("/api/dashboard") });
  const first = s.user.name.replace(/^Demo /, "").split(" ")[0];

  return (
    <Page
      title={`${greeting()}, ${first}`}
      subtitle={
        <>
          You're working in <span className="font-medium text-slate-700">{s.activeClient?.name}</span>. What would you like to do?
        </>
      }
      actions={
        <button className="btn" onClick={() => nav.go({ name: "patients" })}>
          <Search size={16} /> Find a patient <span className="kbd">/</span>
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ActionCard icon={<UserPlus size={20} />} tone="bg-navy-50 text-navy-700" title="Register a patient" body="Add a new patient and their insurance." shortcut="⌃R" onClick={() => nav.go({ name: "new-patient" })} disabled={!s.can("patient.create")} />
        <ActionCard icon={<Receipt size={20} />} tone="bg-amber-50 text-amber-700" title="Post charges" body="Enter the equipment delivered and diagnoses." shortcut="⌃K" onClick={() => nav.pickPatient("Post charges for…", (id, l) => nav.openPatient(id, l, "charge"))} disabled={!s.can("charge.post")} />
        <ActionCard icon={<Wallet size={20} />} tone="bg-accent-50 text-accent-700" title="Post a payment" body="Record a check, EFT, write-off or patient share." shortcut="⌃P" onClick={() => nav.pickPatient("Post a payment for…", (id, l) => nav.openPatient(id, l, "payment"))} disabled={!s.can("payment.post")} />
        <ActionCard icon={<FileText size={20} />} tone="bg-violet-50 text-violet-700" title="Open a ledger" body="See everything that happened on an account." shortcut="⌃L" onClick={() => nav.pickPatient("Open the ledger for…", (id, l) => nav.openPatient(id, l, "activity"))} />
      </div>

      <ErrorBox error={error} />

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<Users size={16} />} label="Patients" value={data?.patientCount ?? "–"} />
        <Stat icon={<Clock size={16} />} label="Claims waiting to bill" value={data?.claimsNotBilled ?? "–"} hint="Billing claims arrives in Phase 2" />
        <Stat icon={<Landmark size={16} />} label="Insurance owes" value={data ? <Money cents={data.insuranceOwedCents} /> : "–"} />
        <Stat icon={<User size={16} />} label="Patients owe" value={data ? <Money cents={data.patientOwedCents} /> : "–"} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-head">
            <div className="card-title">Recently active accounts</div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav.go({ name: "patients" })}>
              See all <ArrowRight size={14} />
            </button>
          </div>
          {data && data.recent.length === 0 && <EmptyState icon={<Users size={20} />} title="No patients yet" body="Register the first patient to get started." />}
          <ul className="divide-y divide-slate-100">
            {data?.recent.map((p) => (
              <li key={p.id}>
                <button className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-slate-50" onClick={() => nav.openPatient(p.id, `${p.lastName}, ${p.firstName}`)}>
                  <Avatar name={`${p.lastName}, ${p.firstName}`} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{p.lastName}, {p.firstName}</div>
                    <div className="text-xs text-slate-500">#{p.accountNumber} · last activity {isoToDisplay(p.lastActivity.slice(0, 10))}</div>
                  </div>
                  <CoverageBadge type={p.coverageType} />
                  <div className="w-28 text-right">
                    <Money cents={p.balanceCents} className={p.balanceCents === 0 ? "text-slate-400" : "font-medium text-slate-900"} />
                    <div className="text-2xs text-slate-400">balance</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <div className="card-title mb-4">How a claim moves</div>
          <ol className="relative space-y-5 border-l border-slate-200 pl-6">
            {[
              { t: "Register the patient", b: "Demographics and insurance, including Work Comp or VA details.", ready: true },
              { t: "Post charges", b: "HCPCS items, modifiers and diagnoses for the dates of service.", ready: true },
              { t: "Bill the claim", b: "Electronic 837P or paper CMS-1500.", ready: false },
              { t: "Post payments", b: "Checks, write-offs and patient share until the balance is zero.", ready: true },
            ].map((step, i) => (
              <li key={step.t} className="relative">
                <span className={`absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full text-2xs font-semibold ring-4 ring-white ${step.ready ? "bg-navy-800 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
                <div className="text-sm font-medium text-slate-900">
                  {step.t} {!step.ready && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-normal text-slate-500">Phase 2</span>}
                </div>
                <div className="text-xs text-slate-500">{step.b}</div>
              </li>
            ))}
          </ol>
          {data?.closedThrough && (
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <CircleDollarSign size={14} /> Books closed through {isoToDisplay(data.closedThrough)}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
