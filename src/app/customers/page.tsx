"use client";
import { useEffect, useState } from "react";

type Customer = { id: string; name: string; email?: string | null; phone?: string | null; company?: string | null; address?: string | null };

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [company, setCompany] = useState("");
    const [address, setAddress] = useState("");

    const [editingId, setEditingId] = useState<string | null>(null);
    const [eName, setEName] = useState("");
    const [eEmail, setEEmail] = useState("");
    const [ePhone, setEPhone] = useState("");
    const [eCompany, setECompany] = useState("");
    const [eAddress, setEAddress] = useState("");
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setError(null);
        const res = await fetch("/api/customers");
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            setError(json.error || "Failed to load customers");
            return;
        }
        const json = await res.json();
        setCustomers(json.customers ?? []);
    }

    useEffect(() => { load(); }, []);

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
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
    }

    return (
        <div className="grid gap-6 sm:grid-cols-2">
            <section>
                <h1 className="text-xl font-semibold mb-3">Add customer</h1>
                <form onSubmit={onCreate} className="space-y-3">
                    <input className="w-full border rounded px-3 py-2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
                    <input className="w-full border rounded px-3 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input className="w-full border rounded px-3 py-2" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                    <input className="w-full border rounded px-3 py-2" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
                    <textarea className="w-full border rounded px-3 py-2" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
                    <button className="rounded bg-gray-900 px-3 py-2 text-white">Create</button>
                </form>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            </section>
            <section>
                <h2 className="text-lg font-medium mb-2">Customers</h2>
                <ul className="space-y-2">
                    {customers.map(c => (
                        <li key={c.id} className="border rounded p-3">
                            {editingId === c.id ? (
                                <form
                                    onSubmit={async e => {
                                        e.preventDefault();
                                        await fetch(`/api/customers/${c.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ name: eName, email: eEmail || undefined, phone: ePhone || undefined, company: eCompany || undefined, address: eAddress || undefined })
                                        });
                                        setEditingId(null);
                                        load();
                                    }}
                                    className="space-y-2"
                                >
                                    <input className="w-full border rounded px-3 py-2" value={eName} onChange={e => setEName(e.target.value)} required />
                                    <input className="w-full border rounded px-3 py-2" value={eEmail} onChange={e => setEEmail(e.target.value)} />
                                    <input className="w-full border rounded px-3 py-2" value={ePhone} onChange={e => setEPhone(e.target.value)} />
                                    <input className="w-full border rounded px-3 py-2" value={eCompany} onChange={e => setECompany(e.target.value)} />
                                    <textarea className="w-full border rounded px-3 py-2" value={eAddress} onChange={e => setEAddress(e.target.value)} />
                                    <div className="flex gap-2">
                                        <button className="btn rounded px-3 py-2" type="submit">Save</button>
                                        <button className="rounded border px-3 py-2" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{c.name}</div>
                                        <div className="text-xs text-gray-600">{c.email || ""} {c.phone ? `• ${c.phone}` : ""} {c.company ? `• ${c.company}` : ""}</div>
                                        {c.address && <div className="text-xs text-gray-600">{c.address}</div>}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <button type="button" className="rounded border px-3 py-1" onClick={() => { setEditingId(c.id); setEName(c.name); setEEmail(c.email || ""); setEPhone(c.phone || ""); setECompany(c.company || ""); setEAddress(c.address || ""); }}>Edit</button>
                                        <button type="button" className="rounded border px-3 py-1" onClick={async () => { if (!confirm("Delete this customer?")) return; await fetch(`/api/customers/${c.id}`, { method: "DELETE" }); load(); }}>Delete</button>
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}


