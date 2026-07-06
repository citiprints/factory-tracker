"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState, Spinner, statusChip, ticketColor } from "@/components/ui";

type Shift = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  user: { id: string; name: string };
  location?: { id: string; name: string } | null;
  task?: { id: string; title: string } | null;
};

type UserOption = { id: string; name: string; role: string };

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

export default function SchedulePage() {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    userId: "",
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "18:00",
    notes: "",
  });

  async function load() {
    if (isAdmin) {
      const usersRes = await fetch("/api/users");
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users ?? data);
      }
    }
    const shiftsRes = await fetch("/api/shifts");
    if (shiftsRes.ok) {
      const data = await shiftsRes.json();
      setShifts(data.shifts);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        await load();
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Couldn't assign the shift. Check the details and try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/shifts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  if (loading) return <Spinner />;

  // Group by day, upcoming first; past days sink to the bottom.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sorted = [...shifts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.startTime.localeCompare(b.startTime)
  );
  const upcoming = sorted.filter((s) => new Date(s.date) >= startOfToday);
  const past = sorted.filter((s) => new Date(s.date) < startOfToday).reverse();

  const groups: { key: string; label: string; items: Shift[] }[] = [];
  for (const s of upcoming) {
    const key = dayKey(s.date);
    let g = groups.find((g) => g.key === key);
    if (!g) {
      const d = new Date(s.date);
      const isToday = key === startOfToday.toDateString();
      const tomorrow = new Date(startOfToday.getTime() + 86400000);
      const label = isToday
        ? "Today"
        : key === tomorrow.toDateString()
        ? "Tomorrow"
        : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }

  function ShiftRow({ s }: { s: Shift }) {
    const st = statusChip(s.status);
    return (
      <div className="ticket p-3.5 flex items-center justify-between gap-3" style={ticketColor(s.status)}>
        <div className="min-w-0">
          <div className="font-mono tabular-nums text-sm font-semibold">
            {s.startTime}–{s.endTime}
          </div>
          <div className="text-sm text-muted truncate mt-0.5">
            {isAdmin ? s.user.name : null}
            {isAdmin && (s.location?.name || s.notes) ? " · " : ""}
            {s.location?.name}
            {s.location?.name && s.notes ? " · " : ""}
            {s.notes}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={st.cls}>{st.label}</span>
          {!isAdmin && s.status === "SCHEDULED" && (
            <button onClick={() => updateStatus(s.id, "CONFIRMED")} className="btn btn-outline btn-sm">
              Confirm
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={isAdmin ? "Schedule" : "My shifts"}
        subtitle={isAdmin ? "Assign and track shifts across the team" : "Confirm your upcoming shifts"}
        actions={
          isAdmin && (
            <button onClick={() => setShowForm((v) => !v)} className={showForm ? "btn btn-outline" : "btn btn-primary"}>
              {showForm ? "Cancel" : "+ Assign shift"}
            </button>
          )
        }
      />

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="card card-pad mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="shift-user">Team member</label>
              <select
                id="shift-user"
                required
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="input"
              >
                <option value="">Choose…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="shift-date">Date</label>
              <input
                id="shift-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="shift-start">Starts</label>
              <input
                id="shift-start"
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="shift-end">Ends</label>
              <input
                id="shift-end"
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="shift-notes">Notes</label>
            <input
              id="shift-notes"
              placeholder="Optional — e.g. lamination line, urgent order"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input"
            />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Assigning…" : "Assign shift"}
          </button>
        </form>
      )}

      {groups.length === 0 && past.length === 0 ? (
        <EmptyState
          title="No shifts scheduled"
          hint={isAdmin ? "Assign the first shift to get the week planned." : "You have no shifts assigned yet."}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="nav-section !px-0 !mt-0 mb-2">{g.label}</h2>
              <div className="space-y-2">
                {g.items.map((s) => <ShiftRow key={s.id} s={s} />)}
              </div>
            </section>
          ))}

          {past.length > 0 && (
            <details>
              <summary className="nav-section !px-0 !mt-0 mb-2 cursor-pointer select-none">
                Past shifts ({past.length})
              </summary>
              <div className="space-y-2 opacity-75">
                {past.slice(0, 20).map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="meta w-24 shrink-0">
                      {new Date(s.date).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                    </span>
                    <div className="flex-1">
                      <ShiftRow s={s} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
