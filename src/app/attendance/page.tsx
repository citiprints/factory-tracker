"use client";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState, Spinner } from "@/components/ui";

type AttendanceLog = {
  id: string;
  clockInAt: string;
  clockOutAt: string | null;
  withinGeofence: boolean;
  location?: { name: string } | null;
};

function useElapsed(sinceIso: string | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!sinceIso) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [sinceIso]);
  if (!sinceIso) return null;
  const ms = Date.now() - new Date(sinceIso).getTime();
  if (ms < 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const [clockedIn, setClockedIn] = useState(false);
  const [openLog, setOpenLog] = useState<AttendanceLog | null>(null);
  const [recent, setRecent] = useState<AttendanceLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "warn" | "danger"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const elapsed = useElapsed(clockedIn && openLog ? openLog.clockInAt : null);

  async function loadStatus() {
    const res = await fetch("/api/attendance/status");
    if (res.ok) {
      const data = await res.json();
      setClockedIn(data.clockedIn);
      setOpenLog(data.openLog);
      setRecent(data.recent);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not available on this device or browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });
  }

  async function handleClockIn() {
    setBusy(true);
    setMessage(null);
    try {
      const pos = await getPosition();
      const res = await fetch("/api/attendance/clock-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "danger", text: data.error || "Couldn't clock in. Try again." });
      } else {
        setMessage(
          data.withinGeofence
            ? { kind: "ok", text: `Clocked in at ${data.location ?? "an unrecognised location"}.` }
            : { kind: "warn", text: `Clocked in, but you're outside the expected radius for ${data.location ?? "this site"}. Flagged for review.` }
        );
        await loadStatus();
      }
    } catch (err: any) {
      setMessage({
        kind: "danger",
        text: err?.message || "Couldn't get your location. Enable location access and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    setBusy(true);
    setMessage(null);
    try {
      let coords: { latitude?: number; longitude?: number } = {};
      try {
        const pos = await getPosition();
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch {
        // Clock-out is still allowed without location.
      }
      const res = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(coords),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "danger", text: data.error || "Couldn't clock out. Try again." });
      } else {
        setMessage({ kind: "ok", text: "Clocked out. See you next shift." });
        await loadStatus();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-md mx-auto">
      <PageHeader title="Attendance" />

      <div
        className="ticket p-6 text-center mb-6"
        style={{ ["--ticket" as any]: clockedIn ? "var(--ok)" : "var(--line-strong)" }}
      >
        <span className={clockedIn ? "chip chip-ok" : "chip"}>
          {clockedIn ? "ON SHIFT" : "OFF SHIFT"}
        </span>

        {clockedIn && elapsed && (
          <div className="font-mono tabular-nums text-4xl font-semibold mt-4 tracking-tight">
            {elapsed}
          </div>
        )}
        {openLog && (
          <div className="meta mt-2 mb-5">
            since {new Date(openLog.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {openLog.location?.name ? ` · ${openLog.location.name}` : ""}
          </div>
        )}
        {!clockedIn && <div className="meta mt-2 mb-5">Uses your location to match the site</div>}

        {clockedIn ? (
          <button onClick={handleClockOut} disabled={busy} className="btn btn-danger btn-lg btn-block">
            {busy ? "Working…" : "Clock out"}
          </button>
        ) : (
          <button onClick={handleClockIn} disabled={busy} className="btn btn-accent btn-lg btn-block">
            {busy ? "Getting location…" : "Clock in"}
          </button>
        )}

        {message && (
          <div className={`alert alert-${message.kind} mt-4 text-left`}>{message.text}</div>
        )}
      </div>

      <h2 className="nav-section !px-0 !mt-0 mb-2">Recent shifts</h2>
      {recent.length === 0 ? (
        <EmptyState title="No shifts yet" hint="Your clock-ins will show up here." />
      ) : (
        <div className="card divide-y divide-line">
          {recent.map((log) => (
            <div key={log.id} className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {new Date(log.clockInAt).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })}
                </div>
                <div className="meta mt-0.5">
                  {new Date(log.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" – "}
                  {log.clockOutAt
                    ? new Date(log.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "in progress"}
                  {log.location?.name ? ` · ${log.location.name}` : ""}
                </div>
              </div>
              {!log.withinGeofence && <span className="chip chip-warn shrink-0">OFF-SITE</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
