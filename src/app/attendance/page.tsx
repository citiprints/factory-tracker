"use client";
import { useEffect, useState } from "react";

type AttendanceLog = {
  id: string;
  clockInAt: string;
  clockOutAt: string | null;
  withinGeofence: boolean;
  location?: { name: string } | null;
};

export default function AttendancePage() {
  const [clockedIn, setClockedIn] = useState(false);
  const [openLog, setOpenLog] = useState<AttendanceLog | null>(null);
  const [recent, setRecent] = useState<AttendanceLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        reject(new Error("Location is not available on this device/browser."));
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
        setMessage(data.error || "Could not clock in.");
      } else {
        setMessage(
          data.withinGeofence
            ? `Clocked in at ${data.location ?? "an unrecognised location"}.`
            : `Clocked in, but you're outside the expected radius for ${data.location ?? "this site"}. Flagged for review.`
        );
        await loadStatus();
      }
    } catch (err: any) {
      setMessage(err.message || "Could not get your location. Enable location access and try again.");
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
        // Clock-out still allowed without location; just skip it.
      }
      const res = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(coords),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not clock out.");
      } else {
        setMessage("Clocked out. See you next shift.");
        await loadStatus();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500 py-12">Loading...</div>;
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Attendance</h1>

      <div className="rounded-2xl border p-6 text-center mb-6">
        <div
          className={`text-sm font-medium mb-2 ${clockedIn ? "text-green-600" : "text-gray-500"}`}
        >
          {clockedIn ? "● Clocked in" : "○ Not clocked in"}
        </div>
        {openLog && (
          <div className="text-xs text-gray-500 mb-4">
            Since {new Date(openLog.clockInAt).toLocaleTimeString()}
            {openLog.location?.name ? ` · ${openLog.location.name}` : ""}
          </div>
        )}

        {clockedIn ? (
          <button
            onClick={handleClockOut}
            disabled={busy}
            className="w-full py-4 rounded-xl bg-red-600 text-white font-semibold text-lg disabled:opacity-50"
          >
            {busy ? "..." : "Clock Out"}
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={busy}
            className="w-full py-4 rounded-xl bg-green-600 text-white font-semibold text-lg disabled:opacity-50"
          >
            {busy ? "..." : "Clock In"}
          </button>
        )}

        {message && <div className="text-sm text-gray-600 mt-4">{message}</div>}
      </div>

      <h2 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">
        Recent
      </h2>
      <div className="space-y-2">
        {recent.length === 0 && (
          <div className="text-sm text-gray-400">No attendance history yet.</div>
        )}
        {recent.map((log) => (
          <div key={log.id} className="border rounded-lg p-3 text-sm flex justify-between">
            <div>
              <div className="font-medium">
                {new Date(log.clockInAt).toLocaleDateString()}
              </div>
              <div className="text-gray-500">
                {new Date(log.clockInAt).toLocaleTimeString()} –{" "}
                {log.clockOutAt ? new Date(log.clockOutAt).toLocaleTimeString() : "in progress"}
              </div>
            </div>
            <div className="text-right text-xs">
              {log.location?.name && <div className="text-gray-500">{log.location.name}</div>}
              {!log.withinGeofence && (
                <div className="text-amber-600 font-medium">Outside geofence</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
