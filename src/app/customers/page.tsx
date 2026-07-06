"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";

type Customer = { id: string; name: string; email?: string | null; phone?: string | null; company?: string | null; address?: string | null };

export default function CustomersPage() {
    const currentUser = useCurrentUser();
    const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState("");
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
                setError(json.error || "Couldn't load customers.");
                return;
            }
            const json = await res.json();
            setCustomers(json.customers ?? []);
        } catch {
            setError("Couldn't load customers. Check your connection and try again.");
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
                setShowForm(false);
                load();
            } else {
                const json = await res.json().catch(() => ({}));
                setError(json.error || "Couldn't add the customer.");
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
                setRowError({ id, message: json.error || "Couldn't save changes." });
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
            setRowError({ id, message: json.error || "Couldn't delete the customer." });
        }
    }

    const filtered = customers.filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [c.name, c.email, c.phone, c.company].some((v) => v?.toLowerCase().includes(q));
    });

    return (
        <div className="max-w-3xl mx-auto space-y-5">
            <PageHeader
                title="Customers"
                subtitle={`${customers.length} on record`}
                actions={
                    <button onClick={() => setShowForm((v) => !v)} className={showForm ? "btn btn-outline" : "btn btn-primary"}>
                        {showForm ? "Cancel" : "+ Add customer"}
                    </button>
                }
            />

            {showForm && (
                <form onSubmit={onCreate} className="card card-pad space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="field-label" htmlFor="c-name">Name</label>
                            <input id="c-name" className="input" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="field-label" htmlFor="c-email">Email</label>
                            <input id="c-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div>
                            <label className="field-label" htmlFor="c-phone">Phone</label>
                            <input id="c-phone" className="input" value={phone} onChange={e => setPhone(e.target.value)} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="field-label" htmlFor="c-company">Company</label>
                            <input id="c-company" className="input" value={company} onChange={e => setCompany(e.target.value)} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="field-label" htmlFor="c-address">Address</label>
                            <textarea id="c-address" className="input" value={address} onChange={e => setAddress(e.target.value)} />
                        </div>
                    </div>
                    {error && <div className="alert alert-danger">{error}</div>}
                    <button disabled={creating} className="btn btn-primary">
                        {creating ? "Adding…" : "Add customer"}
                    </button>
                </form>
            )}

            {!showForm && error && <div className="alert alert-danger">{error}</div>}

            {customers.length > 3 && (
                <input
                    className="input"
                    placeholder="Search by name, phone, email, company…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            )}

            {loading ? (
                <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="card p-4">
                            <div className="skeleton h-4 w-1/3 mb-2" />
                            <div className="skeleton h-3 w-2/3" />
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    title={search ? "No matches" : "No customers yet"}
                    hint={search ? "Try a different search." : "Add your first customer to start attaching them to jobs."}
                />
            ) : (
                <ul className="space-y-2.5">
                    {filtered.map(c => (
                        <li key={c.id} className="card p-4">
                            {editingId === c.id ? (
                                <form onSubmit={(e) => onSaveEdit(e, c.id)} className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <input className="input sm:col-span-2" value={eName} onChange={e => setEName(e.target.value)} placeholder="Name" required />
                                        <input className="input" value={eEmail} onChange={e => setEEmail(e.target.value)} placeholder="Email" />
                                        <input className="input" value={ePhone} onChange={e => setEPhone(e.target.value)} placeholder="Phone" />
                                        <input className="input sm:col-span-2" value={eCompany} onChange={e => setECompany(e.target.value)} placeholder="Company" />
                                        <textarea className="input sm:col-span-2" value={eAddress} onChange={e => setEAddress(e.target.value)} placeholder="Address" />
                                    </div>
                                    {rowError?.id === c.id && <div className="alert alert-danger">{rowError.message}</div>}
                                    <div className="flex gap-2">
                                        <button disabled={saving} className="btn btn-primary btn-sm" type="submit">
                                            {saving ? "Saving…" : "Save changes"}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setEditingId(null); setRowError(null); }}>Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">{c.name}</div>
                                            <div className="meta mt-0.5 truncate">
                                                {[c.company, c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}
                                            </div>
                                            {c.address && <div className="text-sm text-muted mt-1">{c.address}</div>}
                                        </div>
                                        {isAdmin && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditingId(c.id); setRowError(null); setEName(c.name); setEEmail(c.email || ""); setEPhone(c.phone || ""); setECompany(c.company || ""); setEAddress(c.address || ""); }}>Edit</button>
                                                <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => onDelete(c.id)}>Delete</button>
                                            </div>
                                        )}
                                    </div>
                                    {rowError?.id === c.id && <div className="alert alert-danger mt-2">{rowError.message}</div>}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
