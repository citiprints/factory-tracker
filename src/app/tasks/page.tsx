// FORCE REBUILD - Loading animations added
"use client";
import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "../UserContext";
import TaskComments from "@/components/TaskComments";
import { useRefreshCounts } from "../CountsContext";
import { CustomerFields, EMPTY_CUSTOMER_FORM, customerFormToPayload, type CustomerFormState } from "@/components/CustomerFields";
import { despatchItemStatusChipClass } from "@/lib/despatchItemStatus";

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
	teamAssignments?: { id: string; team: { id: string; name: string } }[];
	createdBy?: { id: string; name: string } | null;
	subtasks?: Subtask[];
	despatchItems?: DespatchItem[];
	onboardingStatus?: "PENDING" | "SUBMITTED" | null;
	unreadCommentCount?: number;
	createdAt: string;
	updatedAt: string;
};

type Team = { id: string; name: string; memberIds: string[] };

type Subtask = {
	id: string;
	title: string;
	status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
	assigneeId?: string | null;
	dueAt?: string | null;
	order: number;
};

type DespatchItem = {
	id: string;
	taskId: string;
	name: string;
	quantity: number;
	unit: string;
	status: "PENDING_CLIENT_APPROVAL" | "PRE_PRODUCTION" | "PRODUCTION" | "PACKED" | "DESPATCHED";
	order: number;
	specFields?: Record<string, any> | null;
};

type ProofFile = { url: string; name: string };
type ProofRequest = {
	id: string;
	status: "PENDING" | "APPROVED" | "REJECTED";
	files: ProofFile[];
	customerNote?: string | null;
	createdAt: string;
	createdBy: { id: string; name: string };
};

type OnboardingForm = {
	id: string;
	taskId: string;
	status: "PENDING" | "SUBMITTED" | "REVOKED";
	expiresAt: string;
	submittedAt?: string | null;
	filledByStaff?: { id: string; name: string } | null;
	billingName?: string | null;
	billingEmail?: string | null;
	billingPhone?: string | null;
	billingSecondaryPhone?: string | null;
	billingAddress?: string | null;
	gstin?: string | null;
	deliveryContactName?: string | null;
	deliveryPhone?: string | null;
	deliverySecondaryPhone?: string | null;
	deliveryAddress?: string | null;
	deliveryNotes?: string | null;
};

type Payment = {
	id: string;
	taskId: string;
	amount: number;
	receivedAt: string;
	mode: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "CARD" | "OTHER";
	notes?: string | null;
	recordedBy: { id: string; name: string };
	createdAt: string;
};

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

function DateTimeSelector({ label, value, onChange, defaultTime = "00:00" }: { label: string; value: string; onChange: (next: string) => void; defaultTime?: string }) {
	const datePart = value ? value.split("T")[0] : "";
	const timePart = value ? (value.split("T")[1] || "") : "";

	function updateDate(nextDate: string) {
		if (!nextDate && !timePart) return onChange("");
		onChange(nextDate ? `${nextDate}T${timePart || defaultTime}` : "");
	}

	function updateTime(nextTime: string) {
		if (!nextTime && !datePart) return onChange("");
		onChange(`${datePart || new Date().toISOString().slice(0, 10)}T${nextTime || defaultTime}`);
	}

	return (
		<div>
			<span className="field-label">{label}</span>
			<div className="flex gap-2">
				<input type="date" className="input flex-[3]" value={datePart} onChange={(e) => updateDate(e.target.value)} />
				<input type="time" className="input flex-[2]" value={timePart} onChange={(e) => updateTime(e.target.value)} />
			</div>
		</div>
	);
}

type DynamicCategory = {
	id: string;
	name: string;
	fields: { id: string; key: string; label: string; type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN"; required: boolean }[];
};

// Category-specific spec fields for one item — used by both the "add item"
// and "edit item" forms so the ~150 lines of per-category fields exist once,
// not tripled the way the old task-level version was. The category select
// and the shared Size field live in the one-line row at each call site;
// this only renders whatever additional fields that category needs.
// IMPORTANT: this must stay a module-level component, not one defined inside
// TasksPageInner's render body -- a component defined inside another
// component's render gets a new identity every render, which makes React
// unmount/remount it (and its inputs) on every keystroke, kicking focus out
// after each character typed.
function ItemSpecFields({
	category,
	specFields,
	onFieldChange,
	dynamicCategories,
}: {
	category: string;
	specFields: Record<string, any>;
	onFieldChange: (key: string, value: any) => void;
	dynamicCategories: DynamicCategory[];
}) {
	const f = (key: string) => specFields[key] ?? "";
	return (
		<div className="space-y-3">
			{category === "Rigid Boxes" && (
				<div className="space-y-3 p-3 border border-line rounded-lg bg-wash">
					<h3 className="font-medium text-sm">Rigid Box Specifications</h3>
					<div>
						<label className="field-label">Box Type</label>
						<div className="space-y-1">
							{["Lid & Base", "Magnetic", "Ribbon", "Book", "Custom"].map(type => (
								<label key={type} className="flex items-center gap-2 text-sm">
									<input type="radio" name={`boxType-${category}`} value={type} checked={f("boxType") === type} onChange={(e) => onFieldChange("boxType", e.target.value)} />
									{type}
								</label>
							))}
						</div>
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={!!specFields["existingSize"]} onChange={(e) => onFieldChange("existingSize", e.target.checked)} />
						Existing size
					</label>
					<input type="text" className="input text-sm" placeholder="Top Outer" value={f("topOuter")} onChange={(e) => onFieldChange("topOuter", e.target.value)} />
					<input type="text" className="input text-sm" placeholder="Top Inner" value={f("topInner")} onChange={(e) => onFieldChange("topInner", e.target.value)} />
					<input type="text" className="input text-sm" placeholder="Bottom Outer" value={f("bottomOuter")} onChange={(e) => onFieldChange("bottomOuter", e.target.value)} />
					<input type="text" className="input text-sm" placeholder="Bottom Inner" value={f("bottomInner")} onChange={(e) => onFieldChange("bottomInner", e.target.value)} />
					<div>
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" checked={!!specFields["hasPartition"]} onChange={(e) => onFieldChange("hasPartition", e.target.checked)} />
							Partition
						</label>
						{specFields["hasPartition"] && (
							<textarea className="input text-sm mt-2" placeholder="Partition description" value={f("partitionDescription")} onChange={(e) => onFieldChange("partitionDescription", e.target.value)} />
						)}
					</div>
				</div>
			)}

			{category === "Cake Boxes" && (
				<div className="space-y-3 p-3 border border-line rounded-lg bg-wash">
					<h3 className="font-medium text-sm">Cake Box Specifications</h3>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={!!specFields["existingSize"]} onChange={(e) => onFieldChange("existingSize", e.target.checked)} />
						Existing size
					</label>
					<div>
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" checked={!!specFields["hasWindow"]} onChange={(e) => onFieldChange("hasWindow", e.target.checked)} />
							Window
						</label>
						{specFields["hasWindow"] && (
							<input type="text" className="input text-sm mt-2" placeholder="Window details" value={f("windowDetails")} onChange={(e) => onFieldChange("windowDetails", e.target.value)} />
						)}
					</div>
					<div>
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" checked={!!specFields["innerPrinting"]} onChange={(e) => onFieldChange("innerPrinting", e.target.checked)} />
							Inner Printing
						</label>
						{specFields["innerPrinting"] && (
							<input type="text" className="input text-sm mt-2" placeholder="Inner printing details" value={f("innerPrintingDetails")} onChange={(e) => onFieldChange("innerPrintingDetails", e.target.value)} />
						)}
					</div>
				</div>
			)}

			{category === "Paper Bags" && (
				<div className="space-y-3 p-3 border border-line rounded-lg bg-wash">
					<h3 className="font-medium text-sm">Paper Bag Specifications</h3>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={!!specFields["existingSize"]} onChange={(e) => onFieldChange("existingSize", e.target.checked)} />
						Existing size
					</label>
					<div>
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" checked={!!specFields["innerPrinting"]} onChange={(e) => onFieldChange("innerPrinting", e.target.checked)} />
							Inner Printing
						</label>
						{specFields["innerPrinting"] && (
							<input type="text" className="input text-sm mt-2" placeholder="Inner printing details" value={f("innerPrintingDetails")} onChange={(e) => onFieldChange("innerPrintingDetails", e.target.value)} />
						)}
					</div>
					<input type="text" className="input text-sm" placeholder="Rope" value={f("rope")} onChange={(e) => onFieldChange("rope", e.target.value)} />
				</div>
			)}

			{category === "Stickers" && (
				<div className="space-y-3 p-3 border border-line rounded-lg bg-wash">
					<h3 className="font-medium text-sm">Sticker Specifications</h3>
					<input type="text" className="input text-sm" placeholder="Shape" value={f("shape")} onChange={(e) => onFieldChange("shape", e.target.value)} />
					<input type="text" className="input text-sm" placeholder="Material" value={f("material")} onChange={(e) => onFieldChange("material", e.target.value)} />
				</div>
			)}

			{category === "Cards" && (
				<div className="space-y-3 p-3 border border-line rounded-lg bg-wash">
					<h3 className="font-medium text-sm">Card Specifications</h3>
					<input type="text" className="input text-sm" placeholder="Sides" value={f("sides")} onChange={(e) => onFieldChange("sides", e.target.value)} />
					<input type="text" className="input text-sm" placeholder="Material" value={f("material")} onChange={(e) => onFieldChange("material", e.target.value)} />
				</div>
			)}

			{category === "Invitation" && (
				<div className="space-y-3 p-3 border border-line rounded-lg bg-wash">
					<h3 className="font-medium text-sm">Invitation Specifications</h3>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={!!specFields["existingSize"]} onChange={(e) => onFieldChange("existingSize", e.target.checked)} />
						Existing size
					</label>
					<input type="text" className="input text-sm" placeholder="Material" value={f("material")} onChange={(e) => onFieldChange("material", e.target.value)} />
					<input type="text" className="input text-sm" placeholder="Envelope" value={f("envelope")} onChange={(e) => onFieldChange("envelope", e.target.value)} />
				</div>
			)}

			{category && (
				<textarea
					className="input text-sm"
					placeholder="Description / notes"
					rows={2}
					value={f("description")}
					onChange={(e) => onFieldChange("description", e.target.value)}
				/>
			)}

			{dynamicCategories.find(c => c.name === category)?.fields.map(fld => (
				<div key={fld.id} className="text-sm">
					<label className="block mb-1">{fld.label}{fld.required && " *"}</label>
					{fld.type === "TEXT" && (
						<input className="input text-sm" value={f(fld.key)} onChange={(e) => onFieldChange(fld.key, e.target.value)} />
					)}
					{fld.type === "NUMBER" && (
						<input type="number" className="input text-sm" value={f(fld.key)} onChange={(e) => onFieldChange(fld.key, e.target.valueAsNumber)} />
					)}
					{fld.type === "DATE" && (
						<input type="date" className="input text-sm" value={f(fld.key)} onChange={(e) => onFieldChange(fld.key, e.target.value)} />
					)}
					{fld.type === "BOOLEAN" && (
						<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!specFields[fld.key]} onChange={(e) => onFieldChange(fld.key, e.target.checked)} /> {fld.label}</label>
					)}
				</div>
			))}
		</div>
	);
}

