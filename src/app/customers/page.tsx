"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";
import { CustomerFields, EMPTY_CUSTOMER_FORM, customerFormToPayload, type CustomerFormState } from "@/components/CustomerFields";

type Customer = {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    secondaryPhone?: string | null;
    company?: string | null;
    address?: string | null;
    gstin?: string | null;
    deliveryContactName?: string | null;
    deliveryPhone?: string | null;
    deliverySecondaryPhone?: string | null;
    deliveryAddress?: string | null;
    deliveryNotes?: string | null;
};

function toFormState(c: Customer): CustomerFormState {
    return {
        name: c.name, email: c.email || "", phone: c.phone || "", secondaryPhone: c.secondaryPhone || "",
        company: c.company || "", address: c.address || "", gstin: c.gstin || "",
        deliveryContactName: c.deliveryContactName || "", deliveryPhone: c.deliveryPhone || "",
        deliverySecondaryPhone: c.deliverySecondaryPhone || "", deliveryAddress: c.deliveryAddress || "",
        deliveryNotes: c.deliveryNotes || "",
    };
}

export default function CustomersPage() {
    const currentUser = useCurrentUser();
    const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
    const [creating, setCreating] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
    // Full billing/delivery details (GSTIN, delivery contact, notes, etc.) are
    // collapsed by default -- this is the one place they're always visible
    // regardless of how the customer was onboarded (form, manual fill, or a
    // direct edit here), so expanding it is the answer to "where do I see
    // this customer's billing/delivery info".
    const [expandedId, setExpandedId] = useState<string | null>(null);

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
        if (!form.email.trim() && !form.phone.trim()) {
            setError("Add an email address or a phone number — either one is enough.");
            return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(customerFormToPayload(form))
            });
            if (res.ok) {
                setForm(EMPTY_CUSTOMER_FORM);
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
                body: JSON.stringify(customerFormToPayload(editForm))
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
                    <CustomerFields values={form} onChange={(key, value) => setForm(v => ({ ...v, [key]: value }))} idPrefix="c" />
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
                                <form onSubmit={(e) => onSaveEdit(e, c.id)} className="space-y-4">
                                    <CustomerFields values={editForm} onChange={(key, value) => setEditForm(v => ({ ...v, [key]: value }))} idPrefix={`e-${c.id}`} />
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
                                            {c.address && <div className="text-sm text-muted mt-1">Billing: {c.address}</div>}
                                            {c.deliveryAddress && <div className="text-sm text-muted mt-1">Delivery: {c.deliveryAddress}</div>}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                className="btn btn-outline btn-sm"
                                                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                                            >
                                                {expandedId === c.id ? "Hide details" : "Billing & delivery details"}
                                            </button>
                                            {isAdmin && (
                                                <>
                                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditingId(c.id); setRowError(null); setEditForm(toFormState(c)); }}>Edit</button>
                                                    <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => onDelete(c.id)}>Delete</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {expandedId === c.id && (
                                        <div className="mt-3 pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <h3 className="text-sm font-medium">Billing details</h3>
                                                <div className="text-sm text-muted">Email: {c.email || <span className="italic">Not provided</span>}</div>
                                                <div className="text-sm text-muted">Phone: {c.phone || <span className="italic">Not provided</span>}</div>
                                                <div className="text-sm text-muted">Secondary phone: {c.secondaryPhone || <span className="italic">Not provided</span>}</div>
                                                <div className="text-sm text-muted">GSTIN / Tax ID: {c.gstin || <span className="italic">Not provided</span>}</div>
                                                <div className="text-sm text-muted">Address: {c.address || <span className="italic">Not provided</span>}</div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <h3 className="text-sm font-medium">Delivery details</h3>
                                                <div className="text-sm text-muted">Contact name: {c.deliveryContactName || <span className="italic">Not provided</span>}</div>
                                                <div className="text-sm text-muted">Phone: {c.deliveryPhone || <span className="italic">Not provided</span>}</div>
                                                <div className="text-sm text-muted">Secondary phone: {c.deliverySecondaryPhone || <span className="italic">Not provided</span>}</div>
                                                <div className="text-sm text-muted">Address: {c.deliveryAddress || <span className="italic">Not provided</span>}</div>
                                                <div className="text-sm text-muted">Notes: {c.deliveryNotes || <span className="italic">Not provided</span>}</div>
                                            </div>
                                        </div>
                                    )}
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
