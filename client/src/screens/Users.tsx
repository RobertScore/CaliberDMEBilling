// Users & access: add people, set their role and clients, reset passwords, and "View as" (read-only).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, KeyRound, Pencil, UserPlus } from "lucide-react";
import { api, get, post } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useNav } from "@/lib/nav";
import { Page } from "@/components/Shell";
import { Avatar, Badge } from "@/components/ui";
import { ErrorBox, Field, Modal } from "@/components/inputs";

type U = { id: number; email: string; name: string; initials: string; userType: string; role: string; roleLabel: string; active: boolean; mustChangePassword: boolean; clients: { id: number; name: string }[] };
type Resp = { users: U[]; assignableRoles: { code: string; label: string }[]; clients: { id: number; name: string }[] };
const TYPE: Record<string, string> = { staff: "Caliber staff", client_portal: "Client portal", patient_portal: "Patient portal" };

function TempPassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return (
    <Modal title="Temporary password" subtitle="Shown only once. Give it to the person privately; they must change it at first sign-in." onClose={onClose}>
      <div className="rounded-lg bg-slate-50 p-4 text-sm">
        <div className="text-slate-500">Email</div><div className="font-medium">{email}</div>
        <div className="mt-2 text-slate-500">Temporary password</div><div className="select-all font-mono text-lg">{password}</div>
      </div>
      <div className="mt-4 flex justify-end"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}