function TasksPageInner() {
	const currentUser = useCurrentUser();
	const refreshCounts = useRefreshCounts();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";
	const searchParams = useSearchParams();
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [assignedToMeOnly, setAssignedToMeOnly] = useState<boolean>(false);
	const [title, setTitle] = useState("");
	const [desc, setDesc] = useState("");
	// Defaults to "now" so most tasks need no extra clicks, but stays a
	// normal editable field — just pre-filled, not locked.
	const [start, setStart] = useState<string>(() => {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
	});
	const [due, setDue] = useState<string>("");
	const [custom, setCustom] = useState<Record<string, any>>({});
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTask, setEditingTask] = useState<Task | null>(null);
	const [viewingId, setViewingId] = useState<string | null>(null);
	// Which task rows have their comments panel expanded inline on the main
	// list — collapsed by default so the list stays scannable; a person taps
	// to open just the ones they care about, same gesture on phone or desktop.
	const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
	function toggleComments(taskId: string) {
		setExpandedComments(prev => {
			const next = new Set(prev);
			const opening = !next.has(taskId);
			if (opening) next.add(taskId);
			else next.delete(taskId);
			if (opening) {
				fetch(`/api/tasks/${taskId}/comments/mark-read`, { method: "PATCH" })
					.then(() => refreshCounts())
					.catch(() => {});
				setTasks(prev => prev.map(t => t.id === taskId ? { ...t, unreadCommentCount: 0 } : t));
			}
			return next;
		});
	}
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
	const [dynamicCategories, setDynamicCategories] = useState<{
		id: string; name: string;
		fields: { id: string; key: string; label: string; type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN"; required: boolean }[];
	}[]>([]);
	const [customerId, setCustomerId] = useState<string>("");
	const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
	const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
	// Same shape as the onboarding form's billing/delivery fields -- the quick
	// "Add New Customer" form here is meant to be identical to it, so a
	// customer created from a task has the same details a customer created
	// through onboarding would.
	const [newCustomerForm, setNewCustomerForm] = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);
	const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
	const [teams, setTeams] = useState<Team[]>([]);
	const [teamIds, setTeamIds] = useState<string[]>([]);
	// Purely for deciding what to render — the payment API routes are the
	// real gate, this just avoids showing a section that would 403 anyway.
	const canSeePayments = isAdmin || (!!currentUser && !!teams.find(t => t.name === "Accounts")?.memberIds.includes(currentUser.id));
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

	// Items list rows collected while creating a task (posted after the
	// task itself is created, same two-step pattern as subtasks/attachments).
	type DespatchDraftRow = { name: string; quantity: string; unit: string; category: string; specFields: Record<string, any> };
	const [despatchDraft, setDespatchDraft] = useState<DespatchDraftRow[]>([]);
	const [addingDespatchItemToTaskId, setAddingDespatchItemToTaskId] = useState<string | null>(null);
	const [newDespatchName, setNewDespatchName] = useState("");
	const [newDespatchQuantity, setNewDespatchQuantity] = useState("");
	const [newDespatchUnit, setNewDespatchUnit] = useState("pcs");
	const [newDespatchCategory, setNewDespatchCategory] = useState("");
	const [newDespatchSpecFields, setNewDespatchSpecFields] = useState<Record<string, any>>({});

	// Editing an existing item's name/qty/unit/category/specs.
	const [editingDespatchItemId, setEditingDespatchItemId] = useState<string | null>(null);
	const [editDespatchName, setEditDespatchName] = useState("");
	const [editDespatchQuantity, setEditDespatchQuantity] = useState("");
	const [editDespatchUnit, setEditDespatchUnit] = useState("pcs");
	const [editDespatchCategory, setEditDespatchCategory] = useState("");
	const [editDespatchSpecFields, setEditDespatchSpecFields] = useState<Record<string, any>>({});

	// Onboarding form: latest form per task, loaded lazily when a task card
	// is expanded, plus state for the "fill in manually" modal.
	const [onboardingForms, setOnboardingForms] = useState<Record<string, OnboardingForm | null>>({});
	const [onboardingLoadingTaskId, setOnboardingLoadingTaskId] = useState<string | null>(null);
	// Visibility is separate from the data cache above -- once loaded, toggling
	// "Show status"/"Hide status" just shows/hides it without refetching.
	const [expandedOnboarding, setExpandedOnboarding] = useState<Set<string>>(new Set());
	function toggleOnboarding(taskId: string) {
		if (expandedOnboarding.has(taskId)) {
			setExpandedOnboarding(prev => {
				const next = new Set(prev);
				next.delete(taskId);
				return next;
			});
			return;
		}
		setExpandedOnboarding(prev => new Set(prev).add(taskId));
		if (!(taskId in onboardingForms)) loadOnboardingForm(taskId);
	}
	const [fillingOnboardingTaskId, setFillingOnboardingTaskId] = useState<string | null>(null);
	const [onboardingFillValues, setOnboardingFillValues] = useState({
		billingName: "", billingEmail: "", billingPhone: "", billingSecondaryPhone: "", billingAddress: "", gstin: "",
		deliveryContactName: "", deliveryPhone: "", deliverySecondaryPhone: "", deliveryAddress: "", deliveryNotes: "",
	});
	const [fillSameAsBilling, setFillSameAsBilling] = useState(false);
	const [viewingOnboardingTaskId, setViewingOnboardingTaskId] = useState<string | null>(null);

	// Design proof: same lazy-load + show/hide-without-refetch pattern as
	// Onboarding form above. Latest request per task is requests[0] (server
	// returns newest-first).
	const [proofRequestsData, setProofRequestsData] = useState<Record<string, ProofRequest[]>>({});
	const [proofLoadingTaskId, setProofLoadingTaskId] = useState<string | null>(null);
	const [expandedProofs, setExpandedProofs] = useState<Set<string>>(new Set());
	async function loadProofRequests(taskId: string) {
		setProofLoadingTaskId(taskId);
		try {
			const res = await fetch(`/api/tasks/${taskId}/proof-requests`);
			if (res.ok) {
				const json = await res.json();
				setProofRequestsData(prev => ({ ...prev, [taskId]: json.proofRequests ?? [] }));
			}
		} finally {
			setProofLoadingTaskId(null);
		}
	}
	function toggleProofs(taskId: string) {
		if (expandedProofs.has(taskId)) {
			setExpandedProofs(prev => {
				const next = new Set(prev);
				next.delete(taskId);
				return next;
			});
			return;
		}
		setExpandedProofs(prev => new Set(prev).add(taskId));
		if (!(taskId in proofRequestsData)) loadProofRequests(taskId);
	}
	const [composingProofTaskId, setComposingProofTaskId] = useState<string | null>(null);
	const [proofFilesToUpload, setProofFilesToUpload] = useState<File[]>([]);
	const [sendingProofTaskId, setSendingProofTaskId] = useState<string | null>(null);
	async function submitProof(taskId: string) {
		if (proofFilesToUpload.length === 0) return;
		setSendingProofTaskId(taskId);
		try {
			const uploaded: ProofFile[] = [];
			for (const file of proofFilesToUpload) {
				const formData = new FormData();
				formData.append("file", file);
				const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
				if (uploadRes.ok) {
					const uploadResult = await uploadRes.json();
					uploaded.push({ url: uploadResult.url, name: uploadResult.originalName || uploadResult.filename });
				}
			}
			if (uploaded.length === 0) {
				setError("Couldn't upload the file(s). Try again.");
				return;
			}
			const res = await fetch(`/api/tasks/${taskId}/proof-requests`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ files: uploaded }),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				setError(typeof json.error === "string" ? json.error : "Couldn't send the proof.");
				return;
			}
			navigator.clipboard?.writeText(json.link).catch(() => {});
			alert(`Link copied to clipboard:\n${json.link}`);
			setComposingProofTaskId(null);
			setProofFilesToUpload([]);
			await loadProofRequests(taskId);
		} finally {
			setSendingProofTaskId(null);
		}
	}

	// Payments: total + list per task, loaded lazily (Accounts-team gated,
	// so unlike most sections this is never fetched until asked for).
	const [paymentData, setPaymentData] = useState<Record<string, { totalAmount: number | null; payments: Payment[] } | undefined>>({});
	const [paymentLoadingTaskId, setPaymentLoadingTaskId] = useState<string | null>(null);
	// Same show/hide-without-refetch pattern as expandedOnboarding above.
	const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
	function togglePayments(taskId: string) {
		if (expandedPayments.has(taskId)) {
			setExpandedPayments(prev => {
				const next = new Set(prev);
				next.delete(taskId);
				return next;
			});
			return;
		}
		setExpandedPayments(prev => new Set(prev).add(taskId));
		if (!(taskId in paymentData)) loadPayments(taskId);
	}
	const [editingTotalTaskId, setEditingTotalTaskId] = useState<string | null>(null);
	const [totalAmountDraft, setTotalAmountDraft] = useState("");
	const [addingPaymentToTaskId, setAddingPaymentToTaskId] = useState<string | null>(null);
	const [paymentAmount, setPaymentAmount] = useState("");
	const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [paymentMode, setPaymentMode] = useState("CASH");
	const [paymentNotes, setPaymentNotes] = useState("");
	const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

	const AUTO_REFRESH_SECONDS = 120;
	const [groupBy, setGroupBy] = useState<"none"|"customer"|"status"|"assignee">("none");
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [anyDatePickerOpen, setAnyDatePickerOpen] = useState(false);
	const countdownRef = useRef(AUTO_REFRESH_SECONDS);
	const displayRef = useRef<HTMLSpanElement>(null);
	// Guards the deep-link effect below from re-firing (and re-toggling the
	// payments panel shut) on every background auto-refresh once it's
	// already handled a given ?open=&showPayments= combination.
	const handledDeepLinkRef = useRef<string | null>(null);
	// Guards the standalone-task fallback fetch below from retrying forever
	// once it's tried (successfully or not) for a given id.
	const fetchedStandaloneTaskRef = useRef<string | null>(null);

	// A deep-linked task that isn't archived-excluded-by-default in the main
	// list (e.g. opened from /archive) never shows up in `tasks`, so the
	// deep-link effect below would silently do nothing. Once the main list
	// has finished its first load, if the requested id still isn't present,
	// fetch it directly and splice it in -- reuses every existing render path
	// (Items, Payments, Comments, Onboarding, Proof) instead of duplicating
	// them in a second, view-only copy the way the old Archive page did.
	useEffect(() => {
		const openId = searchParams.get("open");
		if (!openId || loading) return;
		if (tasks.some((t) => t.id === openId)) return;
		if (fetchedStandaloneTaskRef.current === openId) return;
		fetchedStandaloneTaskRef.current = openId;

		fetch(`/api/tasks/${openId}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((json) => {
				if (!json?.task) return;
				setTasks((prev) => (prev.some((t) => t.id === openId) ? prev : [...prev, transformTask(json.task)]));
			})
			.catch(() => {});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams, loading, tasks.length]);

	// Deep-link support: /tasks?open=<taskId> (used by Dashboard's
	// "Upcoming Deadlines" links) opens that task's detail view once
	// tasks have loaded. /tasks?open=<taskId>&showPayments=1 (used by the
	// Payments page) instead expands that task's card inline and reveals
	// its Payment section, rather than the generic View modal -- someone
	// clicking through from Payments wants the payment breakdown, not a
	// read-only summary of the whole task.
	useEffect(() => {
		const openId = searchParams.get("open");
		if (!openId || !tasks.some((t) => t.id === openId)) return;
		const showPayments = searchParams.get("showPayments") === "1";
		const dedupeKey = `${openId}:${showPayments}`;
		if (handledDeepLinkRef.current === dedupeKey) return;

		if (!showPayments) {
			handledDeepLinkRef.current = dedupeKey;
			setViewingId(openId);
			return;
		}

		// The <details> for this task's card may not be in the DOM yet on the
		// very render where `tasks` first includes it (the list can still be
		// mid-commit, e.g. behind a loading-skeleton swap) -- poll briefly
		// instead of giving up on the first missed lookup, which used to mark
		// the deep link "handled" even when nothing actually happened.
		let attempts = 0;
		const tryExpand = () => {
			const details = document.getElementById(`task-details-${openId}`) as HTMLDetailsElement | null;
			if (details) {
				handledDeepLinkRef.current = dedupeKey;
				details.open = true;
				details.scrollIntoView({ behavior: "smooth", block: "start" });
				togglePayments(openId);
				return;
			}
			attempts += 1;
			if (attempts < 20) setTimeout(tryExpand, 100);
		};
		tryExpand();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams, tasks.length]);

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
		if (!newCustomerForm.name.trim()) return;
		if (!newCustomerForm.email.trim() && !newCustomerForm.phone.trim()) {
			setError("Add an email address or a phone number — either one is enough.");
			return;
		}

		try {
			const res = await fetch("/api/customers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(customerFormToPayload(newCustomerForm))
			});

			if (res.ok) {
				const { customer } = await res.json();
				setCustomers(prev => [...prev, customer]);
				setCustomerId(customer.id);
				setShowNewCustomerForm(false);
				setNewCustomerForm(EMPTY_CUSTOMER_FORM);
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

	// Shared shape-normalizing step for a raw task straight from the API
	// (parse specFields/customFields JSON strings, derive onboardingStatus) --
	// used both by the main list load() below and by the single-task fallback
	// fetch for a deep-linked task that isn't part of the active list (e.g.
	// an archived task opened from /archive).
	function transformTask(t: any): Task {
		return {
			...t,
			subtasks: t.subtasks ?? [],
			despatchItems: (t.despatchItems ?? []).map((d: any) => ({
				...d,
				specFields: typeof d.specFields === "string" ? (() => { try { return JSON.parse(d.specFields); } catch { return {}; } })() : (d.specFields || {})
			})),
			onboardingStatus: t.onboardingForms?.[0]?.status ?? null,
			customFields: typeof t.customFields === "string" ? (() => { try { return JSON.parse(t.customFields); } catch { return {}; } })() : (t.customFields || {})
		};
	}

	async function load() {
		// Only show the skeleton on the very first load (nothing on screen
		// yet). Auto-refresh and "Refresh now" reuse this same function, and
		// toggling loading=true on every call was unmounting the whole task
		// list (including every open <details> card) on each background
		// refresh -- collapsing anything the user had expanded.
		if (tasks.length === 0) setLoading(true);
		try {
			const [resTasks, resCustomers, resUsers, resCategories, resTeams] = await Promise.all([
				fetch("/api/tasks?limit=100&includeArchived=false&includeQuotations=false"),
				fetch("/api/customers"),
				fetch("/api/users"),
				fetch("/api/categories"),
				fetch("/api/teams")
			]);
			
		if (resTasks.ok) {
			const json = await resTasks.json();
				const loaded: Task[] = (json.tasks ?? []).map(transformTask);
				// The active-tasks list excludes archived tasks by design, but a
				// deep-linked archived task (see the standalone-fetch effect
				// below) was spliced in outside this fetch -- keep it across a
				// refresh instead of having it silently vanish again every
				// ~2 minutes while someone's still looking at it.
				const openId = searchParams.get("open");
				setTasks(prev => {
					if (!openId || loaded.some(t => t.id === openId)) return loaded;
					const standalone = prev.find(t => t.id === openId);
					return standalone ? [...loaded, standalone] : loaded;
				});
			}
			
			if (resCustomers.ok) {
				const json = await resCustomers.json();
				setCustomers((json.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })));
			}

			if (resCategories.ok) {
				const json = await resCategories.json();
				setDynamicCategories(json.categories ?? []);
			}
			
			if (resUsers.ok) {
				const json = await resUsers.json();
				setUsers((json.users ?? []).map((u: any) => ({ id: u.id, name: u.name })));
			}

			if (resTeams.ok) {
				const json = await resTeams.json();
				setTeams((json.teams ?? []).map((t: any) => ({ id: t.id, name: t.name, memberIds: (t.members ?? []).map((m: any) => m.userId) })));
			}
		} catch (error) {
			console.error("Failed to load data:", error);
		} finally {
			setLoading(false);
		}
	}

	// Refreshes the sidebar "Tasks" badge after anything that changes the
	// count (delete, status change, create) — previously this only fired a
	// custom DOM event that nothing was ever listening for, so the badge
	// stayed stale until the next full navigation.
	function notifyDataChange() {
		window.dispatchEvent(new Event('dataChanged'));
		refreshCounts();
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

	// Derived filtered tasks (assigned to me)
	const filteredTasks = tasks
		.filter(task => (!assignedToMeOnly ? true : isAssignedToMe(task)));

	const PAYMENT_MODE_LABELS: Record<string, string> = {
		CASH: "Cash", BANK_TRANSFER: "Bank Transfer", UPI: "UPI", CHEQUE: "Cheque", CARD: "Card", OTHER: "Other",
	};
	const itemStatusChipClass = despatchItemStatusChipClass;
	function formatDueWithDaysRemaining(dueAt: string): string {
		const due = new Date(dueAt);
		const dateLabel = due.toLocaleDateString();
		// Compare calendar days, not exact 24h windows, so a due time later
		// today still reads as "(today)" rather than "(0 days left)".
		const startOfToday = new Date(new Date().toDateString());
		const startOfDue = new Date(due.toDateString());
		const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
		if (days === 0) return `Due ${dateLabel} (today)`;
		if (days > 0) return `Due ${dateLabel} (${days} day${days === 1 ? "" : "s"} left)`;
		return `Due ${dateLabel} (overdue by ${-days} day${days === -1 ? "" : "s"})`;
	}

	function getGroupKey(t: Task): string {
		switch (groupBy) {
			case "customer": return t.customerRef?.name || "No Customer";
			case "status": return t.status;
			case "assignee": return (t.assignments && t.assignments[0]?.user?.name) || "Unassigned";
			default: return "";
		}
	}

	function getGroupColorClasses(key: string): { bar: string; bg: string; dot: string } {
		const palette = [
			{ bar: "border-blue-500", bg: "", dot: "bg-blue-500" },
			{ bar: "border-green-500", bg: "", dot: "bg-green-500" },
			{ bar: "border-amber-500", bg: "", dot: "bg-amber-500" },
			{ bar: "border-purple-500", bg: "", dot: "bg-purple-500" },
			{ bar: "border-pink-500", bg: "", dot: "bg-pink-500" },
			{ bar: "border-teal-500", bg: "", dot: "bg-teal-500" },
			{ bar: "border-indigo-500", bg: "", dot: "bg-indigo-500" },
			{ bar: "border-rose-500", bg: "", dot: "bg-rose-500" },
			{ bar: "border-cyan-500", bg: "", dot: "bg-cyan-500" },
			{ bar: "border-lime-500", bg: "", dot: "bg-lime-500" },
			{ bar: "border-sky-500", bg: "", dot: "bg-sky-500" },
			{ bar: "border-violet-500", bg: "", dot: "bg-violet-500" },
			{ bar: "border-fuchsia-500", bg: "", dot: "bg-fuchsia-500" },
			{ bar: "border-emerald-500", bg: "", dot: "bg-emerald-500" },
			{ bar: "border-orange-500", bg: "", dot: "bg-orange-500" },
			{ bar: "border-yellow-500", bg: "", dot: "bg-yellow-500" },
			{ bar: "border-stone-500", bg: "", dot: "bg-stone-500" },
			{ bar: "border-slate-500", bg: "", dot: "bg-slate-500" },
			{ bar: "border-zinc-500", bg: "", dot: "bg-zinc-500" },
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

	// Items list functions
	function resetNewDespatchFields() {
		setNewDespatchName("");
		setNewDespatchQuantity("");
		setNewDespatchUnit("pcs");
		setNewDespatchCategory("");
		setNewDespatchSpecFields({});
	}

	function addDespatchDraftRow() {
		if (!newDespatchName.trim() || !newDespatchQuantity.trim()) return;
		setDespatchDraft(prev => [...prev, {
			name: newDespatchName.trim(),
			quantity: newDespatchQuantity,
			unit: newDespatchUnit.trim() || "pcs",
			category: newDespatchCategory,
			specFields: newDespatchSpecFields,
		}]);
		resetNewDespatchFields();
	}

	function removeDespatchDraftRow(index: number) {
		setDespatchDraft(prev => prev.filter((_, i) => i !== index));
	}

	async function createDespatchItem(taskId: string) {
		if (!newDespatchName.trim() || !newDespatchQuantity.trim()) return;

		const res = await fetch(`/api/tasks/${taskId}/despatch-items`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				items: [{
					name: newDespatchName.trim(),
					quantity: Number(newDespatchQuantity),
					unit: newDespatchUnit.trim() || "pcs",
					specFields: newDespatchCategory ? { ...newDespatchSpecFields, category: newDespatchCategory } : undefined,
				}]
			})
		});

		if (res.ok) {
			resetNewDespatchFields();
			setAddingDespatchItemToTaskId(null);
			load();
		}
	}

	async function updateDespatchItemStatus(itemId: string, status: DespatchItem["status"]) {
		const res = await fetch(`/api/despatch-items/${itemId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status })
		});
		if (res.ok) load();
	}

	async function deleteDespatchItem(itemId: string) {
		if (!confirm("Remove this item?")) return;
		const res = await fetch(`/api/despatch-items/${itemId}`, { method: "DELETE" });
		if (res.ok) load();
	}

	function startEditDespatchItem(item: DespatchItem) {
		setEditingDespatchItemId(item.id);
		setEditDespatchName(item.name);
		setEditDespatchQuantity(String(item.quantity));
		setEditDespatchUnit(item.unit);
		const { category, ...rest } = item.specFields ?? {};
		setEditDespatchCategory(category ?? "");
		setEditDespatchSpecFields(rest);
	}

	function cancelEditDespatchItem() {
		setEditingDespatchItemId(null);
	}

	async function saveDespatchItemEdit(itemId: string) {
		if (!editDespatchName.trim() || !editDespatchQuantity.trim()) return;
		const res = await fetch(`/api/despatch-items/${itemId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: editDespatchName.trim(),
				quantity: Number(editDespatchQuantity),
				unit: editDespatchUnit.trim() || "pcs",
				specFields: editDespatchCategory ? { ...editDespatchSpecFields, category: editDespatchCategory } : {},
			})
		});
		if (res.ok) {
			setEditingDespatchItemId(null);
			load();
		}
	}

	// Onboarding form functions
	async function loadOnboardingForm(taskId: string) {
		setOnboardingLoadingTaskId(taskId);
		try {
			const res = await fetch(`/api/tasks/${taskId}/onboarding-form`);
			if (res.ok) {
				const json = await res.json();
				setOnboardingForms(prev => ({ ...prev, [taskId]: json.form ?? null }));
			}
		} finally {
			setOnboardingLoadingTaskId(null);
		}
	}

	async function generateOnboardingLink(taskId: string, sendViaEmail: boolean) {
		const res = await fetch(`/api/tasks/${taskId}/onboarding-form`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sendEmail: sendViaEmail })
		});
		const json = await res.json().catch(() => ({}));
		if (!res.ok) {
			setError(json.error ?? "Failed to generate onboarding link");
			return;
		}
		setOnboardingForms(prev => ({ ...prev, [taskId]: json.form }));
		if (!sendViaEmail && json.link) {
			navigator.clipboard?.writeText(json.link).catch(() => {});
			alert(`Link copied to clipboard:\n${json.link}`);
		} else if (sendViaEmail && json.error) {
			// sendEmail requested but customer has no email on file — link was still created
			alert(`${json.error}. Link created — copy it instead:\n${json.link}`);
		}
	}

	function openOnboardingFillModal(taskId: string) {
		setFillingOnboardingTaskId(taskId);
		setFillSameAsBilling(false);
		setOnboardingFillValues({
			billingName: "", billingEmail: "", billingPhone: "", billingSecondaryPhone: "", billingAddress: "", gstin: "",
			deliveryContactName: "", deliveryPhone: "", deliverySecondaryPhone: "", deliveryAddress: "", deliveryNotes: "",
		});
	}

	const FILL_BILLING_TO_DELIVERY: Record<string, string> = {
		billingName: "deliveryContactName",
		billingPhone: "deliveryPhone",
		billingSecondaryPhone: "deliverySecondaryPhone",
		billingAddress: "deliveryAddress",
	};

	function updateOnboardingFillValue(key: keyof typeof onboardingFillValues, value: string) {
		setOnboardingFillValues(v => {
			const next = { ...v, [key]: value };
			const mirrored = fillSameAsBilling && FILL_BILLING_TO_DELIVERY[key];
			if (mirrored) (next as any)[mirrored] = value;
			return next;
		});
	}

	function toggleFillSameAsBilling(checked: boolean) {
		setFillSameAsBilling(checked);
		if (checked) {
			setOnboardingFillValues(v => ({
				...v,
				deliveryContactName: v.billingName,
				deliveryPhone: v.billingPhone,
				deliverySecondaryPhone: v.billingSecondaryPhone,
				deliveryAddress: v.billingAddress,
			}));
		}
	}

	async function submitOnboardingFill(taskId: string) {
		const res = await fetch(`/api/tasks/${taskId}/onboarding-form/fill`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(onboardingFillValues)
		});
		const json = await res.json().catch(() => ({}));
		if (!res.ok) {
			setError(typeof json.error === "string" ? json.error : "Failed to save onboarding details");
			return;
		}
		setOnboardingForms(prev => ({ ...prev, [taskId]: json.form }));
		setFillingOnboardingTaskId(null);
		load();
	}

	// Payment functions
	async function loadPayments(taskId: string) {
		setPaymentLoadingTaskId(taskId);
		try {
			const res = await fetch(`/api/tasks/${taskId}/payments`);
			if (res.ok) {
				const json = await res.json();
				setPaymentData(prev => ({ ...prev, [taskId]: { totalAmount: json.totalAmount ?? null, payments: json.payments ?? [] } }));
			}
		} finally {
			setPaymentLoadingTaskId(null);
		}
	}

	function startEditTotal(taskId: string, current: number | null | undefined) {
		setEditingTotalTaskId(taskId);
		setTotalAmountDraft(current != null ? String(current) : "");
	}

	async function saveTotal(taskId: string) {
		const res = await fetch(`/api/tasks/${taskId}/payments/total`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ totalAmount: totalAmountDraft.trim() === "" ? null : Number(totalAmountDraft) })
		});
		if (res.ok) {
			setEditingTotalTaskId(null);
			loadPayments(taskId);
		} else {
			const json = await res.json().catch(() => ({}));
			setError(typeof json.error === "string" ? json.error : "Couldn't save the total amount.");
		}
	}

	function resetPaymentDraft() {
		setPaymentAmount("");
		setPaymentDate(new Date().toISOString().slice(0, 10));
		setPaymentMode("CASH");
		setPaymentNotes("");
	}

	async function addPayment(taskId: string) {
		if (!paymentAmount.trim()) return;
		const res = await fetch(`/api/tasks/${taskId}/payments`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				amount: Number(paymentAmount),
				receivedAt: new Date(paymentDate).toISOString(),
				mode: paymentMode,
				notes: paymentNotes || undefined,
			})
		});
		if (res.ok) {
			resetPaymentDraft();
			setAddingPaymentToTaskId(null);
			loadPayments(taskId);
		} else {
			const json = await res.json().catch(() => ({}));
			setError(typeof json.error === "string" ? json.error : "Couldn't record the payment.");
		}
	}

	function startEditPayment(p: Payment) {
		setEditingPaymentId(p.id);
		setPaymentAmount(String(p.amount));
		setPaymentDate(p.receivedAt.slice(0, 10));
		setPaymentMode(p.mode);
		setPaymentNotes(p.notes ?? "");
	}

	async function saveEditedPayment(taskId: string, paymentId: string) {
		if (!paymentAmount.trim()) return;
		const res = await fetch(`/api/payments/${paymentId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				amount: Number(paymentAmount),
				receivedAt: new Date(paymentDate).toISOString(),
				mode: paymentMode,
				notes: paymentNotes || undefined,
			})
		});
		if (res.ok) {
			resetPaymentDraft();
			setEditingPaymentId(null);
			loadPayments(taskId);
		} else {
			const json = await res.json().catch(() => ({}));
			setError(typeof json.error === "string" ? json.error : "Couldn't save the payment.");
		}
	}

	async function deletePayment(taskId: string, paymentId: string) {
		if (!confirm("Delete this payment record?")) return;
		const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
		if (res.ok) loadPayments(taskId);
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

	// Edit-form attachments get their OWN state — previously this reused the
	// create-form's `files`/setFiles, so a file picked while editing task A
	// could silently vanish (or leak into the create-task panel) depending on
	// what else was open on the page. Only one task can be edited at a time
	// (editingId is a single id), so a single array here is safe.
	const [editFiles, setEditFiles] = useState<File[]>([]);
	const handleEditDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			setEditFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
		}
	};
	const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			setEditFiles(prev => [...prev, ...Array.from(e.target.files!)]);
		}
	};
	const removeEditFile = (index: number) => {
		setEditFiles(prev => prev.filter((_, i) => i !== index));
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
				assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
				teamIds: teamIds.length > 0 ? teamIds : undefined
			})
		});
		if (!res.ok) {
			setSubmitting(false);
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Failed to create task");
			return;
		}

		const { task: createdTask } = await res.json();

		if (despatchDraft.length > 0) {
			await fetch(`/api/tasks/${createdTask.id}/despatch-items`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					items: despatchDraft.map(d => ({
					name: d.name,
					quantity: Number(d.quantity),
					unit: d.unit,
					specFields: d.category ? { ...d.specFields, category: d.category } : undefined,
				}))
				})
			}).catch(() => {});
		}

		setSubmitting(false);
		setTitle("");
		setDesc("");
		{
			const now = new Date();
			const pad = (n: number) => String(n).padStart(2, "0");
			setStart(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
		}
		setDue("");
		setCustomerId("");
		setAssigneeIds([]);
		setTeamIds([]);
		setIsQuotation(false);
		setCustom({});
		setFiles([]);
		setDespatchDraft([]);
		setShowNewCustomerForm(false);
		setNewCustomerForm(EMPTY_CUSTOMER_FORM);
		load();
		notifyDataChange();
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
				assigneeIds: task.assignments?.map(a => a.user.id) || undefined,
				teamIds: task.teamAssignments?.map(ta => ta.team.id) || undefined
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
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
				<p className="text-sm text-muted mt-0.5">Jobs, subtasks, and assignments</p>
			</div>
			<details className="card relative">
				{editingId && (
					<div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center rounded-[0.85rem]">
						<div className="card card-pad shadow-lg">
							<p className="font-medium">Editing task…</p>
						</div>
					</div>
				)}
				<summary className="list-none cursor-pointer select-none card-pad flex items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
					<span>+ Create task</span>
					<span className="meta">TAP TO EXPAND</span>
				</summary>
				<div className="card-pad pt-0">
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
					<input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
					<textarea className="input" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
					{showNewCustomerForm ? (
						<div className="space-y-3 p-3 border border-line rounded-lg bg-wash">
							<div className="flex items-center justify-between">
								<h3 className="font-medium text-sm">Add New Customer</h3>
								<button
									type="button"
									onClick={() => {
										setShowNewCustomerForm(false);
										setNewCustomerForm(EMPTY_CUSTOMER_FORM);
										setError(null);
									}}
									className="text-sm text-gray-500 hover:text-gray-700"
								>
									Cancel
								</button>
							</div>
							<CustomerFields
								values={newCustomerForm}
								onChange={(key, value) => setNewCustomerForm(v => ({ ...v, [key]: value }))}
								idPrefix="new-task-customer"
							/>
							{error && <p className="text-sm text-danger">{error}</p>}
							<button
								type="button"
								onClick={createNewCustomer}
								className="btn btn-accent btn-block"
							>
								Create Customer
							</button>
						</div>
					) : (
						<select className="input" value={customerId} onChange={e => {
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
					<div className="border border-line-strong rounded-lg p-2.5 max-h-40 overflow-y-auto space-y-1">
						<div className="field-label !mb-1.5">Assign to (select any number)</div>
						{users.map(u => (
							<label key={u.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
								<input
									type="checkbox"
									checked={assigneeIds.includes(u.id)}
									onChange={e => setAssigneeIds(e.target.checked ? [...assigneeIds, u.id] : assigneeIds.filter(id => id !== u.id))}
								/>
								{u.name}
							</label>
						))}
					</div>

					{teams.length > 0 && (
						<div className="border border-line-strong rounded-lg p-2.5 max-h-32 overflow-y-auto space-y-1">
							<div className="field-label !mb-1.5">Teams</div>
							{teams.map(team => (
								<label key={team.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
									<input
										type="checkbox"
										checked={teamIds.includes(team.id)}
										onChange={e => setTeamIds(e.target.checked ? [...teamIds, team.id] : teamIds.filter(id => id !== team.id))}
									/>
									{team.name}
								</label>
							))}
						</div>
					)}

					{!isQuotation && (
						<>
							<DateTimeSelector label="Start" value={start} onChange={setStart} />
							<DateTimeSelector label="Due" value={due} onChange={setDue} defaultTime="17:00" />
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
								<div key={index} className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-wash rounded-lg">
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

					{/* Items list */}
					<div className="space-y-2">
						<h4 className="text-sm font-medium">Items</h4>
						{despatchDraft.length > 0 && (
							<div className="space-y-1.5">
								{despatchDraft.map((row, index) => (
									<div key={index} className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-wash rounded-lg">
										<span className="text-sm">{row.name} — {row.quantity} {row.unit}{row.category ? ` · ${row.category}` : ""}</span>
										<button type="button" onClick={() => removeDespatchDraftRow(index)} className="text-red-600 text-sm">Remove</button>
									</div>
								))}
							</div>
						)}
						<div className="space-y-2 p-3 border border-line rounded-lg bg-wash">
							<div className="flex flex-wrap gap-2">
								<select className="input flex-1 min-w-[8rem]" value={newDespatchCategory} onChange={(e) => setNewDespatchCategory(e.target.value)}>
									<option value="">Select type</option>
									<option value="Rigid Boxes">Rigid Boxes</option>
									<option value="Cake Boxes">Cake Boxes</option>
									<option value="Paper Bags">Paper Bags</option>
									<option value="Stickers">Stickers</option>
									<option value="Cards">Cards</option>
									<option value="Invitation">Invitation</option>
									<option value="Paperboard Boxes">Paperboard Boxes</option>
									<option value="Others">Others</option>
									{dynamicCategories.map(c => (<option key={c.id} value={c.name}>{c.name}</option>))}
								</select>
								<input className="input flex-[2] min-w-[8rem]" placeholder="Item name" value={newDespatchName} onChange={(e) => setNewDespatchName(e.target.value)} />
								<input className="input flex-1 min-w-[6rem]" placeholder="Size" value={newDespatchSpecFields.size ?? ""} onChange={(e) => setNewDespatchSpecFields(v => ({ ...v, size: e.target.value }))} />
								<div className="flex gap-1 flex-1 min-w-[8rem]">
									<input className="input" type="number" min="0" step="any" placeholder="Qty" value={newDespatchQuantity} onChange={(e) => setNewDespatchQuantity(e.target.value)} />
									<input className="input" placeholder="Unit" value={newDespatchUnit} onChange={(e) => setNewDespatchUnit(e.target.value)} />
								</div>
							</div>
							<ItemSpecFields
								category={newDespatchCategory}
								specFields={newDespatchSpecFields}
								onFieldChange={(key, value) => setNewDespatchSpecFields(v => ({ ...v, [key]: value }))}
								dynamicCategories={dynamicCategories}
							/>
							<button type="button" className="btn btn-outline btn-sm" onClick={addDespatchDraftRow}>+ Add item</button>
						</div>
					</div>

					{error && <p className="text-sm text-danger">{error}</p>}
					<button type="submit" className="w-full bg-black text-white py-2 px-3 rounded hover:bg-gray-800 disabled:opacity-50" disabled={submitting}>
						{submitting ? "Creating..." : "Create task"}
					</button>
				</form>
				</div>
			</details>
			<section>
				<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
					<h2 className="text-lg font-medium">All tasks</h2>
					<div className="flex flex-wrap items-center gap-2">
						{selectedIds.length > 0 && (
							<>
								<button
									type="button"
									className="btn btn-outline btn-sm"
									onClick={async () => {
										if (!confirm(`Archive ${selectedIds.length} task${selectedIds.length !== 1 ? 's' : ''}?`)) return;
										let failures = 0;
										for (const id of selectedIds) {
											const res = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ status: "ARCHIVED" }) });
											if (!res.ok) failures++;
										}
										clearSelection();
										load();
										if (failures > 0) {
											setError(`${failures} of ${selectedIds.length} task${failures !== 1 ? 's' : ''} couldn't be archived (you can only archive tasks assigned to you).`);
										}
									}}
								>
									Bulk Archive ({selectedIds.length})
								</button>
								{isAdmin && (
								<button
									type="button"
									className="btn btn-danger-outline btn-sm"
									onClick={async () => {
										if (!confirm(`Delete ${selectedIds.length} task${selectedIds.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
										let failures = 0;
										for (const id of selectedIds) {
											const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
											if (!res.ok) failures++;
										}
										clearSelection();
										load();
										if (failures > 0) {
											setError(`${failures} of ${selectedIds.length} task${failures !== 1 ? 's' : ''} couldn't be deleted.`);
										}
									}}
								>
									Bulk Delete ({selectedIds.length})
								</button>
								)}
							</>
						)}
						<span className="text-xs text-gray-600" ref={displayRef}>Auto refresh in {AUTO_REFRESH_SECONDS}s</span>
						<button type="button" className="btn btn-outline btn-sm" onClick={() => { countdownRef.current = AUTO_REFRESH_SECONDS; load(); }}>Refresh now</button>

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
						className="btn btn-outline btn-sm"
					>
						Archive Completed ({filteredTasks.filter(t => t.status === "DONE").length})
					</button>
						<a className="btn btn-outline btn-sm" href="/api/export/tasks-csv">Export CSV</a>
						<form action="/api/export/tasks-sheets" method="post" className="inline">
						<button className="btn btn-outline btn-sm" type="submit">Export to Google Sheets</button>
						</form>
					</div>
				
				{/* Filters row */}
				<div className="mb-4 flex items-end justify-between gap-4">
					<div className="flex flex-wrap items-end gap-4">
						<div>
							<label className="field-label">Group by:</label>
							<select
								value={groupBy}
								onChange={(e) => setGroupBy(e.target.value as any)}
								className="btn btn-outline btn-sm"
							>
								<option value="none">None</option>
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
					<p className="text-center text-muted py-10">No tasks match. Create one above, or clear the filters.</p>
				) : (
				<ul className="space-y-2">
						{listForRender.map((t, index) => {
							const gkey = getGroupKey(t);
							const color = groupBy !== "none" ? getGroupColorClasses(gkey) : null;
							return (
						<li
							key={t.id}
							className={"ticket p-3.5 " + (groupBy !== "none" ? ("border-l-4 " + (color ? color.bar : "") + " " + (color ? color.bg : "")) : "")}
							style={{ ["--ticket" as any]:
								t.status === "DONE" ? "var(--ok)"
								: t.status === "IN_PROGRESS" ? "var(--accent)"
								: t.status === "BLOCKED" || t.status === "CANCELLED" ? "var(--danger)"
								: undefined }}
						>
							{groupBy !== "none" && (index === 0 || getGroupKey(listForRender[index-1]) !== gkey) && (
								<div className="-mt-1 -mb-1 pb-2">
							<div className="flex items-center justify-between">
										<h3 className="text-sm font-medium flex items-center gap-2">
											<span className={`inline-block w-2.5 h-2.5 rounded-full ${color?.dot || ""}`}></span>
											{gkey}
										</h3>
										<span className="meta">Group</span>
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
										for (const file of editFiles) {
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
												assigneeIds,
												teamIds,
												customFields: {
													...t.customFields,
													...custom,
													attachments: allAttachments
												}
											})
										});
										setEditingId(null);
										setEditFiles([]);
										setCustom({});
										setCustomerId("");
										setAssigneeIds([]);
										setTeamIds([]);
										load();
									}}
									className="space-y-4"
								>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="field-label">Title</label>
											<input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
										</div>
										<div>
											<label className="field-label">Status</label>
																							<select className="input" value={editStatus} onChange={e => setEditStatus(e.target.value as Task["status"]) }>
												<option value="TODO">To do</option>
												<option value="IN_PROGRESS">In progress</option>
												<option value="BLOCKED">Blocked</option>
												<option value="DONE">Done</option>
												<option value="CANCELLED">Cancelled</option>
												<option value="ARCHIVED">Archived</option>
												<option value="CLIENT_TO_REVERT">Client to revert</option>
											</select>
											</div>
										</div>

										<div>
											<label className="field-label">Description</label>
											<textarea className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
										</div>

										<div className="grid grid-cols-2 gap-4">
											<div>
												<label className="field-label">Customer</label>
												{showNewCustomerForm ? (
											<div className="space-y-3 p-3 border border-line rounded-lg bg-wash">
												<div className="flex items-center justify-between">
													<h3 className="font-medium text-sm">Add New Customer</h3>
													<button
														type="button"
														onClick={() => {
															setShowNewCustomerForm(false);
															setNewCustomerForm(EMPTY_CUSTOMER_FORM);
															setError(null);
														}}
														className="text-sm text-gray-500 hover:text-gray-700"
													>
														Cancel
													</button>
												</div>
												<CustomerFields
													values={newCustomerForm}
													onChange={(key, value) => setNewCustomerForm(v => ({ ...v, [key]: value }))}
													idPrefix="edit-task-customer"
												/>
												{error && <p className="text-sm text-danger">{error}</p>}
												<button
													type="button"
													onClick={createNewCustomer}
													className="btn btn-accent btn-block"
												>
													Create Customer
												</button>
											</div>
											) : (
												<select className="input" value={customerId} onChange={e => {
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
											<label className="field-label">Assign to</label>
											<div className="border border-line-strong rounded-lg p-2.5 max-h-40 overflow-y-auto space-y-1">
												{users.map(u => (
													<label key={u.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
														<input type="checkbox" checked={assigneeIds.includes(u.id)} onChange={e => setAssigneeIds(e.target.checked ? [...assigneeIds, u.id] : assigneeIds.filter(id => id !== u.id))} />
														{u.name}
												</label>
												))}
											</div>
										</div>
									</div>

									{teams.length > 0 && (
										<div>
											<label className="field-label">Teams</label>
											<div className="border border-line-strong rounded-lg p-2.5 max-h-32 overflow-y-auto space-y-1">
												{teams.map(team => (
													<label key={team.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
														<input
															type="checkbox"
															checked={teamIds.includes(team.id)}
															onChange={e => setTeamIds(e.target.checked ? [...teamIds, team.id] : teamIds.filter(id => id !== team.id))}
														/>
														{team.name}
													</label>
												))}
											</div>
										</div>
									)}

									<DateTimeSelector label="Start" value={editStart} onChange={setEditStart} />
									<DateTimeSelector label="Due" value={editDue} onChange={setEditDue} defaultTime="17:00" />

									{/* File Upload */}
									<div
										className={`border-2 border-dashed rounded-lg p-4 text-center ${
											dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
										}`}
										onDragEnter={handleDrag}
										onDragLeave={handleDrag}
										onDragOver={handleDrag}
										onDrop={handleEditDrop}
									>
										<input
											type="file"
											multiple
											onChange={handleEditFileSelect}
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
									{editFiles.length > 0 && (
										<div className="space-y-2">
											<h4 className="text-sm font-medium">New Files:</h4>
											{editFiles.map((file, index) => (
												<div key={index} className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-wash rounded-lg">
													<span className="text-sm truncate max-w-[60vw]">{file.name}</span>
													<button
														type="button"
														onClick={() => removeEditFile(index)}
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
												<div key={index} className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-wash rounded-lg">
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
											setEditFiles([]);
											setCustom({});
											setCustomerId("");
											setAssigneeIds([]);
											setTeamIds([]);
											setShowNewCustomerForm(false);
											setNewCustomerForm(EMPTY_CUSTOMER_FORM);
										}}>Cancel</button>
									</div>
								</form>
							) : (
								<>
								<details id={`task-details-${t.id}`}>
									<summary className="list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-[10px] w-5 h-5 inline-flex items-center justify-center rounded-full bg-black text-white shrink-0">{index + 1}</span>
											<span className="font-medium">{t.title}</span>
											{t.dueAt && <span className="meta">{formatDueWithDaysRemaining(t.dueAt)}</span>}
											{t.onboardingStatus === "PENDING" && <span className="chip chip-warn">Onboarding: Pending</span>}
											{t.onboardingStatus === "SUBMITTED" && <span className="chip chip-ok">Onboarding: Submitted</span>}
										</div>
									</summary>
									<div className="pt-2">
							{/* Customer / assignees / creator — plain labeled lines, no pills */}
							<div className="mt-1 space-y-0.5 text-sm">
								{t.customerRef?.name && (
									<div>
										Customer: {t.customerRef.name}{" "}
										<a href="/customers" className="text-xs text-blue-600 hover:underline">(billing & delivery details)</a>
									</div>
								)}
								{((t.assignments && t.assignments.length > 0) || (t.teamAssignments && t.teamAssignments.length > 0)) && (
									<div>
										Assigned: {[
											...(t.assignments ? t.assignments.map(a => a.user.name) : []),
											...(t.teamAssignments ? t.teamAssignments.map(ta => `${ta.team.name} (team)`) : []),
										].join(", ")}
									</div>
								)}
								{t.createdBy && (
									<div className="meta">Created by {t.createdBy.name}</div>
								)}
							</div>
									<div className="mt-2 flex gap-2">
										<button
											type="button"
											className="btn btn-outline btn-sm"
											onClick={() => {
												setEditingId(t.id);
												setEditTitle(t.title);
												setEditDesc(t.description);
												setEditStatus(t.status);
												setEditStart(t.startAt ? new Date(t.startAt).toISOString().slice(0,16) : "");
												setEditDue(t.dueAt ? new Date(t.dueAt).toISOString().slice(0,16) : "");
												setCustomerId(t.customerId || "");
												setAssigneeIds(t.assignments?.map(a => a.user.id) || []);
												setTeamIds(t.teamAssignments?.map(ta => ta.team.id) || []);
												setCustom(t.customFields || {});
												setEditFiles([]);
											}}
										>
											Edit
										</button>
										<button
											type="button"
											className="btn btn-outline btn-sm"
											onClick={() => setViewingId(t.id)}
										>
											View
										</button>
										<button
											type="button"
											className="btn btn-outline btn-sm relative"
											onClick={() => toggleComments(t.id)}
										>
											💬 {expandedComments.has(t.id) ? "Hide comments" : "Comments"}
											{!!t.unreadCommentCount && (
												<span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none">
													{t.unreadCommentCount > 9 ? "9+" : t.unreadCommentCount}
												</span>
											)}
										</button>
										<button
											type="button"
											className="btn btn-outline btn-sm"
											onClick={() => deleteTask(t.id)}
											disabled={deletingId === t.id}
										>
											{deletingId === t.id ? "Deleting..." : "Delete"}
										</button>

										<button
											type="button"
											className="btn btn-outline btn-sm"
											onClick={() => duplicateTask(t)}
											disabled={duplicatingId === t.id}
										>
											{duplicatingId === t.id ? "Duplicating..." : "Duplicate"}
										</button>
									</div>

									{expandedComments.has(t.id) && (
										<div className="mt-3">
											<TaskComments taskId={t.id} mentionable={[...users.map(u => ({ id: u.id, name: u.name })), ...teams.map(team => ({ id: team.id, name: team.name }))]} />
										</div>
									)}

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
												className="space-y-3 p-3 border border-line rounded-lg bg-wash"
											>
												<div className="grid grid-cols-2 gap-3">
													<div>
														<label className="field-label">Title</label>
														<input
															type="text"
															className="input text-sm"
															value={subtaskTitle}
															onChange={(e) => setSubtaskTitle(e.target.value)}
															placeholder="Subtask title"
															required
														/>
													</div>
													<div>
														<label className="field-label">Assign to</label>
														<select
															className="input text-sm"
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
														<label className="field-label">Due Date</label>
														<DateTimeSelector
															label="Due"
															value={subtaskDueAt}
															onChange={setSubtaskDueAt}
															defaultTime="17:00"
														/>
													</div>
													<div>
														<label className="field-label">Est. Hours</label>
														<input
															type="number"
															step="0.5"
															className="input text-sm"
															value={subtaskEstimatedHours || ""}
															onChange={(e) => setSubtaskEstimatedHours(e.target.valueAsNumber || null)}
														/>
													</div>
												</div>
												<div className="flex gap-2">
													<button
														type="submit"
														className="btn btn-accent btn-sm"
													>
														Add Subtask
													</button>
													<button
														type="button"
														className="btn btn-outline btn-sm"
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
																		<label className="field-label">Title</label>
																		<input
																			type="text"
																			className="input text-sm"
																			value={editSubtaskTitle}
																			onChange={(e) => setEditSubtaskTitle(e.target.value)}
																			placeholder="Subtask title"
																			required
																		/>
																	</div>
																	<div>
																		<label className="field-label">Assign to</label>
																		<select
																			className="input text-sm"
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
																		<label className="field-label">Due Date</label>
																		<DateTimeSelector 
																			label="Due" 
																			value={editSubtaskDueAt} 
																			onChange={setEditSubtaskDueAt} 
																			defaultTime="17:00"
																		/>
																	</div>
																	<div>
																		<label className="field-label">Est. Hours</label>
																		<input
																			type="number"
																			step="0.5"
																			className="input text-sm"
																			value={editSubtaskEstimatedHours || ""}
																			onChange={(e) => setEditSubtaskEstimatedHours(e.target.valueAsNumber || null)}
																		/>
																	</div>
																</div>
																<div className="flex gap-2">
																	<button
																		type="submit"
																		className="btn btn-accent btn-sm"
																	>
																		Save
																	</button>
																	<button
																		type="button"
																		className="btn btn-outline btn-sm"
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
																			<span className="meta">
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
																		className="btn btn-outline btn-sm"
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

									{/* Onboarding Form Section */}
									<div className="mt-4 border-t border-gray-200 pt-4">
										<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
											<h4 className="text-sm font-medium">Onboarding form</h4>
											<button
												type="button"
												className="text-xs px-2 py-1 rounded border"
												onClick={() => toggleOnboarding(t.id)}
												disabled={onboardingLoadingTaskId === t.id}
											>
												{onboardingLoadingTaskId === t.id ? "Loading..." : expandedOnboarding.has(t.id) ? "Hide status" : "Show status"}
											</button>
										</div>

										{expandedOnboarding.has(t.id) && t.id in onboardingForms && (() => {
											const form = onboardingForms[t.id];
											return (
												<div className="space-y-2">
													<p className="text-sm">
														{!form && "No form sent yet."}
														{form?.status === "PENDING" && `Pending — expires ${new Date(form.expiresAt).toLocaleDateString()}`}
														{form?.status === "SUBMITTED" && !form.filledByStaff && `Submitted by customer${form.submittedAt ? " on " + new Date(form.submittedAt).toLocaleDateString() : ""}`}
														{form?.status === "SUBMITTED" && form.filledByStaff && `Submitted by ${form.filledByStaff.name}${form.submittedAt ? " on " + new Date(form.submittedAt).toLocaleDateString() : ""}`}
													</p>
													<div className="flex flex-wrap gap-2">
														<button type="button" className="btn btn-outline btn-sm" onClick={() => generateOnboardingLink(t.id, false)}>
															{form && form.status === "PENDING" ? "Resend (copy new link)" : "Generate & copy link"}
														</button>
														<button
															type="button"
															className="btn btn-outline btn-sm"
															onClick={() => generateOnboardingLink(t.id, true)}
															disabled={!t.customerRef?.email}
															title={!t.customerRef?.email ? "Linked customer has no email on file" : undefined}
														>
															Email to customer
														</button>
														<button type="button" className="btn btn-outline btn-sm" onClick={() => openOnboardingFillModal(t.id)}>
															Fill in manually
														</button>
														{form?.status === "SUBMITTED" && (
															<button type="button" className="btn btn-outline btn-sm" onClick={() => setViewingOnboardingTaskId(t.id)}>
																View details
															</button>
														)}
													</div>
												</div>
											);
										})()}
									</div>

					{/* Design Proof Section */}
					<div className="mt-4 border-t border-gray-200 pt-4">
						<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
							<h4 className="text-sm font-medium">Design proof</h4>
							<button
								type="button"
								className="text-xs px-2 py-1 rounded border"
								onClick={() => toggleProofs(t.id)}
								disabled={proofLoadingTaskId === t.id}
							>
								{proofLoadingTaskId === t.id ? "Loading..." : expandedProofs.has(t.id) ? "Hide status" : "Show status"}
							</button>
						</div>

						{expandedProofs.has(t.id) && t.id in proofRequestsData && (() => {
							const requests = proofRequestsData[t.id] ?? [];
							const latest = requests[0];
							return (
								<div className="space-y-2">
									{!latest && <p className="text-sm">No proof sent yet.</p>}
									{latest && (
										<div className="text-sm space-y-1">
											<div className="flex items-center gap-2">
												<span className={
													latest.status === "APPROVED" ? "chip chip-ok" :
													latest.status === "REJECTED" ? "chip chip-danger" : "chip chip-plain"
												}>{latest.status}</span>
												<span className="text-muted">
													{latest.files.length} file{latest.files.length === 1 ? "" : "s"} sent {new Date(latest.createdAt).toLocaleDateString()}
												</span>
											</div>
											{latest.status === "REJECTED" && latest.customerNote && (
												<p className="text-danger">Customer feedback: {latest.customerNote}</p>
											)}
										</div>
									)}

									{composingProofTaskId === t.id ? (
										<div className="space-y-2 p-3 border border-line rounded-lg bg-wash">
											<input
												type="file"
												multiple
												onChange={(e) => setProofFilesToUpload(Array.from(e.target.files || []))}
											/>
											<div className="flex gap-2">
												<button
													type="button"
													className="btn btn-primary btn-sm"
													onClick={() => submitProof(t.id)}
													disabled={proofFilesToUpload.length === 0 || sendingProofTaskId === t.id}
												>
													{sendingProofTaskId === t.id ? "Sending..." : "Send for approval"}
												</button>
												<button
													type="button"
													className="btn btn-outline btn-sm"
													onClick={() => { setComposingProofTaskId(null); setProofFilesToUpload([]); }}
												>
													Cancel
												</button>
											</div>
										</div>
									) : (
										<button type="button" className="btn btn-outline btn-sm" onClick={() => setComposingProofTaskId(t.id)}>
											Send new proof
										</button>
									)}
								</div>
							);
						})()}
					</div>

					{/* Payment Section — admins + Accounts team only */}
					{canSeePayments && (
						<div className="mt-4 border-t border-gray-200 pt-4">
							<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
								<h4 className="text-sm font-medium">Payment</h4>
								<button
									type="button"
									className="text-xs px-2 py-1 rounded border"
									onClick={() => togglePayments(t.id)}
									disabled={paymentLoadingTaskId === t.id}
								>
									{paymentLoadingTaskId === t.id ? "Loading..." : expandedPayments.has(t.id) ? "Hide payments" : "Show payments"}
								</button>
							</div>

							{expandedPayments.has(t.id) && t.id in paymentData && (() => {
								const data = paymentData[t.id];
								const total = data?.totalAmount ?? null;
								const payments = data?.payments ?? [];
								const received = payments.reduce((sum, p) => sum + p.amount, 0);
								const balance = total != null ? total - received : null;
								return (
									<div className="space-y-3">
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-sm font-medium">Total amount:</span>
											{editingTotalTaskId === t.id ? (
												<>
													<input type="number" min="0" step="any" className="input text-sm !w-32" value={totalAmountDraft} onChange={(e) => setTotalAmountDraft(e.target.value)} />
													<button type="button" className="btn btn-accent btn-sm" onClick={() => saveTotal(t.id)}>Save</button>
													<button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingTotalTaskId(null)}>Cancel</button>
												</>
											) : (
												<>
													<span className="text-sm">{total != null ? `₹${total.toLocaleString()}` : "Not set"}</span>
													<button type="button" className="text-xs px-2 py-1 rounded border" onClick={() => startEditTotal(t.id, total)}>Edit</button>
												</>
											)}
										</div>

										{total != null && (
											<div className="flex flex-wrap gap-2">
												<span className="chip chip-ok">Received: ₹{received.toLocaleString()}</span>
												<span className={`chip ${(balance ?? 0) > 0 ? "chip-warn" : "chip-plain"}`}>Balance: ₹{(balance ?? 0).toLocaleString()}</span>
											</div>
										)}

										{payments.length > 0 ? (
											<div className="space-y-2">
												{payments.map((p) => (
													<div key={p.id} className="p-2.5 border border-gray-200 rounded bg-white">
														{editingPaymentId === p.id ? (
															<form onSubmit={(e) => { e.preventDefault(); saveEditedPayment(t.id, p.id); }} className="space-y-2">
																<div className="flex flex-wrap gap-2">
																	<input type="number" min="0" step="any" className="input text-sm flex-1 min-w-[6rem]" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
																	<input type="date" className="input text-sm flex-1 min-w-[8rem]" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
																	<select className="input text-sm flex-1 min-w-[8rem]" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
																		<option value="CASH">Cash</option>
																		<option value="BANK_TRANSFER">Bank Transfer</option>
																		<option value="UPI">UPI</option>
																		<option value="CHEQUE">Cheque</option>
																		<option value="CARD">Card</option>
																		<option value="OTHER">Other</option>
																	</select>
																</div>
																<input className="input text-sm" placeholder="Notes (optional)" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
																<div className="flex gap-2">
																	<button type="submit" className="btn btn-accent btn-sm">Save</button>
																	<button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditingPaymentId(null); resetPaymentDraft(); }}>Cancel</button>
																</div>
															</form>
														) : (
															<div className="flex flex-wrap items-center justify-between gap-2">
																<div>
																	<span className="text-sm font-medium">₹{p.amount.toLocaleString()}</span>
																	<span className="chip chip-plain ml-2">{PAYMENT_MODE_LABELS[p.mode]}</span>
																	<span className="meta ml-2">{new Date(p.receivedAt).toLocaleDateString()} · recorded by {p.recordedBy.name}</span>
																	{p.notes && <div className="text-xs text-muted mt-1">{p.notes}</div>}
																</div>
																<div className="flex items-center gap-2">
																	<button
																		type="button"
																		className="btn btn-outline btn-sm"
																		onClick={() => { setAddingPaymentToTaskId(null); startEditPayment(p); }}
																	>
																		Edit
																	</button>
																	<button
																		type="button"
																		onClick={() => deletePayment(t.id, p.id)}
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
											<p className="text-xs text-gray-500 italic">No payments recorded yet</p>
										)}

										{addingPaymentToTaskId === t.id ? (
											<form onSubmit={(e) => { e.preventDefault(); addPayment(t.id); }} className="space-y-2 p-3 border border-line rounded-lg bg-wash">
												<div className="flex flex-wrap gap-2">
													<input type="number" min="0" step="any" className="input text-sm flex-1 min-w-[6rem]" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
													<input type="date" className="input text-sm flex-1 min-w-[8rem]" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
													<select className="input text-sm flex-1 min-w-[8rem]" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
														<option value="CASH">Cash</option>
														<option value="BANK_TRANSFER">Bank Transfer</option>
														<option value="UPI">UPI</option>
														<option value="CHEQUE">Cheque</option>
														<option value="CARD">Card</option>
														<option value="OTHER">Other</option>
													</select>
												</div>
												<input className="input text-sm" placeholder="Notes (optional)" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
												<div className="flex gap-2">
													<button type="submit" className="btn btn-accent btn-sm">Add payment</button>
													<button type="button" className="btn btn-outline btn-sm" onClick={() => { setAddingPaymentToTaskId(null); resetPaymentDraft(); }}>Cancel</button>
												</div>
											</form>
										) : (
											<button
												type="button"
												className="btn btn-outline btn-sm"
												onClick={() => { setEditingPaymentId(null); resetPaymentDraft(); setAddingPaymentToTaskId(t.id); }}
											>
												+ Add payment
											</button>
										)}
									</div>
								);
							})()}
						</div>
					)}
								</div>
							</details>
								{/* Items -- always visible, not gated behind expanding the task */}
									<div className="mt-4 border-t border-gray-200 pt-4">
										<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
											<h4 className="text-sm font-medium">
												Items
												{t.despatchItems && t.despatchItems.length > 0 && (
													<span className="text-xs text-muted ml-2">
														{t.despatchItems.filter(i => i.status === "DESPATCHED").length}/{t.despatchItems.length} despatched
													</span>
												)}
											</h4>
											<button
												type="button"
												className="text-xs px-2 py-1 rounded border"
												onClick={() => setAddingDespatchItemToTaskId(addingDespatchItemToTaskId === t.id ? null : t.id)}
											>
												{addingDespatchItemToTaskId === t.id ? "Cancel" : "Add item"}
											</button>
										</div>

										{addingDespatchItemToTaskId === t.id && (
											<form
												onSubmit={(e) => { e.preventDefault(); createDespatchItem(t.id); }}
												className="space-y-2 p-3 border border-line rounded-lg bg-wash mb-3"
											>
												<div className="flex flex-wrap gap-2">
													<select className="input flex-1 min-w-[8rem] text-sm" value={newDespatchCategory} onChange={(e) => setNewDespatchCategory(e.target.value)}>
														<option value="">Select type</option>
														<option value="Rigid Boxes">Rigid Boxes</option>
														<option value="Cake Boxes">Cake Boxes</option>
														<option value="Paper Bags">Paper Bags</option>
														<option value="Stickers">Stickers</option>
														<option value="Cards">Cards</option>
														<option value="Invitation">Invitation</option>
														<option value="Paperboard Boxes">Paperboard Boxes</option>
														<option value="Others">Others</option>
														{dynamicCategories.map(c => (<option key={c.id} value={c.name}>{c.name}</option>))}
													</select>
													<input className="input flex-[2] min-w-[8rem] text-sm" placeholder="Item name" value={newDespatchName} onChange={(e) => setNewDespatchName(e.target.value)} required />
													<input className="input flex-1 min-w-[6rem] text-sm" placeholder="Size" value={newDespatchSpecFields.size ?? ""} onChange={(e) => setNewDespatchSpecFields(v => ({ ...v, size: e.target.value }))} />
													<div className="flex gap-1 flex-1 min-w-[8rem]">
														<input className="input text-sm" type="number" min="0" step="any" placeholder="Qty" value={newDespatchQuantity} onChange={(e) => setNewDespatchQuantity(e.target.value)} required />
														<input className="input text-sm" placeholder="Unit" value={newDespatchUnit} onChange={(e) => setNewDespatchUnit(e.target.value)} />
													</div>
												</div>
												<ItemSpecFields
													category={newDespatchCategory}
													specFields={newDespatchSpecFields}
													onFieldChange={(key, value) => setNewDespatchSpecFields(v => ({ ...v, [key]: value }))}
													dynamicCategories={dynamicCategories}
												/>
												<button type="submit" className="btn btn-accent btn-sm">Add</button>
											</form>
										)}

										{t.despatchItems && t.despatchItems.length > 0 ? (
											<div className="space-y-2">
												{t.despatchItems.map((item) => (
													<div key={item.id} className="p-2.5 border border-gray-200 rounded bg-white">
														{editingDespatchItemId === item.id ? (
															<form
																onSubmit={(e) => { e.preventDefault(); saveDespatchItemEdit(item.id); }}
																className="space-y-2"
															>
																<div className="flex flex-wrap gap-2">
																	<select className="input flex-1 min-w-[8rem] text-sm" value={editDespatchCategory} onChange={(e) => setEditDespatchCategory(e.target.value)}>
																		<option value="">Select type</option>
																		<option value="Rigid Boxes">Rigid Boxes</option>
																		<option value="Cake Boxes">Cake Boxes</option>
																		<option value="Paper Bags">Paper Bags</option>
																		<option value="Stickers">Stickers</option>
																		<option value="Cards">Cards</option>
																		<option value="Invitation">Invitation</option>
																		<option value="Paperboard Boxes">Paperboard Boxes</option>
																		<option value="Others">Others</option>
																		{dynamicCategories.map(c => (<option key={c.id} value={c.name}>{c.name}</option>))}
																	</select>
																	<input className="input flex-[2] min-w-[8rem] text-sm" placeholder="Item name" value={editDespatchName} onChange={(e) => setEditDespatchName(e.target.value)} required />
																	<input className="input flex-1 min-w-[6rem] text-sm" placeholder="Size" value={editDespatchSpecFields.size ?? ""} onChange={(e) => setEditDespatchSpecFields(v => ({ ...v, size: e.target.value }))} />
																	<div className="flex gap-1 flex-1 min-w-[8rem]">
																		<input className="input text-sm" type="number" min="0" step="any" placeholder="Qty" value={editDespatchQuantity} onChange={(e) => setEditDespatchQuantity(e.target.value)} required />
																		<input className="input text-sm" placeholder="Unit" value={editDespatchUnit} onChange={(e) => setEditDespatchUnit(e.target.value)} />
																	</div>
																</div>
																<ItemSpecFields
																	category={editDespatchCategory}
																	specFields={editDespatchSpecFields}
																	onFieldChange={(key, value) => setEditDespatchSpecFields(v => ({ ...v, [key]: value }))}
																	dynamicCategories={dynamicCategories}
																/>
																<div className="flex gap-2">
																	<button type="submit" className="btn btn-accent btn-sm">Save</button>
																	<button type="button" className="btn btn-outline btn-sm" onClick={cancelEditDespatchItem}>Cancel</button>
																</div>
															</form>
														) : (
															<div className="flex flex-wrap items-center justify-between gap-2">
																<div>
																	<span className="text-sm">{item.name} — {item.quantity} {item.unit}</span>
																	{item.specFields?.category && (
																		<span className="chip chip-plain ml-2">{item.specFields.category}</span>
																	)}
																	{item.specFields && Object.keys(item.specFields).filter(k => k !== "category").length > 0 && (
																		<details className="mt-1">
																			<summary className="text-xs text-muted cursor-pointer">Specs</summary>
																			<div className="text-xs text-muted mt-1 space-y-0.5">
																				{Object.entries(item.specFields).filter(([k]) => k !== "category").map(([k, v]) => (
																					v === "" || v === false || v === null || v === undefined ? null : (
																						<div key={k}>{k}: {String(v)}</div>
																					)
																				))}
																			</div>
																		</details>
																	)}
																</div>
																<div className="flex items-center gap-2">
																	<select
																		className={`input text-xs py-1 !w-auto ${itemStatusChipClass(item.status)}`}
																		value={item.status}
																		onChange={(e) => updateDespatchItemStatus(item.id, e.target.value as DespatchItem["status"])}
																	>
																		<option value="PENDING_CLIENT_APPROVAL">Pending Client Approval</option>
																		<option value="PRE_PRODUCTION">Pre Production</option>
																		<option value="PRODUCTION">Production</option>
																		<option value="PACKED">Packed</option>
																		<option value="DESPATCHED">Despatched</option>
																	</select>
																	<button
																		type="button"
																		onClick={() => startEditDespatchItem(item)}
																		className="btn btn-outline btn-sm"
																	>
																		Edit
																	</button>
																	<button
																		type="button"
																		onClick={() => deleteDespatchItem(item.id)}
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
											<p className="text-xs text-gray-500 italic">No items yet</p>
										)}
									</div>


						</>
						)}
						</li>
						);
					})}
				</ul>
				)}
			</section>

			{/* Onboarding Form — Fill In Manually Modal */}
			{fillingOnboardingTaskId && (
				<div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-50 p-3">
					<div className="card card-pad max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto !bg-[var(--raised)] shadow-lg">
						<div className="flex flex-wrap items-center justify-between gap-2 mb-4">
							<h2 className="text-lg font-semibold">Fill onboarding details</h2>
							<button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setFillingOnboardingTaskId(null)}>✕</button>
						</div>
						<form
							onSubmit={(e) => { e.preventDefault(); submitOnboardingFill(fillingOnboardingTaskId); }}
							className="space-y-4"
						>
							<div className="space-y-2">
								<h3 className="text-sm font-medium">Billing details</h3>
								<input className="input text-sm" placeholder="Billing name *" required value={onboardingFillValues.billingName} onChange={(e) => updateOnboardingFillValue("billingName", e.target.value)} />
								<input className="input text-sm" type="email" placeholder="Email" value={onboardingFillValues.billingEmail} onChange={(e) => updateOnboardingFillValue("billingEmail", e.target.value)} />
								<input className="input text-sm" placeholder="Phone *" required value={onboardingFillValues.billingPhone} onChange={(e) => updateOnboardingFillValue("billingPhone", e.target.value)} />
								<input className="input text-sm" placeholder="Secondary phone" value={onboardingFillValues.billingSecondaryPhone} onChange={(e) => updateOnboardingFillValue("billingSecondaryPhone", e.target.value)} />
								<textarea className="input text-sm" rows={2} placeholder="Billing address *" required value={onboardingFillValues.billingAddress} onChange={(e) => updateOnboardingFillValue("billingAddress", e.target.value)} />
								<input className="input text-sm" placeholder="GSTIN / Tax ID" value={onboardingFillValues.gstin} onChange={(e) => updateOnboardingFillValue("gstin", e.target.value)} />
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-medium">Delivery details</h3>
									<label className="flex items-center gap-2 text-xs text-muted">
										<input type="checkbox" checked={fillSameAsBilling} onChange={(e) => toggleFillSameAsBilling(e.target.checked)} />
										Same as billing
									</label>
								</div>
								<input className="input text-sm" placeholder="Contact name" disabled={fillSameAsBilling} value={onboardingFillValues.deliveryContactName} onChange={(e) => updateOnboardingFillValue("deliveryContactName", e.target.value)} />
								<input className="input text-sm" placeholder="Delivery phone" disabled={fillSameAsBilling} value={onboardingFillValues.deliveryPhone} onChange={(e) => updateOnboardingFillValue("deliveryPhone", e.target.value)} />
								<input className="input text-sm" placeholder="Secondary phone" disabled={fillSameAsBilling} value={onboardingFillValues.deliverySecondaryPhone} onChange={(e) => updateOnboardingFillValue("deliverySecondaryPhone", e.target.value)} />
								<textarea className="input text-sm" rows={2} placeholder="Delivery address *" required disabled={fillSameAsBilling} value={onboardingFillValues.deliveryAddress} onChange={(e) => updateOnboardingFillValue("deliveryAddress", e.target.value)} />
								<textarea className="input text-sm" rows={2} placeholder="Delivery notes" value={onboardingFillValues.deliveryNotes} onChange={(e) => updateOnboardingFillValue("deliveryNotes", e.target.value)} />
							</div>
							{error && <p className="text-sm text-danger">{error}</p>}
							<div className="flex gap-2">
								<button type="submit" className="btn btn-accent btn-sm">Save</button>
								<button type="button" className="btn btn-outline btn-sm" onClick={() => setFillingOnboardingTaskId(null)}>Cancel</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Onboarding Form — View Submitted Details Modal */}
			{viewingOnboardingTaskId && (() => {
				const form = onboardingForms[viewingOnboardingTaskId];
				if (!form) return null;
				const row = (label: string, value?: string | null) => (
					<div>
						<label className="field-label">{label}</label>
						<p className="text-sm">{value || <span className="text-muted italic">Not provided</span>}</p>
					</div>
				);
				return (
					<div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-50 p-3">
						<div className="card card-pad max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto !bg-[var(--raised)] shadow-lg">
							<div className="flex flex-wrap items-center justify-between gap-2 mb-4">
								<h2 className="text-lg font-semibold">Onboarding details</h2>
								<button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setViewingOnboardingTaskId(null)}>✕</button>
							</div>
							<div className="space-y-4">
								<div className="space-y-2">
									<h3 className="text-sm font-medium">Billing details</h3>
									{row("Billing name", form.billingName)}
									{row("Email", form.billingEmail)}
									{row("Phone", form.billingPhone)}
									{row("Secondary phone", form.billingSecondaryPhone)}
									{row("Billing address", form.billingAddress)}
									{row("GSTIN / Tax ID", form.gstin)}
								</div>
								<div className="space-y-2">
									<h3 className="text-sm font-medium">Delivery details</h3>
									{row("Contact name", form.deliveryContactName)}
									{row("Delivery phone", form.deliveryPhone)}
									{row("Secondary phone", form.deliverySecondaryPhone)}
									{row("Delivery address", form.deliveryAddress)}
									{row("Delivery notes", form.deliveryNotes)}
								</div>
								<button type="button" className="btn btn-outline btn-sm" onClick={() => setViewingOnboardingTaskId(null)}>Close</button>
							</div>
						</div>
					</div>
				);
			})()}

			{/* View Task Modal */}
			{viewingId && (() => {
				const task = tasks.find(t => t.id === viewingId);
				if (!task) return null;
				
				return (
					<div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-50 p-3">
						<div className="card card-pad max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto !bg-[var(--raised)] shadow-lg">
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
											<label className="field-label">Title</label>
											<p className="text-sm text-gray-900">{task.title}</p>
										</div>
										<div>
											<label className="field-label">Status</label>
											<span className="chip chip-plain">
												{task.status}
											</span>
										</div>
										<div>
											<label className="field-label">Description</label>
											<p className="text-sm text-gray-900">{task.description || "No description"}</p>
										</div>
										<div>
											<label className="field-label">Created</label>
											<p className="text-sm text-gray-900">{new Date(task.createdAt).toLocaleString()}{task.createdBy && ` by ${task.createdBy.name}`}</p>
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
													<label className="field-label">Start Date</label>
													<p className="text-sm text-gray-900">{new Date(task.startAt).toLocaleString()}</p>
												</div>
											)}
											{task.dueAt && (
												<div>
													<label className="field-label">Due Date</label>
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
													<label className="field-label">Customer</label>
													<p className="text-sm text-gray-900">{task.customerRef.name}</p>
												</div>
											)}
											{task.assignments && task.assignments.length > 0 && (
												<div>
													<label className="field-label">Assigned To</label>
													<div className="flex flex-wrap gap-1 mt-1">
														{task.assignments.map(a => (
															<span key={a.id} className="chip chip-plain">
																{a.user.name}
															</span>
														))}
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

								<TaskComments taskId={task.id} mentionable={[...users.map(u => ({ id: u.id, name: u.name })), ...teams.map(team => ({ id: team.id, name: team.name }))]} />
							</div>
						</div>
					</div>
				);
			})()}
		</div>
	);
}

export default function TasksPage() {
	return (
		<Suspense fallback={<div className="text-center text-muted py-12">Loading…</div>}>
			<TasksPageInner />
		</Suspense>
	);
}
