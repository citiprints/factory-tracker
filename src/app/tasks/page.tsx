// FORCE REBUILD - Loading animations added
"use client";
import React, { useEffect, useState, useRef } from "react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

type Task = {
	id: string;
	title: string;
	description: string;
	status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED" | "ARCHIVED" | "CLIENT_TO_REVERT" | "OTHERS";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	startAt?: string | null;
	dueAt: string | null;
	estimatedHours?: number | null;
	actualHours?: number | null;
	customerId?: string | null;
	customerRef?: { id: string; name: string; email: string } | null;
	jobNumber?: string | null;
	customFields?: any;
	assignments?: { id: string; user: { id: string; name: string }; role: string }[];
	subtasks?: Subtask[];
	createdAt: string;
	updatedAt: string;
};

type Subtask = {
	id: string;
	title: string;
	status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
	assigneeId?: string | null;
	dueAt?: string | null;
	order: number;
};

type Field = { id: string; key: string; label: string; type: string; required: boolean; order: number };

// Loading skeleton component
function TasksSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header skeleton */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div className="animate-pulse">
					<div className="h-8 bg-gray-200 rounded w-48"></div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="animate-pulse">
						<div className="h-10 bg-gray-200 rounded w-32"></div>
					</div>
					<div className="animate-pulse">
						<div className="h-10 bg-gray-200 rounded w-24"></div>
					</div>
				</div>
			</div>

			{/* Filters skeleton */}
			<div className="flex flex-wrap items-center gap-4">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="animate-pulse">
						<div className="h-8 bg-gray-200 rounded w-24"></div>
					</div>
				))}
			</div>

			{/* Tasks skeleton */}
			<div className="space-y-4">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="border border-gray-200 rounded-lg p-4">
						<div className="animate-pulse">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
								<div className="flex flex-wrap items-center gap-2 min-w-0">
									<div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0"></div>
									<div className="h-4 bg-gray-200 rounded w-64 sm:w-96 max-w-full"></div>
									<div className="h-4 bg-gray-200 rounded w-16 flex-shrink-0"></div>
									<div className="h-4 bg-gray-200 rounded w-20 flex-shrink-0"></div>
								</div>
								<div className="flex flex-col items-end gap-1 flex-shrink-0">
									<div className="h-4 bg-gray-200 rounded w-20"></div>
									<div className="h-4 bg-gray-200 rounded w-16"></div>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default function TasksPage() {
	const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [fields, setFields] = useState<Field[]>([]);
	const [loading, setLoading] = useState(true);
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [paymentFilter, setPaymentFilter] = useState<string>("all");
	const [assignedToMeOnly, setAssignedToMeOnly] = useState<boolean>(false);
	const [title, setTitle] = useState("");
	const [desc, setDesc] = useState("");
	const [start, setStart] = useState<string>("");
	const [due, setDue] = useState<string>("");
	const [custom, setCustom] = useState<Record<string, any>>({});
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTask, setEditingTask] = useState<Task | null>(null);
	const [viewingId, setViewingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [editDesc, setEditDesc] = useState("");
	const [editStatus, setEditStatus] = useState<Task["status"]>("TODO");
	const [editStart, setEditStart] = useState<string>("");
	const [editDue, setEditDue] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);
	const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
	const [customerId, setCustomerId] = useState<string>("");
	const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
	const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
	const [newCustomerName, setNewCustomerName] = useState("");
	const [newCustomerEmail, setNewCustomerEmail] = useState("");
	const [newCustomerPhone, setNewCustomerPhone] = useState("");
	const [newCustomerCompany, setNewCustomerCompany] = useState("");
	const [newCustomerAddress, setNewCustomerAddress] = useState("");
	const [assigneeId, setAssigneeId] = useState<string>("");
	const [isQuotation, setIsQuotation] = useState<boolean>(false);
	const [files, setFiles] = useState<File[]>([]);
	const [dragActive, setDragActive] = useState(false);
	
	// Subtask state
	const [subtaskTitle, setSubtaskTitle] = useState("");
	const [subtaskAssigneeId, setSubtaskAssigneeId] = useState<string>("");
	const [subtaskDueAt, setSubtaskDueAt] = useState<string>("");
	const [subtaskEstimatedHours, setSubtaskEstimatedHours] = useState<number | null>(null);
	const [addingSubtaskToTaskId, setAddingSubtaskToTaskId] = useState<string | null>(null);
	
	// Subtask editing state
	const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
	const [editSubtaskTitle, setEditSubtaskTitle] = useState("");
	const [editSubtaskAssigneeId, setEditSubtaskAssigneeId] = useState<string>("");
	const [editSubtaskDueAt, setEditSubtaskDueAt] = useState<string>("");
	const [editSubtaskEstimatedHours, setEditSubtaskEstimatedHours] = useState<number | null>(null);

	const AUTO_REFRESH_SECONDS = 120;
	const [groupBy, setGroupBy] = useState<"none"|"category"|"customer"|"status"|"assignee">("none");
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [anyDatePickerOpen, setAnyDatePickerOpen] = useState(false);
	const countdownRef = useRef(AUTO_REFRESH_SECONDS);
	const displayRef = useRef<HTMLSpanElement>(null);

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

	function toggleSelect(id: string) {
		setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
	}

	function isSelected(id: string) {
		return selectedIds.includes(id);
	}

	function clearSelection() {
		setSelectedIds([]);
	}

	// selection helpers are recomputed later after listForRender
	function toggleSelectAllOnPage() {
		if (allSelectedOnPage) {
			setSelectedIds(prev => prev.filter(id => !allVisibleIds.includes(id)));
		} else {
			setSelectedIds(prev => Array.from(new Set([...prev, ...allVisibleIds])));
		}
	}

	async function createNewCustomer() {
		if (!newCustomerName.trim()) return;
		
		try {
			const res = await fetch("/api/customers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newCustomerName,
					email: newCustomerEmail,
					phone: newCustomerPhone,
					company: newCustomerCompany,
					address: newCustomerAddress
				})
			});
			
			if (res.ok) {
				const { customer } = await res.json();
				setCustomers(prev => [...prev, customer]);
				setCustomerId(customer.id);
				setShowNewCustomerForm(false);
				setNewCustomerName("");
				setNewCustomerEmail("");
				setNewCustomerPhone("");
				setNewCustomerCompany("");
				setNewCustomerAddress("");
				setError(null);
			} else {
				const errorData = await res.json();
				if (errorData.error && typeof errorData.error === 'object') {
					// Handle Zod validation errors
					const zodError = errorData.error;
					if (zodError.fieldErrors) {
						const fieldErrors = Object.entries(zodError.fieldErrors)
							.map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
							.join('; ');
						setError(fieldErrors || "Validation failed");
					} else if (zodError.formErrors) {
						setError(Array.isArray(zodError.formErrors) ? zodError.formErrors.join('; ') : "Validation failed");
					} else {
						setError("Failed to create customer");
					}
				} else {
					setError(errorData.error || "Failed to create customer");
				}
			}
		} catch (err) {
			setError("Failed to create customer");
		}
	}

	async function load() {
		setLoading(true);
		try {
			const [resTasks, resFields, resCustomers, resUsers] = await Promise.all([
				fetch("/api/tasks?limit=100&includeArchived=false&includeQuotations=false"),
				fetch("/api/custom-fields"),
				fetch("/api/customers"),
				fetch("/api/users")
			]);
			
		if (resTasks.ok) {
			const json = await resTasks.json();
				const loaded: Task[] = (json.tasks ?? []).map((t: any) => ({
					...t,
					subtasks: t.subtasks ?? [],
					customFields: typeof t.customFields === "string" ? (() => { try { return JSON.parse(t.customFields); } catch { return {}; } })() : (t.customFields || {})
				}));
				setTasks(loaded);
			}
			
		if (resFields.ok) {
			const json = await resFields.json();
			setFields(json.fields ?? []);
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

	// Function to notify layout about data changes
	function notifyDataChange() {
		window.dispatchEvent(new Event('dataChanged'));
	}

	useEffect(() => {
		load();
	}, []);

	// Auto refresh with countdown - NO RE-RENDER VERSION
	useEffect(() => {
		const id = setInterval(() => {
			countdownRef.current--;
			
			// Update display directly without state change
			if (displayRef.current) {
				displayRef.current.textContent = `Auto refresh in ${countdownRef.current}s`;
			}
			
			if (countdownRef.current <= 0) {
				// Only refresh if the page is not in a loading state
				if (!loading) {
					load();
				}
				countdownRef.current = AUTO_REFRESH_SECONDS;
			}
		}, 1000);
		
		return () => clearInterval(id);
	}, [loading]);

	// Helper function to check if task is assigned to current user
	function isAssignedToMe(task: Task): boolean {
		if (!currentUser || !task.assignments) return false;
		return task.assignments.some(assignment => assignment.user.id === currentUser.id);
	}

	// Derived filtered tasks (category + payment + assigned to me)
	const filteredTasks = tasks
		.filter(task => categoryFilter === "all" || task.customFields?.category === categoryFilter)
		.filter(task => {
			if (paymentFilter === "all") return true;
			const ps = task.customFields?.paymentStatus || "NO_PAYMENT_RECEIVED";
			return (
				(paymentFilter === "NO_PAYMENT_RECEIVED" && ps === "NO_PAYMENT_RECEIVED") ||
				(paymentFilter === "ADVANCE_RECEIVED" && ps === "ADVANCE_RECEIVED") ||
				(paymentFilter === "FULL_PAYMENT_RECEIVED" && ps === "FULL_PAYMENT_RECEIVED")
			);
		})
		.filter(task => (!assignedToMeOnly ? true : isAssignedToMe(task)));

	function getGroupKey(t: Task): string {
		switch (groupBy) {
			case "category": return t.customFields?.category || "Uncategorized";
			case "customer": return t.customerRef?.name || "No Customer";
			case "status": return t.status;
			case "assignee": return (t.assignments && t.assignments[0]?.user?.name) || "Unassigned";
			default: return "";
		}
	}

	function getGroupColorClasses(key: string): { bar: string; bg: string; dot: string } {
		const palette = [
			{ bar: "border-blue-500", bg: "bg-blue-50", dot: "bg-blue-500" },
			{ bar: "border-green-500", bg: "bg-green-50", dot: "bg-green-500" },
			{ bar: "border-amber-500", bg: "bg-amber-50", dot: "bg-amber-500" },
			{ bar: "border-purple-500", bg: "bg-purple-50", dot: "bg-purple-500" },
			{ bar: "border-pink-500", bg: "bg-pink-50", dot: "bg-pink-500" },
			{ bar: "border-teal-500", bg: "bg-teal-50", dot: "bg-teal-500" },
			{ bar: "border-indigo-500", bg: "bg-indigo-50", dot: "bg-indigo-500" },
			{ bar: "border-rose-500", bg: "bg-rose-50", dot: "bg-rose-500" },
			{ bar: "border-cyan-500", bg: "bg-cyan-50", dot: "bg-cyan-500" },
			{ bar: "border-lime-500", bg: "bg-lime-50", dot: "bg-lime-500" },
			{ bar: "border-sky-500", bg: "bg-sky-50", dot: "bg-sky-500" },
			{ bar: "border-violet-500", bg: "bg-violet-50", dot: "bg-violet-500" },
			{ bar: "border-fuchsia-500", bg: "bg-fuchsia-50", dot: "bg-fuchsia-500" },
			{ bar: "border-emerald-500", bg: "bg-emerald-50", dot: "bg-emerald-500" },
			{ bar: "border-orange-500", bg: "bg-orange-50", dot: "bg-orange-500" },
			{ bar: "border-yellow-500", bg: "bg-yellow-50", dot: "bg-yellow-500" },
			{ bar: "border-stone-500", bg: "bg-stone-50", dot: "bg-stone-500" },
			{ bar: "border-slate-500", bg: "bg-slate-50", dot: "bg-slate-500" },
			{ bar: "border-zinc-500", bg: "bg-zinc-50", dot: "bg-zinc-500" },
		];
		let hash = 0;
		for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
		const idx = hash % palette.length;
		return palette[idx];
	}

	const listForRender = React.useMemo(() => {
		if (groupBy === "none") return filteredTasks;
		const arr = [...filteredTasks];
		arr.sort((a, b) => {
			const ak = getGroupKey(a);
			const bk = getGroupKey(b);
			if (ak !== bk) return ak.localeCompare(bk);
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
		return arr;
	}, [filteredTasks, groupBy]);

	// now that listForRender is known, recompute selection helpers
	const allVisibleIds = React.useMemo(() => listForRender.map(t => t.id), [listForRender]);
	const allSelectedOnPage = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id));

	const grouped = React.useMemo(() => {
		if (groupBy === "none") return [] as { key: string; items: Task[] }[];
		const groups: { key: string; items: Task[] }[] = [];
		let currentKey = "";
		let bucket: Task[] = [];
		for (const t of listForRender) {
			const k = getGroupKey(t);
			if (k !== currentKey) {
				if (bucket.length) groups.push({ key: currentKey, items: bucket });
				currentKey = k;
				bucket = [t];
			} else {
				bucket.push(t);
			}
		}
		if (bucket.length) groups.push({ key: currentKey, items: bucket });
		return groups;
	}, [listForRender, groupBy]);

	// Subtask functions
	async function createSubtask(taskId: string) {
		if (!subtaskTitle.trim()) return;
		
		const res = await fetch("/api/subtasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				taskId,
				title: subtaskTitle,
				assigneeId: subtaskAssigneeId || null,
				dueAt: subtaskDueAt || null,
				estimatedHours: subtaskEstimatedHours || null
			})
		});
		
		if (res.ok) {
			setSubtaskTitle("");
			setSubtaskAssigneeId("");
			setSubtaskDueAt("");
			setSubtaskEstimatedHours(null);
			setAddingSubtaskToTaskId(null);
			load(); // Reload to get updated subtasks
		}
	}

	async function updateSubtaskStatus(subtaskId: string, status: Subtask["status"]) {
		const res = await fetch(`/api/subtasks/${subtaskId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status })
		});
		
		if (res.ok) {
			load(); // Reload to get updated subtasks
		}
	}

	async function deleteSubtask(subtaskId: string) {
		if (!confirm("Delete this subtask?")) return;
		
		const res = await fetch(`/api/subtasks/${subtaskId}`, {
			method: "DELETE"
		});
		
		if (res.ok) {
			load(); // Reload to get updated subtasks
		}
	}

	async function updateSubtask(subtaskId: string) {
		if (!editSubtaskTitle.trim()) return;
		
		const res = await fetch(`/api/subtasks/${subtaskId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: editSubtaskTitle,
				assigneeId: editSubtaskAssigneeId || null,
				dueAt: editSubtaskDueAt || null,
				estimatedHours: editSubtaskEstimatedHours || null
			})
		});
		
		if (res.ok) {
			setEditingSubtaskId(null);
			setEditSubtaskTitle("");
			setEditSubtaskAssigneeId("");
			setEditSubtaskDueAt("");
			setEditSubtaskEstimatedHours(null);
			load(); // Reload to get updated subtasks
		}
	}

	// File upload handlers
	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
		}
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
		}
	};

	const removeFile = (index: number) => {
		setFiles(prev => prev.filter((_, i) => i !== index));
	};

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
		
		// Handle file uploads first
		const uploadedFiles: string[] = [];
		for (const file of files) {
			const formData = new FormData();
			formData.append('file', file);
			try {
				const uploadRes = await fetch('/api/upload', {
					method: 'POST',
					body: formData
				});
				if (uploadRes.ok) {
					const uploadResult = await uploadRes.json();
					// Prefer URL from R2 upload; fallback to local path for legacy
					uploadedFiles.push(uploadResult.url || `/uploads/${uploadResult.filename}`);
				}
			} catch (error) {
				console.error('File upload failed:', error);
			}
		}

		const res = await fetch("/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ 
				title, 
				description: desc, 
				startAt: isQuotation ? null : (start ? new Date(start).toISOString() : undefined), 
				dueAt: isQuotation ? null : (due ? new Date(due).toISOString() : undefined), 
				customerId: customerId || undefined, 
				customFields: { ...custom, attachments: uploadedFiles, isQuotation }, 
				assigneeId: assigneeId || undefined 
			})
		});
		setSubmitting(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Failed to create task");
			return;
		}
		setTitle("");
		setDesc("");
		setStart("");
		setDue("");
		setCustomerId("");
		setAssigneeId("");
		setIsQuotation(false);
		setCustom({});
		setFiles([]);
		setShowNewCustomerForm(false);
		setNewCustomerName("");
		setNewCustomerEmail("");
		setNewCustomerPhone("");
		load();
		notifyDataChange();
	}

	function DateTimeSelector({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
		const [open, setOpen] = useState(false);
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
					key={`d-${d}`}
					type="button"
					className={`px-2 py-1 rounded text-sm ${selected ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`}
					onClick={() => updateDate(ymd)}
				>
					{d}
				</button>
			);
		}

		const hour = timePart ? (timePart.split(":")[0] || "00") : "";
		const minute = timePart ? (timePart.split(":")[1] || "00") : "";
		const minuteOptions = ["00","15","30","45"];

		const display = value ? new Date(value).toLocaleString() : `Select ${label}`;

		return (
			<div className="relative cursor-pointer" onClick={() => setOpen(v => !v)}>
				<div className="w-full border rounded px-3 py-2 text-left">
					<span className="block text-xs text-gray-600">{label}</span>
					<span>{display}</span>
				</div>
				{open && (
					<div className="absolute z-10 mt-1 w-72 rounded border bg-white p-3 shadow" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center justify-between mb-2">
							<button type="button" className="px-2 py-1 rounded border" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>{"<"}</button>
							<div className="text-sm font-medium">{monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
							<button type="button" className="px-2 py-1 rounded border" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>{">"}</button>
						</div>
						<div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-600 mb-1">
							<div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
						</div>
						<div className="grid grid-cols-7 gap-1 mb-3">
							{dayButtons}
						</div>
						<div className="flex items-center gap-2">
							<select className="border rounded px-2 py-1 text-sm" value={hour} onChange={e => updateTime(`${e.target.value || "00"}:${minute || "00"}`)}>
								<option value="">HH</option>
								{Array.from({length:24}).map((_,h) => {
									const hv = `${h}`.padStart(2, "0");
									return <option key={hv} value={hv}>{hv}</option>;
								})}
							</select>
							<select className="border rounded px-2 py-1 text-sm" value={minute} onChange={e => updateTime(`${hour || "00"}:${e.target.value}`)}>
								<option value="">MM</option>
								{minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}
							</select>
							<button type="button" className="ml-auto text-sm px-2 py-1" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
							<button type="button" className="text-sm px-2 py-1 rounded bg-gray-900 text-white" onClick={() => setOpen(false)}>Done</button>
						</div>
					</div>
				)}
			</div>
		);
	}

	async function deleteTask(id: string) {
		if (!confirm("Are you sure you want to delete this task?")) return;
		
		setDeletingId(id);
		try {
			const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
			if (res.ok) {
				setTasks(prev => prev.filter(t => t.id !== id));
				setError(null);
				notifyDataChange();
			} else {
				const errorData = await res.json();
				setError(errorData.error || "Failed to delete task");
			}
		} catch (err) {
			setError("Failed to delete task");
		} finally {
			setDeletingId(null);
		}
	}

	async function duplicateTask(task: Task) {
		setDuplicatingId(task.id);
		try {
			// Create a copy of the task with "(Copy)" appended to title
			const duplicatedTask = {
				title: `${task.title} (Copy)`,
				description: task.description || "",
				status: "TODO", // Reset status to TODO
				priority: task.priority || "MEDIUM",
				startAt: task.startAt || undefined,
				dueAt: task.dueAt || undefined,
				customerId: task.customerId || undefined,
				customFields: task.customFields || {},
				assigneeId: task.assignments?.[0]?.user.id || undefined
			};
			
			const res = await fetch("/api/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(duplicatedTask)
			});
			
			if (res.ok) {
				const { task: newTask } = await res.json();
				const newTaskWithDefaults = {
					...newTask,
					subtasks: newTask.subtasks ?? [],
					customFields: typeof newTask.customFields === "string" ? (() => { try { return JSON.parse(newTask.customFields); } catch { return {}; } })() : (newTask.customFields || {})
				};
				
				// Insert the duplicated task right after the original task
				setTasks(prev => {
					const originalIndex = prev.findIndex(t => t.id === task.id);
					if (originalIndex === -1) {
						return [...prev, newTaskWithDefaults];
					}
					const newTasks = [...prev];
					newTasks.splice(originalIndex + 1, 0, newTaskWithDefaults);
					return newTasks;
				});
				setError(null);
				notifyDataChange();
			} else {
				const errorData = await res.json();
				setError(errorData.error || "Failed to duplicate task");
			}
		} catch (err) {
			setError("Failed to duplicate task");
		} finally {
			setDuplicatingId(null);
		}
	}

	return (
		<div className="grid gap-6 sm:grid-cols-2">
			<section className="relative">
				{editingId && (
					<div className="absolute inset-0 bg-gray-200 bg-opacity-75 z-10 flex items-center justify-center">
						<div className="bg-white rounded-lg p-4 shadow-lg">
							<p className="text-gray-600 font-medium">Editing task...</p>
						</div>
					</div>
				)}
				<h1 className="text-xl font-semibold mb-3">Create task</h1>
				
				{/* Quotation checkbox */}
				<label className="flex items-center gap-2 mb-3">
					<input
						type="checkbox"
						checked={isQuotation}
						onChange={e => setIsQuotation(e.target.checked)}
					/>
					<span className="text-sm">Quotation</span>
				</label>
				
				<form onSubmit={onCreate} className="space-y-3">
					<input className="w-full border rounded px-3 py-2" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
					<textarea className="w-full border rounded px-3 py-2" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
					{showNewCustomerForm ? (
						<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
							<div className="flex items-center justify-between">
								<h3 className="font-medium text-sm">Add New Customer</h3>
								<button
									type="button"
									onClick={() => {
										setShowNewCustomerForm(false);
										setNewCustomerName("");
										setNewCustomerEmail("");
										setNewCustomerPhone("");
										setNewCustomerCompany("");
										setNewCustomerAddress("");
										setError(null);
									}}
									className="text-sm text-gray-500 hover:text-gray-700"
								>
									Cancel
								</button>
							</div>
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Customer name *"
								value={newCustomerName}
								onChange={e => setNewCustomerName(e.target.value)}
								required
							/>
							<input
								type="email"
								className="w-full border rounded px-3 py-2"
								placeholder="Email (optional)"
								value={newCustomerEmail}
								onChange={e => setNewCustomerEmail(e.target.value)}
							/>
							<input
								type="tel"
								className="w-full border rounded px-3 py-2"
								placeholder="Phone (optional)"
								value={newCustomerPhone}
								onChange={e => setNewCustomerPhone(e.target.value)}
							/>
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Company (optional)"
								value={newCustomerCompany}
								onChange={e => setNewCustomerCompany(e.target.value)}
							/>
							<textarea
								className="w-full border rounded px-3 py-2"
								placeholder="Address (optional)"
								value={newCustomerAddress}
								onChange={e => setNewCustomerAddress(e.target.value)}
								rows={3}
							/>
							{error && <p className="text-sm text-red-600">{error}</p>}
							<button
								type="button"
								onClick={createNewCustomer}
								className="w-full bg-blue-600 text-white py-2 px-3 rounded hover:bg-blue-700"
							>
								Create Customer
							</button>
						</div>
					) : (
						<select className="w-full border rounded px-3 py-2" value={customerId} onChange={e => {
							if (e.target.value === "add-new") {
								setShowNewCustomerForm(true);
								setCustomerId("");
							} else {
								setCustomerId(e.target.value);
							}
						}}>
							<option value="">Select customer (optional)</option>
							{customers.map(c => (
								<option key={c.id} value={c.id}>{c.name}</option>
							))}
							<option value="add-new">➕ Add New Customer</option>
						</select>
					)}
					<select className="w-full border rounded px-3 py-2" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
						<option value="">Assign to user (optional)</option>
						{users.map(u => (
							<option key={u.id} value={u.id}>{u.name}</option>
						))}
					</select>
					
					<select
						className="w-full border rounded px-3 py-2"
						value={custom["category"] ?? ""}
						onChange={e => setCustom({ ...custom, category: e.target.value })}
					>
						<option value="">Select type</option>
						<option value="Rigid Boxes">Rigid Boxes</option>
						<option value="Cake Boxes">Cake Boxes</option>
						<option value="Paper Bags">Paper Bags</option>
						<option value="Stickers">Stickers</option>
						<option value="Cards">Cards</option>
						<option value="Invitation">Invitation</option>
					</select>
					
					{/* Quantity field */}
					<input 
						type="number" 
						className="w-full border rounded px-3 py-2" 
						placeholder="Quantity" 
						value={custom["quantity"] ?? ""} 
						onChange={e => setCustom({ ...custom, quantity: e.target.valueAsNumber || "" })} 
					/>

					{/* Rigid Box specific fields */}
					{custom["category"] === "Rigid Boxes" && (
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
												name="boxType"
												value={type}
												checked={custom["boxType"] === type}
												onChange={e => setCustom({ ...custom, boxType: e.target.value })}
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
										value={custom["size"] ?? ""}
										onChange={e => setCustom({ ...custom, size: e.target.value })}
									/>
									<label className="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={custom["existingSize"] ?? false}
											onChange={e => setCustom({ ...custom, existingSize: e.target.checked })}
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
								value={custom["topOuter"] ?? ""}
								onChange={e => setCustom({ ...custom, topOuter: e.target.value })}
							/>

							{/* Top Inner */}
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Top Inner"
								value={custom["topInner"] ?? ""}
								onChange={e => setCustom({ ...custom, topInner: e.target.value })}
							/>

							{/* Bottom Outer */}
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Bottom Outer"
								value={custom["bottomOuter"] ?? ""}
								onChange={e => setCustom({ ...custom, bottomOuter: e.target.value })}
							/>

							{/* Bottom Inner */}
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Bottom Inner"
								value={custom["bottomInner"] ?? ""}
								onChange={e => setCustom({ ...custom, bottomInner: e.target.value })}
							/>

							{/* Partition */}
							<div>
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={custom["hasPartition"] ?? false}
										onChange={e => setCustom({ ...custom, hasPartition: e.target.checked })}
									/>
									Partition
								</label>
								{custom["hasPartition"] && (
									<textarea
										className="w-full border rounded px-3 py-2 mt-2"
										placeholder="Partition description"
										value={custom["partitionDescription"] ?? ""}
										onChange={e => setCustom({ ...custom, partitionDescription: e.target.value })}
									/>
								)}
							</div>
						</div>
					)}

					{custom["category"] === "Cake Boxes" && (
						<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
							<h3 className="font-medium text-sm">Cake Box Specifications</h3>
							<div>
								<label className="block text-sm font-medium mb-2">Size</label>
								<div className="flex items-center gap-2">
									<input
										type="text"
										className="flex-1 border rounded px-3 py-2"
										placeholder="Enter size"
										value={custom["size"] ?? ""}
										onChange={e => setCustom({ ...custom, size: e.target.value })}
									/>
									<label className="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={custom["existingSize"] ?? false}
											onChange={e => setCustom({ ...custom, existingSize: e.target.checked })}
										/>
										Existing size
									</label>
								</div>
							</div>
							<div>
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={custom["hasWindow"] ?? false}
										onChange={e => setCustom({ ...custom, hasWindow: e.target.checked })}
									/>
									Window
								</label>
								{custom["hasWindow"] && (
									<input
										type="text"
										className="w-full border rounded px-3 py-2 mt-2"
										placeholder="Window details"
										value={custom["windowDetails"] ?? ""}
										onChange={e => setCustom({ ...custom, windowDetails: e.target.value })}
									/>
								)}
							</div>
							<div>
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={custom["innerPrinting"] ?? false}
										onChange={e => setCustom({ ...custom, innerPrinting: e.target.checked })}
									/>
									Inner Printing
								</label>
								{custom["innerPrinting"] && (
									<input
										type="text"
										className="w-full border rounded px-3 py-2 mt-2"
										placeholder="Inner printing details"
										value={custom["innerPrintingDetails"] ?? ""}
										onChange={e => setCustom({ ...custom, innerPrintingDetails: e.target.value })}
									/>
								)}
							</div>
						</div>
					)}

					{custom["category"] === "Paper Bags" && (
						<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
							<h3 className="font-medium text-sm">Paper Bag Specifications</h3>
							<div>
								<label className="block text-sm font-medium mb-2">Size</label>
								<div className="flex items-center gap-2">
									<input
										type="text"
										className="flex-1 border rounded px-3 py-2"
										placeholder="Enter size"
										value={custom["size"] ?? ""}
										onChange={e => setCustom({ ...custom, size: e.target.value })}
									/>
									<label className="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={custom["existingSize"] ?? false}
											onChange={e => setCustom({ ...custom, existingSize: e.target.checked })}
										/>
										Existing size
									</label>
								</div>
							</div>
							<div>
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={custom["innerPrinting"] ?? false}
										onChange={e => setCustom({ ...custom, innerPrinting: e.target.checked })}
									/>
									Inner Printing
								</label>
								{custom["innerPrinting"] && (
									<input
										type="text"
										className="w-full border rounded px-3 py-2 mt-2"
										placeholder="Inner printing details"
										value={custom["innerPrintingDetails"] ?? ""}
										onChange={e => setCustom({ ...custom, innerPrintingDetails: e.target.value })}
									/>
								)}
							</div>
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Rope details"
								value={custom["rope"] ?? ""}
								onChange={e => setCustom({ ...custom, rope: e.target.value })}
							/>
						</div>
					)}

					{custom["category"] === "Stickers" && (
						<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
							<h3 className="font-medium text-sm">Sticker Specifications</h3>
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Size"
								value={custom["size"] ?? ""}
								onChange={e => setCustom({ ...custom, size: e.target.value })}
							/>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-sm font-medium mb-1">Shape</label>
									<select
										className="w-full border rounded px-3 py-2"
										value={custom["shape"] ?? "Rectangle"}
										onChange={e => setCustom({ ...custom, shape: e.target.value })}
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
										value={custom["material"] ?? "Artsticker"}
										onChange={e => setCustom({ ...custom, material: e.target.value })}
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

					{custom["category"] === "Cards" && (
						<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
							<h3 className="font-medium text-sm">Card Specifications</h3>
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Size"
								value={custom["size"] ?? ""}
								onChange={e => setCustom({ ...custom, size: e.target.value })}
							/>
							<div>
								<label className="block text-sm font-medium mb-1">Sides</label>
								<div className="flex items-center gap-4">
									<label className="flex items-center gap-2 text-sm">
										<input
											type="radio"
											name="cardSides"
											value="single"
											checked={(custom["sides"] ?? "single") === "single"}
											onChange={() => setCustom({ ...custom, sides: "single" })}
										/>
										Single side
									</label>
									<label className="flex items-center gap-2 text-sm">
										<input
											type="radio"
											name="cardSides"
											value="double"
											checked={custom["sides"] === "double"}
											onChange={() => setCustom({ ...custom, sides: "double" })}
										/>
										Double side
									</label>
								</div>
							</div>
							<input
								type="text"
								className="w-full border rounded px-3 py-2"
								placeholder="Material"
								value={custom["material"] ?? ""}
								onChange={e => setCustom({ ...custom, material: e.target.value })}
							/>
						</div>
					)}

					{custom["category"] === "Invitation" && (
						<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
							<h3 className="font-medium text-sm">Invitation Specifications</h3>
							<div>
								<label className="block text-sm font-medium mb-2">Size</label>
								<div className="flex items-center gap-2">
									<input type="text" className="flex-1 border rounded px-3 py-2" placeholder="Enter size" value={custom["size"] ?? ""} onChange={e => setCustom({ ...custom, size: e.target.value })} />
									<label className="flex items-center gap-2 text-sm">
										<input type="checkbox" checked={custom["existingSize"] ?? false} onChange={e => setCustom({ ...custom, existingSize: e.target.checked })} />
										Existing size
									</label>
								</div>
							</div>
							<input type="text" className="w-full border rounded px-3 py-2" placeholder="Material" value={custom["material"] ?? ""} onChange={e => setCustom({ ...custom, material: e.target.value })} />
							<input type="text" className="w-full border rounded px-3 py-2" placeholder="Envelope" value={custom["envelope"] ?? ""} onChange={e => setCustom({ ...custom, envelope: e.target.value })} />
						</div>
					)}

					{!isQuotation && (
						<>
							<DateTimeSelector label="Start" value={start} onChange={setStart} />
							<DateTimeSelector label="Due" value={due} onChange={setDue} />
						</>
					)}

					{/* File Upload */}
					<div
						className={`border-2 border-dashed rounded-lg p-4 text-center ${
							dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
						}`}
						onDragEnter={handleDrag}
						onDragLeave={handleDrag}
						onDragOver={handleDrag}
						onDrop={handleDrop}
					>
						<input
							type="file"
							multiple
							onChange={handleFileSelect}
							className="hidden"
							id="file-upload"
						/>
						<label htmlFor="file-upload" className="cursor-pointer">
							<div className="text-gray-600">
								<p>Drag and drop files here, or click to select files</p>
							</div>
						</label>
					</div>

					{/* File list */}
					{files.length > 0 && (
						<div className="space-y-2">
							<h4 className="text-sm font-medium">Selected Files:</h4>
							{files.map((file, index) => (
								<div key={index} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-100 rounded">
									<span className="text-sm truncate max-w-[60vw]">{file.name}</span>
									<button
										type="button"
										onClick={() => removeFile(index)}
										className="text-red-600 text-sm"
									>
										Remove
									</button>
								</div>
							))}
						</div>
					)}

					<div className="space-y-2">
						{fields.map(f => (
							<div key={f.id} className="text-sm">
								<label className="block mb-1">{f.label}</label>
								{f.type === "TEXT" && (
									<input className="w-full border rounded px-3 py-2" value={custom[f.key] ?? ""} onChange={e => setCustom({ ...custom, [f.key]: e.target.value })} />
								)}
								{f.type === "NUMBER" && (
									<input type="number" className="w-full border rounded px-3 py-2" value={custom[f.key] ?? ""} onChange={e => setCustom({ ...custom, [f.key]: e.target.valueAsNumber })} />
								)}
								{f.type === "DATE" && (
									<input type="date" className="w-full border rounded px-3 py-2" value={custom[f.key] ?? ""} onChange={e => setCustom({ ...custom, [f.key]: e.target.value })} />
								)}
								{f.type === "BOOLEAN" && (
									<label className="flex items-center gap-2"><input type="checkbox" checked={!!custom[f.key]} onChange={e => setCustom({ ...custom, [f.key]: e.target.checked })} /> {f.label}</label>
								)}
							</div>
						))}
					</div>
					{error && <p className="text-sm text-red-600">{error}</p>}
					<button type="submit" className="w-full bg-black text-white py-2 px-3 rounded hover:bg-gray-800 disabled:opacity-50" disabled={submitting}>
						{submitting ? "Creating..." : "Create task"}
					</button>
				</form>
			</section>
			<section>
				<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
					<h2 className="text-lg font-medium">Tasks</h2>
					<div className="flex flex-wrap items-center gap-2">
						{selectedIds.length > 0 && (
							<>
								<button
									type="button"
									className="rounded border px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200"
									onClick={async () => {
										if (!confirm(`Archive ${selectedIds.length} task${selectedIds.length !== 1 ? 's' : ''}?`)) return;
										for (const id of selectedIds) {
											await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ status: "ARCHIVED" }) });
										}
										clearSelection();
										load();
									}}
								>
									Bulk Archive ({selectedIds.length})
								</button>
								<button
									type="button"
									className="rounded border px-3 py-2 text-sm hover:bg-red-50 text-red-700 border-red-300"
									onClick={async () => {
										if (!confirm(`Delete ${selectedIds.length} task${selectedIds.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
										for (const id of selectedIds) {
											await fetch(`/api/tasks/${id}`, { method: "DELETE" });
										}
										clearSelection();
										load();
									}}
								>
									Bulk Delete ({selectedIds.length})
								</button>
							</>
						)}
						<span className="text-xs text-gray-600" ref={displayRef}>Auto refresh in {AUTO_REFRESH_SECONDS}s</span>
						<button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => { countdownRef.current = AUTO_REFRESH_SECONDS; load(); }}>Refresh now</button>

					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 mb-3">
					<button
						onClick={async () => {
							const completedTasks = filteredTasks.filter(t => t.status === "DONE");
							if (completedTasks.length === 0) {
								alert("No completed tasks to archive.");
								return;
							}
							if (confirm(`Archive ${completedTasks.length} completed task${completedTasks.length !== 1 ? 's' : ''}?`)) {
								for (const task of completedTasks) {
									await fetch(`/api/tasks/${task.id}`, {
										method: "PATCH",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ status: "ARCHIVED" })
									});
								}
								load();
							}
						}}
						className="rounded border px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200"
					>
						Archive Completed ({filteredTasks.filter(t => t.status === "DONE").length})
					</button>
						<a className="rounded border px-3 py-2 text-sm" href="/api/export/tasks-csv">Export CSV</a>
						<form action="/api/export/tasks-sheets" method="post" className="inline">
						<button className="rounded border px-3 py-2 text-sm" type="submit">Export to Google Sheets</button>
						</form>
					</div>
				
				{/* Filters row */}
				<div className="mb-4 flex items-end justify-between gap-4">
					<div className="flex flex-wrap items-end gap-4">
						<div>
							<label className="block text-sm font-medium mb-2">Filter by Category:</label>
							<select 
								value={categoryFilter} 
								onChange={(e) => setCategoryFilter(e.target.value)}
								className="rounded border px-3 py-2 text-sm"
							>
								<option value="all">All Categories</option>
								<option value="Rigid Boxes">Rigid Boxes</option>
								<option value="Cake Boxes">Cake Boxes</option>
								<option value="Paper Bags">Paper Bags</option>
								<option value="Stickers">Stickers</option>
								<option value="Cards">Cards</option>
								<option value="Invitation">Invitation</option>
								<option value="Others">Others</option>
							</select>
				</div>
						<div>
							<label className="block text-sm font-medium mb-2">Filter by Payment Status:</label>
							<select 
								value={paymentFilter} 
								onChange={(e) => setPaymentFilter(e.target.value)}
								className="rounded border px-3 py-2 text-sm"
							>
								<option value="all">All Payments</option>
								<option value="NO_PAYMENT_RECEIVED">No Payment Received</option>
								<option value="ADVANCE_RECEIVED">Advance Received</option>
								<option value="FULL_PAYMENT_RECEIVED">Full Payment Received</option>
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium mb-2">Group by:</label>
							<select
								value={groupBy}
								onChange={(e) => setGroupBy(e.target.value as any)}
								className="rounded border px-3 py-2 text-sm"
							>
								<option value="none">None</option>
								<option value="category">Category</option>
								<option value="customer">Customer</option>
								<option value="status">Status</option>
								<option value="assignee">Assignee</option>
							</select>
						</div>
						<label className="flex items-center gap-2 text-sm mb-2">
							<input type="checkbox" checked={assignedToMeOnly} onChange={(e) => setAssignedToMeOnly(e.target.checked)} />
							Assigned to me only
						</label>
					</div>
					{/* Removed Select All control per request */}
					<div className="text-sm text-gray-600">
						{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} shown
					</div>
				</div>
				
				{loading ? (
					<TasksSkeleton />
				) : filteredTasks.length === 0 ? (
					<p className="text-center text-gray-500">No tasks yet. Create one!</p>
				) : (
				<ul className="space-y-2">
						{listForRender.map((t, index) => {
							const gkey = getGroupKey(t);
							const color = groupBy !== "none" ? getGroupColorClasses(gkey) : null;
							return (
						<li key={t.id} className={"border border-black rounded p-3 " + (groupBy !== "none" ? ("border-l-4 " + (color ? color.bar : "") + " " + (color ? color.bg : "")) : "") }>
							{groupBy !== "none" && (index === 0 || getGroupKey(listForRender[index-1]) !== gkey) && (
								<div className="-mt-1 -mb-1 pb-2">
							<div className="flex items-center justify-between">
										<h3 className="text-sm font-medium flex items-center gap-2">
											<span className={`inline-block w-2.5 h-2.5 rounded-full ${color?.dot || ""}`}></span>
											{gkey}
										</h3>
										<span className="text-xs text-gray-500">Group</span>
									</div>
									<div className="border-t border-gray-200 mt-1"></div>
								</div>
							)}
							{editingId === t.id ? (
								<form
									onSubmit={async e => {
										e.preventDefault();
										
										// Handle file uploads first
										const uploadedFiles = [];
										for (const file of files) {
											const formData = new FormData();
											formData.append('file', file);
											const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
											if (uploadRes.ok) {
												const uploadData = await uploadRes.json();
												// Prefer URL from R2 upload; fallback to local path for legacy
												uploadedFiles.push(uploadData.url || `/uploads/${uploadData.filename}`);
											}
										}

										// Combine existing attachments with new ones
										const allAttachments = [
											...(t.customFields?.attachments || []),
											...uploadedFiles
										];

										await fetch(`/api/tasks/${t.id}`, {
											method: "PATCH",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({
												title: editTitle,
												description: editDesc,
												status: editStatus,
												startAt: editStart ? new Date(editStart).toISOString() : null,
												dueAt: editDue ? new Date(editDue).toISOString() : null,
												customerId: customerId || null,
												assigneeId: assigneeId || null,
												customFields: {
													...t.customFields,
													...custom,
													attachments: allAttachments
												}
											})
										});
										setEditingId(null);
										setFiles([]);
										setCustom({});
										setCustomerId("");
										setAssigneeId("");
										load();
									}}
									className="space-y-4"
								>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium mb-1">Title</label>
											<input className="w-full border rounded px-3 py-2" value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
										</div>
										<div>
											<label className="block text-sm font-medium mb-1">Status</label>
																							<select className="w-full border rounded px-3 py-2" value={editStatus} onChange={e => setEditStatus(e.target.value as Task["status"]) }>
												<option value="TODO">TODO</option>
												<option value="IN_PROGRESS">IN_PROGRESS</option>
												<option value="BLOCKED">BLOCKED</option>
												<option value="DONE">DONE</option>
												<option value="CANCELLED">CANCELLED</option>
												<option value="ARCHIVED">ARCHIVED</option>
												<option value="CLIENT_TO_REVERT">CLIENT_TO_REVERT</option>
											</select>
											</div>
										</div>

										<div>
											<label className="block text-sm font-medium mb-1">Description</label>
											<textarea className="w-full border rounded px-3 py-2" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
										</div>

										<div className="grid grid-cols-2 gap-4">
											<div>
												<label className="block text-sm font-medium mb-1">Customer</label>
												{showNewCustomerForm ? (
													<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
							<div className="flex items-center justify-between">
														<h3 className="font-medium text-sm">Add New Customer</h3>
														<button
															type="button"
																								onClick={() => {
										setShowNewCustomerForm(false);
										setNewCustomerName("");
										setNewCustomerEmail("");
										setNewCustomerPhone("");
										setNewCustomerCompany("");
										setNewCustomerAddress("");
										setError(null);
									}}
															className="text-sm text-gray-500 hover:text-gray-700"
														>
															Cancel
														</button>
													</div>
													<input
														type="text"
														className="w-full border rounded px-3 py-2"
														placeholder="Customer name *"
														value={newCustomerName}
														onChange={e => setNewCustomerName(e.target.value)}
														required
													/>
													<input
														type="email"
														className="w-full border rounded px-3 py-2"
														placeholder="Email (optional)"
														value={newCustomerEmail}
														onChange={e => setNewCustomerEmail(e.target.value)}
													/>
													<input
														type="tel"
														className="w-full border rounded px-3 py-2"
														placeholder="Phone (optional)"
														value={newCustomerPhone}
														onChange={e => setNewCustomerPhone(e.target.value)}
													/>
													<input
														type="text"
														className="w-full border rounded px-3 py-2"
														placeholder="Company (optional)"
														value={newCustomerCompany}
														onChange={e => setNewCustomerCompany(e.target.value)}
													/>
													<textarea
														className="w-full border rounded px-3 py-2"
														placeholder="Address (optional)"
														value={newCustomerAddress}
														onChange={e => setNewCustomerAddress(e.target.value)}
														rows={3}
													/>
													{error && <p className="text-sm text-red-600">{error}</p>}
													<button
														type="button"
														onClick={createNewCustomer}
														className="w-full bg-blue-600 text-white py-2 px-3 rounded hover:bg-blue-700"
													>
														Create Customer
													</button>
												</div>
											) : (
												<select className="w-full border rounded px-3 py-2" value={customerId} onChange={e => {
													if (e.target.value === "add-new") {
														setShowNewCustomerForm(true);
														setCustomerId("");
													} else {
														setCustomerId(e.target.value);
													}
												}}>
													<option value="">Select customer</option>
													{customers.map(c => (
														<option key={c.id} value={c.id}>{c.name}</option>
													))}
													<option value="add-new">➕ Add New Customer</option>
												</select>
											)}
										</div>
										<div>
											<label className="block text-sm font-medium mb-1">Assign to</label>
											<select className="w-full border rounded px-3 py-2" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
												<option value="">Select user</option>
												{users.map(u => (
													<option key={u.id} value={u.id}>{u.name}</option>
												))}
											</select>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium mb-1">Type</label>
											<select className="w-full border rounded px-3 py-2" value={custom["category"] ?? ""} onChange={e => setCustom({ ...custom, category: e.target.value })}>
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
											<input className="w-full border rounded px-3 py-2" value={custom["quantity"] ?? ""} onChange={e => setCustom({ ...custom, quantity: e.target.value })} />
										</div>
									</div>

									{/* Rigid Box specific fields */}
									{custom["category"] === "Rigid Boxes" && (
										<div className="border border-gray-200 rounded p-4 bg-gray-50">
											<h4 className="font-medium mb-3">Rigid Box Specifications</h4>
											<div className="grid grid-cols-2 gap-4">
												<div>
													<label className="block text-sm font-medium mb-1">Box Type</label>
													<div className="space-y-2">
														{["Lid & Base", "Magnetic", "Ribbon", "Book", "Custom"].map(type => (
															<label key={type} className="flex items-center gap-2">
																<input
																	type="radio"
																	name="boxType"
																	value={type}
																	checked={custom["boxType"] === type}
																	onChange={e => setCustom({ ...custom, boxType: e.target.value })}
																/>
																{type}
															</label>
														))}
													</div>
												</div>
												<div>
													<label className="block text-sm font-medium mb-1">Size</label>
													<input className="w-full border rounded px-3 py-2 mb-2" value={custom["size"] ?? ""} onChange={e => setCustom({ ...custom, size: e.target.value })} />
													<label className="flex items-center gap-2">
														<input
															type="checkbox"
															checked={custom["existingSize"] ?? false}
															onChange={e => setCustom({ ...custom, existingSize: e.target.checked })}
														/>
														Existing size
													</label>
												</div>
												<div>
													<label className="block text-sm font-medium mb-1">Top Outer</label>
													<input className="w-full border rounded px-3 py-2" value={custom["topOuter"] ?? ""} onChange={e => setCustom({ ...custom, topOuter: e.target.value })} />
												</div>
												<div>
													<label className="block text-sm font-medium mb-1">Top Inner</label>
													<input className="w-full border rounded px-3 py-2" value={custom["topInner"] ?? ""} onChange={e => setCustom({ ...custom, topInner: e.target.value })} />
												</div>
												<div>
													<label className="block text-sm font-medium mb-1">Bottom Outer</label>
													<input className="w-full border rounded px-3 py-2" value={custom["bottomOuter"] ?? ""} onChange={e => setCustom({ ...custom, bottomOuter: e.target.value })} />
												</div>
												<div>
													<label className="block text-sm font-medium mb-1">Bottom Inner</label>
													<input className="w-full border rounded px-3 py-2" value={custom["bottomInner"] ?? ""} onChange={e => setCustom({ ...custom, bottomInner: e.target.value })} />
												</div>
											</div>
											
											{/* Partition */}
											<div className="mt-4">
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={custom["hasPartition"] ?? false}
														onChange={e => setCustom({ ...custom, hasPartition: e.target.checked })}
													/>
													Partition
												</label>
												{custom["hasPartition"] && (
													<textarea
														className="w-full border rounded px-3 py-2 mt-2"
														placeholder="Partition description"
														value={custom["partitionDescription"] ?? ""}
														onChange={e => setCustom({ ...custom, partitionDescription: e.target.value })}
													/>
												)}
											</div>
										</div>
									)}

									{custom["category"] === "Cake Boxes" && (
										<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
											<h3 className="font-medium text-sm">Cake Box Specifications</h3>
											<div>
												<label className="block text-sm font-medium mb-2">Size</label>
												<div className="flex items-center gap-2">
													<input
														type="text"
														className="flex-1 border rounded px-3 py-2"
														placeholder="Enter size"
														value={custom["size"] ?? ""}
														onChange={e => setCustom({ ...custom, size: e.target.value })}
													/>
													<label className="flex items-center gap-2 text-sm">
														<input
															type="checkbox"
															checked={custom["existingSize"] ?? false}
															onChange={e => setCustom({ ...custom, existingSize: e.target.checked })}
														/>
														Existing size
													</label>
												</div>
											</div>
											<div>
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={custom["hasWindow"] ?? false}
														onChange={e => setCustom({ ...custom, hasWindow: e.target.checked })}
													/>
													Window
												</label>
												{custom["hasWindow"] && (
													<input
														type="text"
														className="w-full border rounded px-3 py-2 mt-2"
														placeholder="Window details"
														value={custom["windowDetails"] ?? ""}
														onChange={e => setCustom({ ...custom, windowDetails: e.target.value })}
													/>
												)}
											</div>
											<div>
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={custom["innerPrinting"] ?? false}
														onChange={e => setCustom({ ...custom, innerPrinting: e.target.checked })}
													/>
													Inner Printing
												</label>
												{custom["innerPrinting"] && (
													<input
														type="text"
														className="w-full border rounded px-3 py-2 mt-2"
														placeholder="Inner printing details"
														value={custom["innerPrintingDetails"] ?? ""}
														onChange={e => setCustom({ ...custom, innerPrintingDetails: e.target.value })}
													/>
												)}
											</div>
										</div>
									)}

									{custom["category"] === "Paper Bags" && (
										<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
											<h3 className="font-medium text-sm">Paper Bag Specifications</h3>
											<div>
												<label className="block text-sm font-medium mb-2">Size</label>
												<div className="flex items-center gap-2">
													<input
														type="text"
														className="flex-1 border rounded px-3 py-2"
														placeholder="Enter size"
														value={custom["size"] ?? ""}
														onChange={e => setCustom({ ...custom, size: e.target.value })}
													/>
													<label className="flex items-center gap-2 text-sm">
														<input
															type="checkbox"
															checked={custom["existingSize"] ?? false}
															onChange={e => setCustom({ ...custom, existingSize: e.target.checked })}
														/>
														Existing size
													</label>
												</div>
											</div>
											<div>
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={custom["innerPrinting"] ?? false}
														onChange={e => setCustom({ ...custom, innerPrinting: e.target.checked })}
													/>
													Inner Printing
												</label>
												{custom["innerPrinting"] && (
													<input
														type="text"
														className="w-full border rounded px-3 py-2 mt-2"
														placeholder="Inner printing details"
														value={custom["innerPrintingDetails"] ?? ""}
														onChange={e => setCustom({ ...custom, innerPrintingDetails: e.target.value })}
													/>
												)}
											</div>
											<input
												type="text"
												className="w-full border rounded px-3 py-2"
												placeholder="Rope details"
												value={custom["rope"] ?? ""}
												onChange={e => setCustom({ ...custom, rope: e.target.value })}
											/>
										</div>
									)}

									{custom["category"] === "Stickers" && (
										<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
											<h3 className="font-medium text-sm">Sticker Specifications</h3>
											<input
												type="text"
												className="w-full border rounded px-3 py-2"
												placeholder="Size"
												value={custom["size"] ?? ""}
												onChange={e => setCustom({ ...custom, size: e.target.value })}
											/>
											<div className="grid grid-cols-2 gap-3">
												<div>
													<label className="block text-sm font-medium mb-1">Shape</label>
													<select
														className="w-full border rounded px-3 py-2"
														value={custom["shape"] ?? "Rectangle"}
														onChange={e => setCustom({ ...custom, shape: e.target.value })}
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
														value={custom["material"] ?? "Artsticker"}
														onChange={e => setCustom({ ...custom, material: e.target.value })}
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

									{custom["category"] === "Cards" && (
										<div className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50">
											<h3 className="font-medium text-sm">Card Specifications</h3>
											<input
												type="text"
												className="w-full border rounded px-3 py-2"
												placeholder="Size"
												value={custom["size"] ?? ""}
												onChange={e => setCustom({ ...custom, size: e.target.value })}
											/>
											<div>
												<label className="block text-sm font-medium mb-1">Sides</label>
												<div className="flex items-center gap-4">
													<label className="flex items-center gap-2 text-sm">
														<input
															type="radio"
															name="cardSides"
															value="single"
															checked={(custom["sides"] ?? "single") === "single"}
															onChange={() => setCustom({ ...custom, sides: "single" })}
														/>
														Single side
													</label>
													<label className="flex items-center gap-2 text-sm">
														<input
															type="radio"
															name="cardSides"
															value="double"
															checked={custom["sides"] === "double"}
															onChange={() => setCustom({ ...custom, sides: "double" })}
														/>
														Double side
													</label>
												</div>
											</div>
											<input
												type="text"
												className="w-full border rounded px-3 py-2"
												placeholder="Material"
												value={custom["material"] ?? ""}
												onChange={e => setCustom({ ...custom, material: e.target.value })}
											/>
										</div>
									)}

									{custom["category"] === "Invitation" && (
										<div className="border border-gray-200 rounded p-4 bg-gray-50">
											<h4 className="font-medium mb-3">Invitation Specifications</h4>
											<div className="grid grid-cols-2 gap-4">
												<div>
													<label className="block text-sm font-medium mb-1">Size</label>
													<input className="w-full border rounded px-3 py-2 mb-2" value={custom["size"] ?? ""} onChange={e => setCustom({ ...custom, size: e.target.value })} />
													<label className="flex items-center gap-2">
														<input type="checkbox" checked={custom["existingSize"] ?? false} onChange={e => setCustom({ ...custom, existingSize: e.target.checked })} />
														Existing size
													</label>
												</div>
												<div>
													<label className="block text-sm font-medium mb-1">Material</label>
													<input className="w-full border rounded px-3 py-2" value={custom["material"] ?? ""} onChange={e => setCustom({ ...custom, material: e.target.value })} />
												</div>
												<div>
													<label className="block text-sm font-medium mb-1">Envelope</label>
													<input className="w-full border rounded px-3 py-2" value={custom["envelope"] ?? ""} onChange={e => setCustom({ ...custom, envelope: e.target.value })} />
												</div>
											</div>
										</div>
									)}

									<DateTimeSelector label="Start" value={editStart} onChange={setEditStart} />
									<DateTimeSelector label="Due" value={editDue} onChange={setEditDue} />

									{/* File Upload */}
									<div
										className={`border-2 border-dashed rounded-lg p-4 text-center ${
											dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
										}`}
										onDragEnter={handleDrag}
										onDragLeave={handleDrag}
										onDragOver={handleDrag}
										onDrop={handleDrop}
									>
										<input
											type="file"
											multiple
											onChange={handleFileSelect}
											className="hidden"
											id={`file-upload-edit-${t.id}`}
										/>
										<label htmlFor={`file-upload-edit-${t.id}`} className="cursor-pointer">
											<div className="text-gray-600">
												<p>Drag and drop files here, or click to select files</p>
											</div>
										</label>
									</div>

									{/* File list */}
									{files.length > 0 && (
										<div className="space-y-2">
											<h4 className="text-sm font-medium">New Files:</h4>
											{files.map((file, index) => (
												<div key={index} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-100 rounded">
													<span className="text-sm truncate max-w-[60vw]">{file.name}</span>
													<button
														type="button"
														onClick={() => removeFile(index)}
														className="text-red-600 text-sm"
													>
														Remove
													</button>
												</div>
											))}
										</div>
									)}

									{/* Existing attachments */}
									{t.customFields?.attachments && t.customFields.attachments.length > 0 && (
										<div className="space-y-2">
											<h4 className="text-sm font-medium">Existing Attachments:</h4>
											{t.customFields.attachments.map((attachment: string, index: number) => (
												<div key={index} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-100 rounded">
													<a
														href={attachment.startsWith('http') ? attachment : attachment.startsWith('/api/files/') ? attachment : `/api/files/${encodeURIComponent(attachment)}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-sm truncate max-w-[60vw]"
													>
														📎 {attachment}
													</a>
												</div>
											))}
										</div>
									)}

									<div className="flex gap-2">
										<button className="btn rounded px-3 py-2" type="submit">Save</button>
										<button className="rounded border px-3 py-2" type="button" onClick={() => {
											setEditingId(null);
											setFiles([]);
											setCustom({});
											setCustomerId("");
											setAssigneeId("");
											setShowNewCustomerForm(false);
											setNewCustomerName("");
											setNewCustomerEmail("");
											setNewCustomerPhone("");
										}}>Cancel</button>
									</div>
								</form>
							) : (
								<div>
							<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<span className="text-[10px] w-5 h-5 inline-flex items-center justify-center rounded-full bg-black text-white">{index + 1}</span>
											<span className="font-medium flex items-center gap-2">
												{t.title}
											</span>
										</div>
										<div className="flex gap-2">
											<select
												value={t.status}
												onChange={async (e) => {
													const newStatus = e.target.value as Task["status"];
													await fetch(`/api/tasks/${t.id}`, {
														method: "PATCH",
														headers: { "Content-Type": "application/json" },
														body: JSON.stringify({ status: newStatus })
													});
													load();
												}}
												className="text-xs px-2 py-1 rounded border bg-white"
												style={{ color: "var(--foreground)" }}
											>
												<option value="TODO">TODO</option>
												<option value="IN_PROGRESS">IN_PROGRESS</option>
												<option value="BLOCKED">BLOCKED</option>
												<option value="DONE">DONE</option>
												<option value="CANCELLED">CANCELLED</option>
												<option value="ARCHIVED">ARCHIVED</option>
												<option value="CLIENT_TO_REVERT">CLIENT_TO_REVERT</option>
											</select>
											<select
												value={t.customFields?.paymentStatus || "NO_PAYMENT_RECEIVED"}
												onChange={async (e) => {
													const newPaymentStatus = e.target.value;
													const updatedCustomFields = {
														...t.customFields,
														paymentStatus: newPaymentStatus
													};
													await fetch(`/api/tasks/${t.id}`, {
														method: "PATCH",
														headers: { "Content-Type": "application/json" },
														body: JSON.stringify({ customFields: updatedCustomFields })
													});
													load();
												}}
												className="text-xs px-2 py-1 rounded border bg-white"
												style={{ color: "var(--foreground)" }}
											>
												<option value="NO_PAYMENT_RECEIVED">No Payment</option>
												<option value="ADVANCE_RECEIVED">Advance</option>
												<option value="FULL_PAYMENT_RECEIVED">Full Payment</option>
											</select>
										</div>
							</div>
							{/* Badges row below title */}
							<div className="mt-1 flex flex-wrap items-center gap-1">
								{t.customFields?.quantity && (
									<span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Qty: {t.customFields.quantity}</span>
								)}
								{t.customerRef?.name && (
									<span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{t.customerRef.name}</span>
								)}
								{t.customFields?.category && (
									<span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{t.customFields.category}</span>
								)}
								{t.assignments && t.assignments.map(a => (
									<span key={a.id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{a.user.name}</span>
								))}
								{isAssignedToMe(t) && (
									<span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>Assigned to me</span>
								)}
							</div>
							{t.dueAt && <p className="text-xs text-gray-600 mt-1">Due: {new Date(t.dueAt).toLocaleString()}</p>}
									<div className="mt-2 flex gap-2">
										<button
											type="button"
											className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
											onClick={() => {
												setEditingId(t.id);
												setEditTitle(t.title);
												setEditDesc(t.description);
												setEditStatus(t.status);
												setEditStart(t.startAt ? new Date(t.startAt).toISOString().slice(0,16) : "");
												setEditDue(t.dueAt ? new Date(t.dueAt).toISOString().slice(0,16) : "");
												setCustomerId(t.customerId || "");
												setAssigneeId(t.assignments?.[0]?.user.id || "");
												setCustom(t.customFields || {});
												setFiles([]);
											}}
										>
											Edit
										</button>
										<button
											type="button"
											className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
											onClick={() => setViewingId(t.id)}
										>
											View
										</button>
										<button
											type="button"
											className="text-xs px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
											onClick={() => deleteTask(t.id)}
											disabled={deletingId === t.id}
										>
											{deletingId === t.id ? "Deleting..." : "Delete"}
										</button>

										<button
											type="button"
											className="text-xs px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
											onClick={() => duplicateTask(t)}
											disabled={duplicatingId === t.id}
										>
											{duplicatingId === t.id ? "Duplicating..." : "Duplicate"}
										</button>
									</div>

									{/* Subtasks Section */}
									<div className="mt-4 border-t border-gray-200 pt-4">
										<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
											<h4 className="text-sm font-medium">Subtasks</h4>
											<button
												type="button"
												className="text-xs px-2 py-1 rounded border"
												onClick={() => setAddingSubtaskToTaskId(addingSubtaskToTaskId === t.id ? null : t.id)}
											>
												{addingSubtaskToTaskId === t.id ? "Cancel" : "Add Subtask"}
											</button>
										</div>

										{/* Add Subtask Form */}
										{addingSubtaskToTaskId === t.id && (
											<form
												onSubmit={(e) => {
													e.preventDefault();
													createSubtask(t.id);
												}}
												className="space-y-3 p-3 border border-gray-200 rounded bg-gray-50"
											>
												<div className="grid grid-cols-2 gap-3">
													<div>
														<label className="block text-xs font-medium mb-1">Title</label>
														<input
															type="text"
															className="w-full border rounded px-2 py-1 text-sm"
															value={subtaskTitle}
															onChange={(e) => setSubtaskTitle(e.target.value)}
															placeholder="Subtask title"
															required
														/>
													</div>
													<div>
														<label className="block text-xs font-medium mb-1">Assign to</label>
														<select
															className="w-full border rounded px-2 py-1 text-sm"
															value={subtaskAssigneeId}
															onChange={(e) => setSubtaskAssigneeId(e.target.value)}
														>
															<option value="">Select user</option>
															{users.map(u => (
																<option key={u.id} value={u.id}>{u.name}</option>
															))}
														</select>
													</div>
												</div>
												<div className="grid grid-cols-2 gap-3">
													<div>
														<label className="block text-xs font-medium mb-1">Due Date</label>
														<DateTimeSelector 
															label="Due" 
															value={subtaskDueAt} 
															onChange={setSubtaskDueAt} 
														/>
													</div>
													<div>
														<label className="block text-xs font-medium mb-1">Est. Hours</label>
														<input
															type="number"
															step="0.5"
															className="w-full border rounded px-2 py-1 text-sm"
															value={subtaskEstimatedHours || ""}
															onChange={(e) => setSubtaskEstimatedHours(e.target.valueAsNumber || null)}
														/>
													</div>
												</div>
												<div className="flex gap-2">
													<button
														type="submit"
														className="text-xs px-3 py-1 rounded bg-blue-600 text-white"
													>
														Add Subtask
													</button>
													<button
														type="button"
														className="text-xs px-3 py-1 rounded border"
														onClick={() => {
															setAddingSubtaskToTaskId(null);
															setSubtaskTitle("");
															setSubtaskAssigneeId("");
															setSubtaskDueAt("");
															setSubtaskEstimatedHours(null);
														}}
													>
														Cancel
													</button>
												</div>
											</form>
										)}

										{/* Subtasks List */}
										{t.subtasks && t.subtasks.length > 0 ? (
											<div className="space-y-2">
												{t.subtasks.map((subtask) => (
													<div key={subtask.id} className="border border-gray-200 rounded bg-white">
														{editingSubtaskId === subtask.id ? (
															// Edit Subtask Form
															<form
																onSubmit={(e) => {
																	e.preventDefault();
																	updateSubtask(subtask.id);
																}}
																className="p-3 space-y-3"
															>
																<div className="grid grid-cols-2 gap-3">
																	<div>
																		<label className="block text-xs font-medium mb-1">Title</label>
																		<input
																			type="text"
																			className="w-full border rounded px-2 py-1 text-sm"
																			value={editSubtaskTitle}
																			onChange={(e) => setEditSubtaskTitle(e.target.value)}
																			placeholder="Subtask title"
																			required
																		/>
																	</div>
																	<div>
																		<label className="block text-xs font-medium mb-1">Assign to</label>
																		<select
																			className="w-full border rounded px-2 py-1 text-sm"
																			value={editSubtaskAssigneeId}
																			onChange={(e) => setEditSubtaskAssigneeId(e.target.value)}
																		>
																			<option value="">Select user</option>
																			{users.map(u => (
																				<option key={u.id} value={u.id}>{u.name}</option>
																			))}
																		</select>
																	</div>
																</div>
																<div className="grid grid-cols-2 gap-3">
																	<div>
																		<label className="block text-xs font-medium mb-1">Due Date</label>
																		<DateTimeSelector 
																			label="Due" 
																			value={editSubtaskDueAt} 
																			onChange={setEditSubtaskDueAt} 
																		/>
																	</div>
																	<div>
																		<label className="block text-xs font-medium mb-1">Est. Hours</label>
																		<input
																			type="number"
																			step="0.5"
																			className="w-full border rounded px-2 py-1 text-sm"
																			value={editSubtaskEstimatedHours || ""}
																			onChange={(e) => setEditSubtaskEstimatedHours(e.target.valueAsNumber || null)}
																		/>
																	</div>
																</div>
																<div className="flex gap-2">
																	<button
																		type="submit"
																		className="text-xs px-3 py-1 rounded bg-blue-600 text-white"
																	>
																		Save
																	</button>
																	<button
																		type="button"
																		className="text-xs px-3 py-1 rounded border"
																		onClick={() => {
																			setEditingSubtaskId(null);
																			setEditSubtaskTitle("");
																			setEditSubtaskAssigneeId("");
																			setEditSubtaskDueAt("");
																			setEditSubtaskEstimatedHours(null);
																		}}
																	>
																		Cancel
																	</button>
																</div>
															</form>
														) : (
															// Normal Subtask Display
															<div className="flex items-center gap-2 p-2">
																<input
																	type="checkbox"
																	checked={subtask.status === "DONE"}
																	onChange={(e) => {
																		const newStatus = e.target.checked ? "DONE" : "TODO";
																		updateSubtaskStatus(subtask.id, newStatus);
																	}}
																	className="rounded"
																/>
																<div className="flex-1 min-w-0">
																	<div className="flex items-center gap-2">
																		<span className={`text-sm ${subtask.status === "DONE" ? "line-through text-gray-500" : ""}`}>
																			{subtask.title}
																		</span>
																		{subtask.assigneeId && (
																			<span className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-800">
																				Assigned
																			</span>
																		)}
																		{subtask.dueAt && (
																			<span className="text-xs text-gray-500">
																				Due: {new Date(subtask.dueAt).toLocaleDateString()}
																			</span>
																		)}
																	</div>
																</div>
																<div className="flex gap-1">
																	<button
																		type="button"
																		onClick={() => {
																			setEditingSubtaskId(subtask.id);
																			setEditSubtaskTitle(subtask.title);
																			setEditSubtaskAssigneeId(subtask.assigneeId || "");
																			setEditSubtaskDueAt(subtask.dueAt ? new Date(subtask.dueAt).toISOString().slice(0,16) : "");
																			setEditSubtaskEstimatedHours(null);
																		}}
																		className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
																	>
																		Edit
																	</button>
																	<button
																		type="button"
																		onClick={() => deleteSubtask(subtask.id)}
																		className="text-xs px-2 py-1 rounded border text-red-600 hover:text-red-800 hover:bg-red-50"
																	>
																		Delete
																	</button>
																</div>
															</div>
														)}
													</div>
												))}
											</div>
										) : (
											<p className="text-xs text-gray-500 italic">No subtasks yet</p>
										)}
									</div>
								</div>
							)}
						</li>
						);
					})}
				</ul>
				)}
			</section>

			{/* View Task Modal */}
			{viewingId && (() => {
				const task = tasks.find(t => t.id === viewingId);
				if (!task) return null;
				
				return (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
						<div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
							<div className="flex flex-wrap items-center justify-between gap-2 mb-4">
								<h2 className="text-xl font-semibold">Task Details</h2>
								<button
									type="button"
									className="text-gray-500 hover:text-gray-700"
									onClick={() => setViewingId(null)}
								>
									✕
								</button>
							</div>
							
							<div className="space-y-4">
								{/* Basic Info */}
								<div>
									<h3 className="font-medium text-gray-900 mb-2">Basic Information</h3>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-gray-700">Title</label>
											<p className="text-sm text-gray-900">{task.title}</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700">Status</label>
											<span className="inline-block px-2 py-1 text-xs rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
												{task.status}
											</span>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700">Description</label>
											<p className="text-sm text-gray-900">{task.description || "No description"}</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700">Created</label>
											<p className="text-sm text-gray-900">{new Date(task.createdAt).toLocaleString()}</p>
										</div>
									</div>
								</div>

								{/* Dates */}
								{(task.startAt || task.dueAt) && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Dates</h3>
										<div className="grid grid-cols-2 gap-4">
											{task.startAt && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Start Date</label>
													<p className="text-sm text-gray-900">{new Date(task.startAt).toLocaleString()}</p>
												</div>
											)}
											{task.dueAt && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Due Date</label>
													<p className="text-sm text-gray-900">{new Date(task.dueAt).toLocaleString()}</p>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Customer & Assignments */}
								{(task.customerRef || task.assignments?.length) && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Customer & Assignments</h3>
										<div className="space-y-2">
											{task.customerRef && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Customer</label>
													<p className="text-sm text-gray-900">{task.customerRef.name}</p>
												</div>
											)}
											{task.assignments && task.assignments.length > 0 && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Assigned To</label>
													<div className="flex flex-wrap gap-1 mt-1">
														{task.assignments.map(a => (
															<span key={a.id} className="text-xs px-2 py-1 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
																{a.user.name}
															</span>
														))}
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Custom Fields */}
								{task.customFields && Object.keys(task.customFields).length > 0 && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Custom Fields</h3>
										<div className="space-y-3">
											{task.customFields.quantity && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Quantity</label>
													<p className="text-sm text-gray-900">{task.customFields.quantity}</p>
												</div>
											)}
											{task.customFields.category && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Category</label>
													<p className="text-sm text-gray-900">{task.customFields.category}</p>
												</div>
											)}
											
											{/* Rigid Box specific fields */}
											{task.customFields.category === "Rigid Boxes" && (
												<div className="border border-gray-200 rounded p-3 bg-gray-50">
													<h4 className="font-medium text-sm mb-2">Rigid Box Specifications</h4>
													<div className="grid grid-cols-2 gap-3 text-sm">
														{task.customFields.boxType && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Box Type</label>
																<p className="text-gray-900">{task.customFields.boxType}</p>
															</div>
														)}
														{task.customFields.size && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Size</label>
																<p className="text-gray-900">
																	{task.customFields.size}
																	{task.customFields.existingSize && " (Existing size)"}
																</p>
															</div>
														)}
														{task.customFields.topOuter && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Top Outer</label>
																<p className="text-gray-900">{task.customFields.topOuter}</p>
															</div>
														)}
														{task.customFields.topInner && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Top Inner</label>
																<p className="text-gray-900">{task.customFields.topInner}</p>
															</div>
														)}
														{task.customFields.bottomOuter && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Bottom Outer</label>
																<p className="text-gray-900">{task.customFields.bottomOuter}</p>
															</div>
														)}
														{task.customFields.bottomInner && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Bottom Inner</label>
																<p className="text-gray-900">{task.customFields.bottomInner}</p>
															</div>
														)}
														{task.customFields.hasPartition && (
															<div className="col-span-2">
																<label className="block text-xs font-medium text-gray-600">Partition</label>
																<p className="text-gray-900">
																	Yes
																	{task.customFields.partitionDescription && ` - ${task.customFields.partitionDescription}`}
																</p>
															</div>
														)}
													</div>
												</div>
											)}

											{/* Cake Boxes specific fields */}
											{task.customFields.category === "Cake Boxes" && (
												<div className="border border-gray-200 rounded p-3 bg-gray-50">
													<h4 className="font-medium text-sm mb-2">Cake Box Specifications</h4>
													<div className="grid grid-cols-2 gap-3 text-sm">
														{task.customFields.size && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Size</label>
																<p className="text-gray-900">
																	{task.customFields.size}
																	{task.customFields.existingSize && " (Existing size)"}
																</p>
															</div>
														)}
														{task.customFields.hasWindow && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Window</label>
																<p className="text-gray-900">Yes{task.customFields.windowDetails ? ` - ${task.customFields.windowDetails}` : ""}</p>
															</div>
														)}
														{task.customFields.innerPrinting && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Inner Printing</label>
																<p className="text-gray-900">Yes{task.customFields.innerPrintingDetails ? ` - ${task.customFields.innerPrintingDetails}` : ""}</p>
															</div>
														)}
													</div>
												</div>
											)}

											{/* Paper Bags specific fields */}
											{task.customFields.category === "Paper Bags" && (
												<div className="border border-gray-200 rounded p-3 bg-gray-50">
													<h4 className="font-medium text-sm mb-2">Paper Bag Specifications</h4>
													<div className="grid grid-cols-2 gap-3 text-sm">
														{task.customFields.size && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Size</label>
																<p className="text-gray-900">
																	{task.customFields.size}
																	{task.customFields.existingSize && " (Existing size)"}
																</p>
															</div>
														)}
														{task.customFields.innerPrinting && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Inner Printing</label>
																<p className="text-gray-900">Yes{task.customFields.innerPrintingDetails ? ` - ${task.customFields.innerPrintingDetails}` : ""}</p>
															</div>
														)}
														{task.customFields.rope && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Rope</label>
																<p className="text-gray-900">{task.customFields.rope}</p>
															</div>
														)}
													</div>
												</div>
											)}

											{/* Stickers specific fields */}
											{task.customFields.category === "Stickers" && (
												<div className="border border-gray-200 rounded p-3 bg-gray-50">
													<h4 className="font-medium text-sm mb-2">Sticker Specifications</h4>
													<div className="grid grid-cols-2 gap-3 text-sm">
														{task.customFields.size && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Size</label>
																<p className="text-gray-900">{task.customFields.size}</p>
															</div>
														)}
														{task.customFields.shape && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Shape</label>
																<p className="text-gray-900">{task.customFields.shape}</p>
															</div>
														)}
														{task.customFields.material && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Material</label>
																<p className="text-gray-900">{task.customFields.material}</p>
															</div>
														)}
													</div>
												</div>
											)}

											{/* Cards specific fields */}
											{task.customFields.category === "Cards" && (
												<div className="border border-gray-200 rounded p-3 bg-gray-50">
													<h4 className="font-medium text-sm mb-2">Card Specifications</h4>
													<div className="grid grid-cols-2 gap-3 text-sm">
														{task.customFields.size && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Size</label>
																<p className="text-gray-900">{task.customFields.size}</p>
															</div>
														)}
														{task.customFields.sides && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Sides</label>
																<p className="text-gray-900">{task.customFields.sides === "double" ? "Double side" : "Single side"}</p>
															</div>
														)}
														{task.customFields.material && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Material</label>
																<p className="text-gray-900">{task.customFields.material}</p>
															</div>
														)}
													</div>
												</div>
											)}

											{task.customFields.category === "Invitation" && (
												<div className="border border-gray-200 rounded p-3 bg-gray-50">
													<h4 className="font-medium text-sm mb-2">Invitation Specifications</h4>
													<div className="grid grid-cols-2 gap-3 text-sm">
														{task.customFields.size && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Size</label>
																<p className="text-gray-900">{task.customFields.size}{task.customFields.existingSize && " (Existing size)"}</p>
															</div>
														)}
														{task.customFields.material && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Material</label>
																<p className="text-gray-900">{task.customFields.material}</p>
															</div>
														)}
														{task.customFields.envelope && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Envelope</label>
																<p className="text-gray-900">{task.customFields.envelope}</p>
															</div>
														)}
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Attachments */}
								{task.customFields?.attachments && task.customFields.attachments.length > 0 && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Attachments</h3>
										<div className="space-y-2">
											{task.customFields.attachments.map((attachment: string, index: number) => (
												<div key={index} className="flex items-center gap-2">
													<a
														href={attachment.startsWith('http') ? attachment : attachment.startsWith('/api/files/') ? attachment : `/api/files/${encodeURIComponent(attachment)}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
													>
														📎 {attachment}
													</a>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				);
			})()}
		</div>
	);
}
