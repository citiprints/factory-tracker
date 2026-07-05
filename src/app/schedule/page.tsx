"use client";
import { useEffect, useState } from "react";

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

export default function SchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    userId: "",
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "18:00",
    notes: "",
  });

  async function load() {
    const meRes = await fetch("/api/auth/me");
    if (meRes.ok) {
      const me = await meRes.json();
      setIsAdmin(me.role === "ADMIN" || me.role === "MANAGER");
      if (me.role === "ADMIN" || me.role === "MANAGER") {
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users ?? data);
        }
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
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        await load();
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

  if (loading) return <div className="text-center text-gray-500 py-12">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{isAdmin ? "Schedule" : "My Shifts"}</h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-3 py-2 rounded bg-black text-white text-sm"
          >
            {showForm ? "Cancel" : "+ Assign Shift"}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="border rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              required
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="">Assign to...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="border rounded px-3 py-2"
            />
            <input
              type="time"
              required
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="border rounded px-3 py-2"
            />
          </div>
          <input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="border rounded px-3 py-2 w-full"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Assign Shift"}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {shifts.length === 0 && <div className="text-gray-400 text-sm">No shifts scheduled.</div>}
        {shifts.map((s) => (
          <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {new Date(s.date).toLocaleDateString()} · {s.startTime}–{s.endTime}
              </div>
              <div className="text-sm text-gray-500">
                {isAdmin ? s.user.name : ""}
                {s.location?.name ? ` · ${s.location.name}` : ""}
                {s.notes ? ` · ${s.notes}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-1 rounded ${
                  s.status === "COMPLETED"
                    ? "bg-green-100 text-green-700"
                    : s.status === "CANCELLED" || s.status === "MISSED"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {s.status}
              </span>
              {!isAdmin && s.status === "SCHEDULED" && (
                <button
                  onClick={() => updateStatus(s.id, "CONFIRMED")}
                  className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
