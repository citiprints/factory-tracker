"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";

type Customer = { id: string; name: string; email?: string | null; phone?: string | null; company?: string | null; address?: string | null };

export default function CustomersPage() {
    const currentUser = useCurrentUser();
    const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [company, setCompany] = useState("");
    const [address, setAddress] = useState("");
    const [creating, setCreating] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [eName, setEName] = useState("");
    const [eEmail, setEEmail] = useState("");
    const [ePhone, setEPhone] = useState("");
    const [eCompany, setECompany] = useState("");
    const [eAddress, setEAddress] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/customers");
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                setError(json.error || "Failed to load customers");
                return;
            }
            const json = await res.json();
            setCustomers(json.customers ?? []);
        } catch {
            setError("Failed to load customers. Check your connection and try again.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setCreating(true);
        try {
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email: email || undefined, phone: phone || undefined, company: company || undefined, address: address || undefined })
            });
            if (res.ok) {
                setName(""); setEmail(""); setPhone(""); setCompany(""); setAddress("");
                load();
            } else {
                const json = await res.json().catch(() => ({}));
                setError(json.error || "Failed to create customer");
            }
        } finally {
            setCreating(false);
        }
    }

    async function onSaveEdit(e: React.FormEvent, id: string) {
        e.preventDefault();
        setSaving(true);
        setRowError(null);
        try {
            const res = await fetch(`/api/customers/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: eName, email: eEmail || undefined, phone: ePhone || undefined, company: eCompany || undefined, address: eAddress || undefined })
            });
            if (res.ok) {
                setEditingId(null);
                load();
            } else {
                const json = await res.json().catch(() => ({}));
                setRowError({ id, message: json.error || "Failed to save changes" });
            }
        } finally {
            setSaving(false);
        }
    }

    async function onDelete(id: string) {
        if (!confirm("Delete this customer? This can't be undone.")) return;
        setRowError(null);
        const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
        if (res.ok) {
            load();
        } else {
            const json = await res.json().catch(() => ({}));
            setRowError({ id, message: json.error || "Failed to delete customer" });
        }
    }

    return (
        <div className="grid gap-6 sm:grid-cols-2">
            <section>
                <h1 className="text-xl font-semibold mb-3">Add customer</h1>
                <form onSubmit={onCreate} className="space-y-3">
                    <input className="w-full border rounded px-3 py-2 bg-background" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
                    <input className="w-full border rounded px-3 py-2 bg-background" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input className="w-full border rounded px-3 py-2 bg-background" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                    <input className="w-full border rounded px-3 py-2 bg-background" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
                    <textarea className="w-full border rounded px-3 py-2 bg-background" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
                    <button disabled={creating} className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50">
                        {creating ? "Creating..." : "Create"}
                    </button>
                </form>
                {error && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                        {error}
                    </div>
                )}
            </section>
            <section>
                <h2 className="text-lg font-medium mb-2">Customers</h2>

                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="border rounded p-3 animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : customers.length === 0 ? (
                    <p className="text-sm text-gray-500">No customers yet. Add one on the left.</p>
                ) : (
                    <ul className="space-y-2">
                        {customers.map(c => (
                            <li key={c.id} className="border rounded p-3">
                                {editingId === c.id ? (
                                    <form onSubmit={(e) => onSaveEdit(e, c.id)} className="space-y-2">
                                        <input className="w-full border rounded px-3 py-2 bg-background" value={eName} onChange={e => setEName(e.target.value)} required />
                                        <input className="w-full border rounded px-3 py-2 bg-background" value={eEmail} onChange={e => setEEmail(e.target.value)} />
                                        <input className="w-full border rounded px-3 py-2 bg-background" value={ePhone} onChange={e => setEPhone(e.target.value)} />
                                        <input className="w-full border rounded px-3 py-2 bg-background" value={eCompany} onChange={e => setECompany(e.target.value)} />
                                        <textarea className="w-full border rounded px-3 py-2 bg-background" value={eAddress} onChange={e => setEAddress(e.target.value)} />
                                        {rowError?.id === c.id && (
                                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                                {rowError.message}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button disabled={saving} className="btn rounded px-3 py-2 disabled:opacity-50" type="submit">
                                                {saving ? "Saving..." : "Save"}
                                            </button>
                                            <button className="rounded border px-3 py-2" type="button" onClick={() => { setEditingId(null); setRowError(null); }}>Cancel</button>
                                        </div>
                                    </form>
                                ) : (
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-medium truncate">{c.name}</div>
                                                <div className="text-xs text-gray-600 truncate">{c.email || ""} {c.phone ? `• ${c.phone}` : ""} {c.company ? `• ${c.company}` : ""}</div>
                                                {c.address && <div className="text-xs text-gray-600">{c.address}</div>}
                                            </div>
                                            {isAdmin && (
                                                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                                                    <button type="button" className="rounded border px-3 py-1" onClick={() => { setEditingId(c.id); setRowError(null); setEName(c.name); setEEmail(c.email || ""); setEPhone(c.phone || ""); setECompany(c.company || ""); setEAddress(c.address || ""); }}>Edit</button>
                                                    <button type="button" className="rounded border px-3 py-1 text-red-700 hover:bg-red-50" onClick={() => onDelete(c.id)}>Delete</button>
                                                </div>
                                            )}
                                        </div>
                                        {rowError?.id === c.id && (
                                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                                                {rowError.message}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