function UserEditor({ data, user, onClose, onCreated }: { data: Resp; user: U | null; onClose: () => void; onCreated: (email: string, pw: string) => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [initials, setInitials] = useState(user?.initials ?? "");
  const [role, setRole] = useState(user?.role ?? data.assignableRoles[0]?.code ?? "");
  const [clientIds, setClientIds] = useState<number[]>(user?.clients.map((c) => c.id) ?? []);
  const portal = ["client_admin", "client_user"].includes(role);
  const roleOptions = user && !data.assignableRoles.some((r) => r.code === user.role) ? [{ code: user.role, label: user.roleLabel }, ...data.assignableRoles] : data.assignableRoles;
  const save = useMutation({
    mutationFn: () =>
      user
        ? api("PATCH", `/api/admin/users/${user.id}`, { name, initials, ...(role !== user.role ? { role } : {}), clientIds })
        : post<{ temporaryPassword: string }>("/api/admin/users", { email, name, initials, role, clientIds }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      if (!user) onCreated(email, (r as { temporaryPassword: string }).temporaryPassword);
      onClose();
    },
  });
  return (
    <Modal title={user ? `Edit ${user.name}` : "Add a person"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email" required className="col-span-2"><input className="input" value={email} disabled={!!user} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Full name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Initials" required hint="shown on every entry they make"><input className="input uppercase" maxLength={4} value={initials} onChange={(e) => setInitials(e.target.value.toUpperCase())} /></Field>
        <Field label="Role" required className="col-span-2">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)} disabled={user?.userType === "patient_portal"}>
            {roleOptions.filter((r) => !user || (user.userType === "staff") === !["client_admin", "client_user"].includes(r.code)).map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </Field>
        <div className="col-span-2">
          <div className="label mb-1.5">{portal ? "Which client is this person from? (exactly one)" : "Which clients can they work in?"}</div>
          <div className="grid grid-cols-2 gap-2">
            {data.clients.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type={portal ? "radio" : "checkbox"} checked={clientIds.includes(c.id)} onChange={(e) => setClientIds((x) => (portal ? [c.id] : e.target.checked ? [...x, c.id] : x.filter((y) => y !== c.id)))} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3"><ErrorBox error={save.error} /></div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!name || !initials || !email || save.isPending} onClick={() => save.mutate()}>{user ? "Save" : "Add and create password"}</button>
      </div>
    </Modal>
  );
}

export function UsersScreen() {
  const s = useSession();
  const nav = useNav();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => get<Resp>("/api/admin/users") });
  const [editing, setEditing] = useState<U | "new" | null>(null);
  const [pw, setPw] = useState<{ email: string; password: string } | null>(null);
  const [viewAs, setViewAs] = useState<U | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("all");
  const toggle = useMutation({ mutationFn: (u: U) => api("PATCH", `/api/admin/users/${u.id}`, { active: !u.active }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }) });
  const reset = useMutation({ mutationFn: (u: U) => post<{ temporaryPassword: string }>(`/api/admin/users/${u.id}/reset-password`), onSuccess: (r, u) => setPw({ email: u.email, password: r.temporaryPassword }) });
  const startViewAs = useMutation({
    mutationFn: () => post("/api/session/view-as", { userId: viewAs!.id, reason }),
    onSuccess: async () => {
      nav.reset();
      qc.removeQueries({ predicate: (x) => x.queryKey[0] !== "session" });
      await qc.refetchQueries({ queryKey: ["session"] });
    },
  });
  const users = (q.data?.users ?? []).filter((u) => filter === "all" || u.userType === filter);

  return (
    <Page
      title="Users & access"
      subtitle="Who can sign in, what they can do, and which clients they can see. Each person only sees clients they're assigned to."
      actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><UserPlus size={15} /> Add a person</button>}
      width="max-w-7xl"
    >
      <div className="mb-3 flex gap-1">
        {[["all", "Everyone"], ["staff", "Caliber staff"], ["client_portal", "Client portal"], ["patient_portal", "Patient portal"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === k ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l}</button>
        ))}
      </div>
      <ErrorBox error={q.error ?? toggle.error ?? reset.error} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
            <tr><th className="px-5 py-3 font-medium">Person</th><th className="font-medium">Type</th><th className="font-medium">Role</th><th className="font-medium">Clients</th><th className="font-medium">Status</th><th className="px-5" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size={30} />
                    <div><div className="font-medium text-slate-900">{u.name} <span className="font-mono text-xs text-slate-400">{u.initials}</span></div><div className="text-xs text-slate-500">{u.email}</div></div>
                  </div>
                </td>
                <td className="text-slate-600">{TYPE[u.userType] ?? u.userType}</td>
                <td className="text-slate-700">{u.roleLabel}</td>
                <td className="max-w-[220px] text-xs text-slate-500">{u.clients.map((c) => c.name).join(", ") || "—"}</td>
                <td>{!u.active ? <Badge tone="red">Off</Badge> : u.mustChangePassword ? <Badge tone="amber">Temp password</Badge> : <Badge tone="green">Active</Badge>}</td>
                <td className="whitespace-nowrap px-5 text-right">
                  {u.id !== s.user.id && (
                    <>
                      {u.userType !== "patient_portal" && <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => setEditing(u)}><Pencil size={14} /></button>}
                      <button className="btn btn-ghost btn-sm" title="Reset password" onClick={() => reset.mutate(u)}><KeyRound size={14} /></button>
                      {s.can("users.view_as") && u.active && <button className="btn btn-ghost btn-sm" title="View as (read-only)" onClick={() => { setViewAs(u); setReason(""); }}><Eye size={14} /> View as</button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle.mutate(u)}>{u.active ? "Turn off" : "Turn on"}</button>
                    </>
                  )}
                  {u.id === s.user.id && <span className="text-xs text-slate-400">You</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && q.data && <UserEditor data={q.data} user={editing === "new" ? null : editing} onClose={() => setEditing(null)} onCreated={(email, password) => setPw({ email, password })} />}
      {pw && <TempPassword email={pw.email} password={pw.password} onClose={() => setPw(null)} />}
      {viewAs && (
        <Modal title={`View as ${viewAs.name}`} subtitle="See exactly what they see, to help or check their access. Read-only: you can't change anything while viewing. It's logged with your reason." onClose={() => setViewAs(null)}>
          <Field label="Why are you viewing as this person?" required>
            <input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. They can't find the aging report" maxLength={200} />
          </Field>
          <div className="mt-2"><ErrorBox error={startViewAs.error} /></div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn" onClick={() => setViewAs(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={reason.trim().length < 5 || startViewAs.isPending} onClick={() => startViewAs.mutate()}><Eye size={15} /> Start viewing</button>
          </div>
        </Modal>
      )}
    </Page>
  );
}
