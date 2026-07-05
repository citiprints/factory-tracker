"use client";
import React, { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

type Quotation = {
	id: string;
	title: string;
	description: string;
	status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED" | "ARCHIVED" | "CLIENT_TO_REVERT";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	createdAt: string;
	customerId?: string | null;
	customerRef?: { id: string; name: string } | null;
	customFields?: any;
	assignments?: { id: string; user: { id: string; name: string }; role: string }[];
};

// Loading skeleton component
function QuotationsSkeleton() {
	return (
		<div className="space-y-4">
			{[1, 2, 3, 4, 5].map((i) => (
				<div key={i} className="border border-black rounded p-3">
					<div className="animate-pulse">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
							<div className="flex flex-wrap items-center gap-2 min-w-0">
								<div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0"></div>
								<div className="h-5 bg-gray-200 rounded w-32 sm:w-48 max-w-full"></div>
								<div className="h-4 bg-gray-200 rounded w-16 flex-shrink-0"></div>
								<div className="h-4 bg-gray-200 rounded w-20 flex-shrink-0"></div>
								<div className="h-4 bg-gray-200 rounded w-24 flex-shrink-0"></div>
							</div>
							<div className="h-6 bg-gray-200 rounded w-20 flex-shrink-0"></div>
						</div>
						<div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
					</div>
				</div>
			))}
		</div>
	);
}

// DateTimeSelector component for convert form
function DateTimeSelector({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
	const [open, setOpen] = useState(false);
	
	// Handle click outside to close picker
	useEffect(() => {
		if (!open) return;
		
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Element;
			if (!target.closest('.date-time-selector')) {
				setOpen(false);
			}
		};
		
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [open]);
	const isoLike = value; // "YYYY-MM-DDTHH:MM"
	const datePart = isoLike ? isoLike.split("T")[0] : "";
	const timePart = isoLike ? (isoLike.split("T")[1] || "") : "";

	function updateDate(nextDate: string) {
		if (!nextDate && !timePart) return onChange("");
		const next = `${nextDate || ""}${nextDate && timePart ? "T" : nextDate ? "T00:00" : ""}${timePart || ""}`.trim();
		onChange(next);
	}

	function updateTime(nextTime: string) {
		if (!nextTime && !datePart) return onChange("");
		const next = `${datePart || new Date().toISOString().slice(0,10)}T${nextTime || "00:00"}`;
		onChange(next);
	}

	const initialForMonth = datePart ? new Date(datePart) : new Date();
	const [monthCursor, setMonthCursor] = useState(new Date(initialForMonth.getFullYear(), initialForMonth.getMonth(), 1));

	function formatYmd(d: Date) {
		const y = d.getFullYear();
		const m = `${d.getMonth()+1}`.padStart(2, "0");
		const day = `${d.getDate()}`.padStart(2, "0");
		return `${y}-${m}-${day}`;
	}

	const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
	const startWeekday = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay();
	const dayButtons: React.ReactElement[] = [];
	for (let i = 0; i < startWeekday; i++) {
		dayButtons.push(<div key={`blank-${i}`} />);
	}
	for (let d = 1; d <= daysInMonth; d++) {
		const thisDate = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d);
		const ymd = formatYmd(thisDate);
		const selected = datePart === ymd;
		dayButtons.push(
			<button
				key={d}
				type="button"
				className={`w-8 h-8 text-sm rounded ${selected ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
				onClick={() => updateDate(ymd)}
			>
				{d}
			</button>
		);
	}

	const display = value ? new Date(value).toLocaleString() : `Select ${label}`;

	return (
		<div className="relative cursor-pointer date-time-selector">
			<div className="w-full border rounded px-3 py-2 text-left" onClick={() => setOpen(v => !v)}>
				<span className="block text-xs text-gray-600">{label}</span>
				<span>{display}</span>
			</div>
			{open && (
				<div className="absolute top-full left-0 right-0 z-10 bg-white border rounded-lg shadow-lg p-3 mt-1">
					<div className="flex items-center justify-between mb-2">
						<button
							type="button"
							onClick={(e) => { e.stopPropagation(); setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1)); }}
							className="p-1 hover:bg-gray-100 rounded"
						>
							←
						</button>
						<span className="font-medium">
							{monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
						</span>
						<button
							type="button"
							onClick={(e) => { e.stopPropagation(); setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)); }}
							className="p-1 hover:bg-gray-100 rounded"
						>
							→
						</button>
					</div>
					<div className="grid grid-cols-7 gap-1 mb-2">
						{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
							<div key={day} className="text-xs text-gray-500 text-center py-1">{day}</div>
						))}
						{dayButtons}
					</div>
					<input
						type="time"
						value={timePart}
						onChange={(e) => updateTime(e.target.value)}
						onClick={(e) => e.stopPropagation()}
						className="w-full border rounded px-2 py-1 text-sm"
					/>
				</div>
			)}
		</div>
	);
}

export default function QuotationsPage() {
	const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
	const [quotations, setQuotations] = useState<Quotation[]>([]);
	const [loading, setLoading] = useState(true);
	const [viewingId, setViewingId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [convertingId, setConvertingId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
	const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
	
	// Edit form state
	const [editTitle, setEditTitle] = useState("");
	const [editDesc, setEditDesc] = useState("");
	const [editStatus, setEditStatus] = useState<Quotation["status"]>("TODO");
	const [editPriority, setEditPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
	const [editCustomerId, setEditCustomerId] = useState<string>("");
	const [editAssigneeId, setEditAssigneeId] = useState<string>("");
	const [editCustom, setEditCustom] = useState<Record<string, any>>({});
	
	// Convert form state
	const [convertStartAt, setConvertStartAt] = useState<string>("");
	const [convertDueAt, setConvertDueAt] = useState<string>("");

	// Check authentication
	useEffect(() => {
		const checkAuth = async () => {
			try {
				const res = await fetch("/api/auth/me");
				if (res.ok) {
					const userData = await res.json();
					setCurrentUser(userData);
				} else {
					// Redirect to homepage if not authenticated
					window.location.href = "/";
					return;
				}
			} catch (error) {
				console.error('Auth check error:', error);
				window.location.href = "/";
				return;
			}
		};

		checkAuth();
	}, []);

	async function load() {
		setLoading(true);
		try {
			const [resQuotations, resCustomers, resUsers] = await Promise.all([
				fetch("/api/quotations"),
				fetch("/api/customers"),
				fetch("/api/users")
			]);
			
			if (resQuotations.ok) {
				const json = await resQuotations.json();
				const loaded: Quotation[] = (json.quotations ?? []).map((q: any) => ({
					...q,
					customFields: typeof q.customFields === "string" ? (() => { try { return JSON.parse(q.customFields); } catch { return {}; } })() : (q.customFields || {})
				}));
				setQuotations(loaded);
			}
			
			if (resCustomers.ok) {
				const json = await resCustomers.json();
				setCustomers((json.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })));
			}
			
			if (resUsers.ok) {
				const json = await resUsers.json();
				setUsers((json.users ?? []).map((u: any) => ({ id: u.id, name: u.name })));
			}
		} catch (error) {
			console.error("Failed to load data:", error);
		} finally {
			setLoading(false);
		}
	}

	async function editQuotation(id: string) {
		try {
			const res = await fetch(`/api/quotations/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: editTitle,
					description: editDesc,
					status: "TODO", // Always set to TODO for quotations
					customerId: editCustomerId || undefined,
					customFields: editCustom,
					assigneeId: editAssigneeId || undefined
				})
			});
			
			if (res.ok) {
				load();
				setEditingId(null);
				setEditTitle("");
				setEditDesc("");
				setEditStatus("TODO");
				setEditCustomerId("");
				setEditAssigneeId("");
				setEditCustom({});
				notifyDataChange();
			} else {
				const errorData = await res.json();
				alert(errorData.error || "Failed to update quotation");
			}
		} catch (error) {
			alert("Failed to update quotation");
		}
	}

	async function deleteQuotation(id: string) {
		if (!confirm("Are you sure you want to delete this quotation?")) return;
		
		setDeletingId(id);
		try {
			const res = await fetch(`/api/quotations/${id}`, {
				method: "DELETE"
			});
			
			if (res.ok) {
				load();
				notifyDataChange();
			} else {
				const errorData = await res.json();
				alert(errorData.error || "Failed to delete quotation");
			}
		} catch (error) {
			alert("Failed to delete quotation");
		} finally {
			setDeletingId(null);
		}
	}

	async function convertToTask(id: string) {
		if (!convertStartAt || !convertDueAt) {
			alert("Please provide both start and due dates");
			return;
		}
		
		setConvertingId(id);
		try {
			const res = await fetch(`/api/quotations/${id}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					startAt: convertStartAt,
					dueAt: convertDueAt
				})
			});
			
			if (res.ok) {
				alert("Quotation converted to task successfully!");
				load();
				setConvertingId(null);
				setConvertStartAt("");
				setConvertDueAt("");
				notifyDataChange();
			} else {
				const errorData = await res.json();
				alert(errorData.error || "Failed to convert quotation to task");
			}
		} catch (error) {
			alert("Failed to convert quotation to task");
		} finally {
			setConvertingId(null);
		}
	}

	// Function to notify layout about data changes
	function notifyDataChange() {
		window.dispatchEvent(new Event('dataChanged'));
	}

	useEffect(() => {
		load();
	}, []);

	if (!currentUser) {
		return <QuotationsSkeleton />;
	}

	return (
		<div className="container mx-auto p-4">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold">Quotations</h1>
				<div className="flex items-center gap-4">
					<span className="text-sm text-gray-600">
						{quotations.length} quotation{quotations.length !== 1 ? 's' : ''}
					</span>
				</div>
			</div>

			{loading ? (
				<QuotationsSkeleton />
			) : quotations.length === 0 ? (
				<div className="text-center py-8">
					<p className="text-gray-500">No quotations found.</p>
				</div>
			) : (
				<div className="space-y-4">
					{quotations.map((q) => (
						<div key={q.id} className="border border-black rounded p-3">
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 rounded-full bg-blue-500"></div>
									<h3 className="font-medium">{q.title}</h3>
								</div>
								<div className="flex gap-2">
									<button
										type="button"
										className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
										onClick={() => setViewingId(viewingId === q.id ? null : q.id)}
									>
										{viewingId === q.id ? "Hide" : "View"}
									</button>
									<button
										type="button"
										className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
										onClick={() => {
											setEditingId(q.id);
											setEditTitle(q.title);
											setEditDesc(q.description);
											setEditStatus(q.status);
											setEditPriority(q.priority);
											setEditCustomerId(q.customerId || "");
											setEditAssigneeId(q.assignments?.[0]?.user.id || "");
											setEditCustom(q.customFields || {});
										}}
									>
										Edit
									</button>
									<button
										type="button"
										className="text-xs px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
										onClick={() => deleteQuotation(q.id)}
										disabled={deletingId === q.id}
									>
										{deletingId === q.id ? "Deleting..." : "Delete"}
									</button>
									<button
										type="button"
										className="text-xs px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
										onClick={() => setConvertingId(q.id)}
										disabled={convertingId === q.id}
									>
										{convertingId === q.id ? "Converting..." : "Convert to Task"}
									</button>
								</div>
							</div>

							{/* Badges below title */}
							<div className="flex flex-wrap gap-2 mb-2 text-xs text-gray-600">
								{q.customFields?.quantity && (
									<span>Qty: {q.customFields.quantity}</span>
								)}
								{q.customerRef && (
									<span>Customer: {q.customerRef.name}</span>
								)}
								{q.customFields?.category && (
									<span>Category: {q.customFields.category}</span>
								)}
								{q.assignments && q.assignments.length > 0 && (
									<span>Assigned to: {q.assignments.map(a => a.user.name).join(", ")}</span>
								)}
								{q.assignments?.some(a => a.user.id === currentUser.id) && (
									<span className="text-blue-600">Assigned to me</span>
								)}
							</div>

							{/* Description */}
							{q.description && (
								<p className="text-sm text-gray-600 mb-2">{q.description}</p>
							)}

							{/* Detailed view */}
							{viewingId === q.id && (
								<div className="mt-4 p-3 border border-gray-200 rounded bg-gray-50">
									<h4 className="font-medium text-sm mb-2">Quotation Details</h4>
									
									{/* Category-specific fields */}
									{q.customFields?.category === "Rigid Boxes" && (
										<div className="space-y-2 text-sm">
											{q.customFields?.boxType && <div><strong>Box Type:</strong> {q.customFields.boxType}</div>}
											{q.customFields?.size && <div><strong>Size:</strong> {q.customFields.size}</div>}
											{q.customFields?.topOuter && <div><strong>Top Outer:</strong> {q.customFields.topOuter}</div>}
											{q.customFields?.topInner && <div><strong>Top Inner:</strong> {q.customFields.topInner}</div>}
											{q.customFields?.bottomOuter && <div><strong>Bottom Outer:</strong> {q.customFields.bottomOuter}</div>}
											{q.customFields?.bottomInner && <div><strong>Bottom Inner:</strong> {q.customFields.bottomInner}</div>}
											{q.customFields?.hasPartition && <div><strong>Partition:</strong> {q.customFields.partitionDescription || "Yes"}</div>}
										</div>
									)}

									{q.customFields?.category === "Cake Boxes" && (
										<div className="space-y-2 text-sm">
											{q.customFields?.size && <div><strong>Size:</strong> {q.customFields.size}</div>}
											{q.customFields?.hasWindow && <div><strong>Window:</strong> {q.customFields.windowDetails || "Yes"}</div>}
											{q.customFields?.innerPrinting && <div><strong>Inner Printing:</strong> {q.customFields.innerPrintingDetails || "Yes"}</div>}
										</div>
									)}

									{q.customFields?.category === "Paper Bags" && (
										<div className="space-y-2 text-sm">
											{q.customFields?.size && <div><strong>Size:</strong> {q.customFields.size}</div>}
											{q.customFields?.innerPrinting && <div><strong>Inner Printing:</strong> {q.customFields.innerPrintingDetails || "Yes"}</div>}
											{q.customFields?.rope && <div><strong>Rope:</strong> {q.customFields.rope}</div>}
										</div>
									)}

									{q.customFields?.category === "Stickers" && (
										<div className="space-y-2 text-sm">
											{q.customFields?.size && <div><strong>Size:</strong> {q.customFields.size}</div>}
											{q.customFields?.shape && <div><strong>Shape:</strong> {q.customFields.shape}</div>}
											{q.customFields?.material && <div><strong>Material:</strong> {q.customFields.material}</div>}
										</div>
									)}

									{q.customFields?.category === "Cards" && (
										<div className="space-y-2 text-sm">
											{q.customFields?.size && <div><strong>Size:</strong> {q.customFields.size}</div>}
											{q.customFields?.sides && <div><strong>Sides:</strong> {q.customFields.sides === "single" ? "Single side" : "Double side"}</div>}
											{q.customFields?.material && <div><strong>Material:</strong> {q.customFields.material}</div>}
										</div>
									)}

									{q.customFields?.category === "Invitation" && (
										<div className="space-y-2 text-sm">
											{q.customFields?.size && <div><strong>Size:</strong> {q.customFields.size}</div>}
											{q.customFields?.material && <div><strong>Material:</strong> {q.customFields.material}</div>}
											{q.customFields?.envelope && <div><strong>Envelope:</strong> {q.customFields.envelope}</div>}
										</div>
									)}

									{/* Attachments */}
									{q.customFields?.attachments && q.customFields.attachments.length > 0 && (
										<div className="mt-3">
											<strong className="text-sm">Attachments:</strong>
											<div className="mt-1 space-y-1">
												{q.customFields.attachments.map((attachment: string, index: number) => (
													<div key={index} className="text-sm">
														<a 
															href={attachment} 
															target="_blank" 
															rel="noopener noreferrer"
															className="text-blue-600 hover:underline"
														>
															{attachment.split('/').pop()}
														</a>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Created date */}
									<div className="mt-3 text-sm text-gray-500">
										Created: {new Date(q.createdAt).toLocaleDateString()}
									</div>
								</div>
							)}
						</div>
					))}
				</div>
			)}

			{/* Edit Quotation Modal */}
			{editingId && (
				<div 
					className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
					onClick={() => {
						setEditingId(null);
						setEditTitle("");
						setEditDesc("");
						setEditStatus("TODO");
						setEditPriority("MEDIUM");
						setEditCustomerId("");
						setEditAssigneeId("");
						setEditCustom({});
					}}
				>
					<div 
						className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[95vh] overflow-y-auto"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 className="text-xl font-semibold mb-4">Edit Quotation</h2>
						<div className="space-y-3">
							<div>
								<label className="block text-sm font-medium mb-1">Title</label>
								<input
									type="text"
									className="w-full border rounded px-3 py-2"
									value={editTitle}
									onChange={(e) => setEditTitle(e.target.value)}
									required
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-1">Description</label>
								<textarea
									className="w-full border rounded px-3 py-2"
									value={editDesc}
									onChange={(e) => setEditDesc(e.target.value)}
									rows={3}
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-sm font-medium mb-1">Customer</label>
									<select
										className="w-full border rounded px-3 py-2"
										value={editCustomerId}
										onChange={(e) => setEditCustomerId(e.target.value)}
									>
										<option value="">Select customer</option>
										{customers.map(c => (
											<option key={c.id} value={c.id}>{c.name}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">Assignee</label>
									<select
										className="w-full border rounded px-3 py-2"
										value={editAssigneeId}
										onChange={(e) => setEditAssigneeId(e.target.value)}
									>
										<option value="">Select user</option>
										{users.map(u => (
											<option key={u.id} value={u.id}>{u.name}</option>
										))}
									</select>
								</div>
							</div>

							{/* Category-specific fields */}
							{editCustom?.category === "Rigid Boxes" && (
								<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
									<h3 className="font-medium text-sm">Rigid Box Specifications</h3>
									
									{/* Box Type - Radio buttons */}
									<div>
										<label className="block text-sm font-medium mb-2">Box Type</label>
										<div className="space-y-2">
											{["Lid & Base", "Magnetic", "Ribbon", "Book", "Custom"].map(type => (
												<label key={type} className="flex items-center gap-2">
													<input
														type="radio"
														name="editBoxType"
														value={type}
														checked={editCustom?.boxType === type}
														onChange={e => setEditCustom({ ...editCustom, boxType: e.target.value })}
													/>
													{type}
												</label>
											))}
										</div>
									</div>

									{/* Size */}
									<div>
										<label className="block text-sm font-medium mb-2">Size</label>
										<div className="flex items-center gap-2">
											<input
												type="text"
												className="flex-1 border rounded px-3 py-2"
												placeholder="Enter size"
												value={editCustom?.size ?? ""}
												onChange={e => setEditCustom({ ...editCustom, size: e.target.value })}
											/>
											<label className="flex items-center gap-2 text-sm">
												<input
													type="checkbox"
													checked={editCustom?.existingSize ?? false}
													onChange={e => setEditCustom({ ...editCustom, existingSize: e.target.checked })}
												/>
												Existing size
											</label>
										</div>
									</div>

									{/* Top Outer */}
									<input
										type="text"
										className="w-full border rounded px-3 py-2"
										placeholder="Top Outer"
										value={editCustom?.topOuter ?? ""}
										onChange={e => setEditCustom({ ...editCustom, topOuter: e.target.value })}
									/>

									{/* Top Inner */}
									<input
										type="text"
										className="w-full border rounded px-3 py-2"
										placeholder="Top Inner"
										value={editCustom?.topInner ?? ""}
										onChange={e => setEditCustom({ ...editCustom, topInner: e.target.value })}
									/>

									{/* Bottom Outer */}
									<input
										type="text"
										className="w-full border rounded px-3 py-2"
										placeholder="Bottom Outer"
										value={editCustom?.bottomOuter ?? ""}
										onChange={e => setEditCustom({ ...editCustom, bottomOuter: e.target.value })}
									/>

									{/* Bottom Inner */}
									<input
										type="text"
										className="w-full border rounded px-3 py-2"
										placeholder="Bottom Inner"
										value={editCustom?.bottomInner ?? ""}
										onChange={e => setEditCustom({ ...editCustom, bottomInner: e.target.value })}
									/>

									{/* Partition */}
									<div>
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={editCustom?.hasPartition ?? false}
												onChange={e => setEditCustom({ ...editCustom, hasPartition: e.target.checked })}
											/>
											Partition
										</label>
										{editCustom?.hasPartition && (
											<textarea
												className="w-full border rounded px-3 py-2 mt-2"
												placeholder="Partition description"
												value={editCustom?.partitionDescription ?? ""}
												onChange={e => setEditCustom({ ...editCustom, partitionDescription: e.target.value })}
											/>
										)}
									</div>
								</div>
							)}

							{editCustom?.category === "Cake Boxes" && (
								<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
									<h3 className="font-medium text-sm">Cake Box Specifications</h3>
									<div>
										<label className="block text-sm font-medium mb-2">Size</label>
										<div className="flex items-center gap-2">
											<input
												type="text"
												className="flex-1 border rounded px-3 py-2"
												placeholder="Enter size"
												value={editCustom?.size ?? ""}
												onChange={e => setEditCustom({ ...editCustom, size: e.target.value })}
											/>
											<label className="flex items-center gap-2 text-sm">
												<input
													type="checkbox"
													checked={editCustom?.existingSize ?? false}
													onChange={e => setEditCustom({ ...editCustom, existingSize: e.target.checked })}
												/>
												Existing size
											</label>
										</div>
									</div>
									<div>
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={editCustom?.hasWindow ?? false}
												onChange={e => setEditCustom({ ...editCustom, hasWindow: e.target.checked })}
											/>
											Window
										</label>
										{editCustom?.hasWindow && (
											<input
												type="text"
												className="w-full border rounded px-3 py-2 mt-2"
												placeholder="Window details"
												value={editCustom?.windowDetails ?? ""}
												onChange={e => setEditCustom({ ...editCustom, windowDetails: e.target.value })}
											/>
										)}
									</div>
									<div>
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={editCustom?.innerPrinting ?? false}
												onChange={e => setEditCustom({ ...editCustom, innerPrinting: e.target.checked })}
											/>
											Inner Printing
										</label>
										{editCustom?.innerPrinting && (
											<input
												type="text"
												className="w-full border rounded px-3 py-2 mt-2"
												placeholder="Inner printing details"
												value={editCustom?.innerPrintingDetails ?? ""}
												onChange={e => setEditCustom({ ...editCustom, innerPrintingDetails: e.target.value })}
											/>
										)}
									</div>
								</div>
							)}

							{editCustom?.category === "Paper Bags" && (
								<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
									<h3 className="font-medium text-sm">Paper Bag Specifications</h3>
									<div>
										<label className="block text-sm font-medium mb-2">Size</label>
										<div className="flex items-center gap-2">
											<input
												type="text"
												className="flex-1 border rounded px-3 py-2"
												placeholder="Enter size"
												value={editCustom?.size ?? ""}
												onChange={e => setEditCustom({ ...editCustom, size: e.target.value })}
											/>
											<label className="flex items-center gap-2 text-sm">
												<input
													type="checkbox"
													checked={editCustom?.existingSize ?? false}
													onChange={e => setEditCustom({ ...editCustom, existingSize: e.target.checked })}
												/>
												Existing size
											</label>
										</div>
									</div>
									<div>
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={editCustom?.innerPrinting ?? false}
												onChange={e => setEditCustom({ ...editCustom, innerPrinting: e.target.checked })}
											/>
											Inner Printing
										</label>
										{editCustom?.innerPrinting && (
											<input
												type="text"
												className="w-full border rounded px-3 py-2 mt-2"
												placeholder="Inner printing details"
												value={editCustom?.innerPrintingDetails ?? ""}
												onChange={e => setEditCustom({ ...editCustom, innerPrintingDetails: e.target.value })}
											/>
										)}
									</div>
									<input
										type="text"
										className="w-full border rounded px-3 py-2"
										placeholder="Rope details"
										value={editCustom?.rope ?? ""}
										onChange={e => setEditCustom({ ...editCustom, rope: e.target.value })}
									/>
								</div>
							)}

							{editCustom?.category === "Stickers" && (
								<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
									<h3 className="font-medium text-sm">Sticker Specifications</h3>
									<input
										type="text"
										className="w-full border rounded px-3 py-2"
										placeholder="Size"
										value={editCustom?.size ?? ""}
										onChange={e => setEditCustom({ ...editCustom, size: e.target.value })}
									/>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-sm font-medium mb-1">Shape</label>
											<select
												className="w-full border rounded px-3 py-2"
												value={editCustom?.shape ?? "Rectangle"}
												onChange={e => setEditCustom({ ...editCustom, shape: e.target.value })}
											>
												<option>Rectangle</option>
												<option>Circle</option>
												<option>Custom</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium mb-1">Material</label>
											<select
												className="w-full border rounded px-3 py-2"
												value={editCustom?.material ?? "Artsticker"}
												onChange={e => setEditCustom({ ...editCustom, material: e.target.value })}
											>
												<option>Artsticker</option>
												<option>Transparent</option>
												<option>Chrome</option>
												<option>Synthetic</option>
											</select>
										</div>
									</div>
								</div>
							)}

							{editCustom?.category === "Cards" && (
								<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
									<h3 className="font-medium text-sm">Card Specifications</h3>
									<input
										type="text"
										className="w-full border rounded px-3 py-2"
										placeholder="Size"
										value={editCustom?.size ?? ""}
										onChange={e => setEditCustom({ ...editCustom, size: e.target.value })}
									/>
									<div>
										<label className="block text-sm font-medium mb-1">Sides</label>
										<div className="flex items-center gap-4">
											<label className="flex items-center gap-2 text-sm">
												<input
													type="radio"
													name="editCardSides"
													value="single"
													checked={(editCustom?.sides ?? "single") === "single"}
													onChange={() => setEditCustom({ ...editCustom, sides: "single" })}
												/>
												Single side
											</label>
											<label className="flex items-center gap-2 text-sm">
												<input
													type="radio"
													name="editCardSides"
													value="double"
													checked={editCustom?.sides === "double"}
													onChange={() => setEditCustom({ ...editCustom, sides: "double" })}
												/>
												Double side
											</label>
										</div>
									</div>
									<input
										type="text"
										className="w-full border rounded px-3 py-2"
										placeholder="Material"
										value={editCustom?.material ?? ""}
										onChange={e => setEditCustom({ ...editCustom, material: e.target.value })}
									/>
								</div>
							)}

							{editCustom?.category === "Invitation" && (
								<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
									<h3 className="font-medium text-sm">Invitation Specifications</h3>
									<div>
										<label className="block text-sm font-medium mb-2">Size</label>
										<div className="flex items-center gap-2">
											<input type="text" className="flex-1 border rounded px-3 py-2" placeholder="Enter size" value={editCustom?.size ?? ""} onChange={e => setEditCustom({ ...editCustom, size: e.target.value })} />
											<label className="flex items-center gap-2 text-sm">
												<input type="checkbox" checked={editCustom?.existingSize ?? false} onChange={e => setEditCustom({ ...editCustom, existingSize: e.target.checked })} />
												Existing size
											</label>
										</div>
									</div>
									<input type="text" className="w-full border rounded px-3 py-2" placeholder="Material" value={editCustom?.material ?? ""} onChange={e => setEditCustom({ ...editCustom, material: e.target.value })} />
									<input type="text" className="w-full border rounded px-3 py-2" placeholder="Envelope" value={editCustom?.envelope ?? ""} onChange={e => setEditCustom({ ...editCustom, envelope: e.target.value })} />
								</div>
							)}

							{/* Category and Quantity fields */}
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-sm font-medium mb-1">Category</label>
									<select
										className="w-full border rounded px-3 py-2"
										value={editCustom?.category ?? ""}
										onChange={e => setEditCustom({ ...editCustom, category: e.target.value })}
									>
										<option value="">Select type</option>
										<option value="Rigid Boxes">Rigid Boxes</option>
										<option value="Cake Boxes">Cake Boxes</option>
										<option value="Paper Bags">Paper Bags</option>
										<option value="Stickers">Stickers</option>
										<option value="Cards">Cards</option>
										<option value="Invitation">Invitation</option>
									</select>
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">Quantity</label>
									<input
										type="number"
										className="w-full border rounded px-3 py-2"
										placeholder="Quantity"
										value={editCustom?.quantity ?? ""}
										onChange={e => setEditCustom({ ...editCustom, quantity: e.target.valueAsNumber || "" })}
									/>
								</div>
							</div>
						</div>
						<div className="flex gap-2 mt-6">
							<button
								type="button"
								className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
								onClick={() => editQuotation(editingId)}
								disabled={editingId === null}
							>
								Save Changes
							</button>
							<button
								type="button"
								className="px-4 py-2 border rounded hover:bg-gray-50"
								onClick={() => {
									setEditingId(null);
									setEditTitle("");
									setEditDesc("");
									setEditStatus("TODO");
									setEditPriority("MEDIUM");
									setEditCustomerId("");
									setEditAssigneeId("");
									setEditCustom({});
								}}
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Convert to Task Modal */}
			{convertingId && (
				<div 
					className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
					onClick={() => {
						setConvertingId(null);
						setConvertStartAt("");
						setConvertDueAt("");
					}}
				>
					<div 
						className="bg-white rounded-lg p-4 sm:p-6 max-w-sm sm:max-w-md md:max-w-lg w-full max-h-[90vh] sm:max-h-[95vh] overflow-y-auto"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 className="text-xl font-semibold mb-4">Convert Quotation to Task</h2>
						<p className="text-sm text-gray-600 mb-4">Please provide start and due dates for the task:</p>
						<div className="space-y-3">
							<div>
								<label className="block text-sm font-medium mb-1">Start Date</label>
								<DateTimeSelector label="Start" value={convertStartAt} onChange={setConvertStartAt} />
							</div>
							<div>
								<label className="block text-sm font-medium mb-1">Due Date</label>
								<DateTimeSelector label="Due" value={convertDueAt} onChange={setConvertDueAt} />
							</div>
						</div>
						<div className="flex gap-2 mt-6">
							<button
								type="button"
								className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
								onClick={() => convertToTask(convertingId)}
								disabled={convertingId === null}
							>
								{convertingId === null ? "Convert to Task" : "Converting..."}
							</button>
							<button
								type="button"
								className="px-4 py-2 border rounded hover:bg-gray-50"
								onClick={() => {
									setConvertingId(null);
									setConvertStartAt("");
									setConvertDueAt("");
								}}
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
