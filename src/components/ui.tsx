"use client";
import React from "react";

/* Page title row with optional action button(s). */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* Friendly empty screen that invites action. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card card-pad text-center py-10">
      <div className="mx-auto w-10 h-10 rounded-full bg-wash flex items-center justify-center mb-3">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-faint" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        </svg>
      </div>
      <div className="font-medium">{title}</div>
      {hint && <div className="text-sm text-muted mt-1">{hint}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* Status → chip class + label, shared vocabulary across pages. */
export function statusChip(status: string): { cls: string; label: string } {
  const label = status.replace(/_/g, " ");
  switch (status) {
    case "DONE":
    case "COMPLETED":
    case "CONFIRMED":
    case "ACCEPTED":
      return { cls: "chip chip-ok", label };
    case "IN_PROGRESS":
    case "SENT":
      return { cls: "chip chip-info", label };
    case "BLOCKED":
    case "CANCELLED":
    case "MISSED":
    case "REJECTED":
      return { cls: "chip chip-danger", label };
    case "SCHEDULED":
    case "DRAFT":
      return { cls: "chip chip-warn", label };
    default:
      return { cls: "chip", label };
  }
}

export function priorityChip(priority: string): { cls: string; label: string } {
  switch (priority) {
    case "URGENT":
      return { cls: "chip chip-danger", label: "URGENT" };
    case "HIGH":
      return { cls: "chip chip-warn", label: "HIGH" };
    case "MEDIUM":
      return { cls: "chip chip-info", label: "MED" };
    default:
      return { cls: "chip", label: "LOW" };
  }
}

/* Ticket top-rule color per status (for .ticket cards). */
export function ticketColor(status: string): React.CSSProperties {
  switch (status) {
    case "DONE":
    case "COMPLETED":
      return { ["--ticket" as any]: "var(--ok)" };
    case "IN_PROGRESS":
      return { ["--ticket" as any]: "var(--accent)" };
    case "BLOCKED":
    case "MISSED":
      return { ["--ticket" as any]: "var(--danger)" };
    case "SCHEDULED":
      return { ["--ticket" as any]: "var(--warn)" };
    default:
      return {};
  }
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-14 text-muted text-sm">
      <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.2-8.56" />
      </svg>
      {label}
    </div>
  );
}
