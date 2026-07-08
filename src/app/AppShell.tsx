"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SafeUser } from "@/lib/session";
import { requestPushToken, onForegroundPush } from "@/lib/firebase-client";

/* ------------------------------------------------------------------ */
/* Icons — small inline set, stroke inherits currentColor              */
/* ------------------------------------------------------------------ */
function Icon({ d, filled = false }: { d: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  dashboard: "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z",
  tasks: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  clock: "M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  calendar: "M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  quote: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6",
  people: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75",
  archive: "M21 8v13H3V8M1 3h22v5H1V3zM10 12h4",
  fields: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  files: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7zM13 2v7h7",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
};

type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
type NavSection = { title: string | null; items: NavItem[] };

const ADMIN_NAV: NavSection[] = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/notifications", label: "Notifications", icon: "bell" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/tasks", label: "Tasks", icon: "tasks" },
      { href: "/schedule", label: "Schedule", icon: "calendar" },
      { href: "/attendance", label: "Attendance", icon: "clock" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/quotations", label: "Quotations", icon: "quote" },
      { href: "/customers", label: "Customers", icon: "people" },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/users", label: "Team", icon: "people" },
      { href: "/settings", label: "Settings", icon: "fields" },
      { href: "/files", label: "Files", icon: "files" },
      { href: "/archive", label: "Archive", icon: "archive" },
    ],
  },
];

const WORKER_NAV: NavSection[] = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "My day", icon: "dashboard" },
      { href: "/notifications", label: "Notifications", icon: "bell" },
      { href: "/tasks", label: "My tasks", icon: "tasks" },
      { href: "/attendance", label: "Clock in / out", icon: "clock" },
      { href: "/schedule", label: "My shifts", icon: "calendar" },
      { href: "/settings", label: "Settings", icon: "fields" },
    ],
  },
];

/* Mobile bottom bar: the four things each role reaches for constantly. */
const ADMIN_TABS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/schedule", label: "Schedule", icon: "calendar" },
  { href: "/attendance", label: "Attendance", icon: "clock" },
];
const WORKER_TABS: NavItem[] = [
  { href: "/dashboard", label: "My day", icon: "dashboard" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/attendance", label: "Clock", icon: "clock" },
  { href: "/schedule", label: "Shifts", icon: "calendar" },
];

/* ------------------------------------------------------------------ */
/* Theme toggle — one icon button, state restored pre-paint in layout  */
/* ------------------------------------------------------------------ */
function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark" || t === "light") setTheme(t);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-sm"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <span className="w-[18px] h-[18px] inline-block">
        <Icon d={theme === "dark" ? ICONS.sun : ICONS.moon} />
      </span>
    </button>
  );
}

/* Brand: uses the uploaded Citiprints logo if one exists (set from the
   Files page); otherwise falls back to the registration-mark glyph. */
function BrandMark() {
  const [hasLogo, setHasLogo] = useState(true);
  if (hasLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/api/branding"
        alt="Citiprints"
        className="w-7 h-7 rounded object-contain"
        onError={() => setHasLogo(false)}
      />
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path d="M12 1v5M12 18v5M1 12h5M18 12h5" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Push notification opt-in — a deliberate tap, never an auto-prompt   */
/* (browsers silently ignore permission requests without a user        */
/* gesture, and an unsolicited popup on load is just annoying).        */
/* ------------------------------------------------------------------ */
function PushToggle({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<"unknown" | "off" | "on" | "denied" | "busy" | "unsupported">("unknown");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    // The saved "subscribed" flag only counts while permission is CURRENTLY
    // granted. If the person reset/revoked permission at the OS or browser
    // level after subscribing, the flag goes stale — trusting it alone would
    // hide the button while notifications are actually off again.
    const subscribed = Notification.permission === "granted" && localStorage.getItem("pushSubscribed") === "1";
    setStatus(subscribed ? "on" : "off");
  }, []);

  async function enable() {
    setStatus("busy");
    setError(null);
    const result = await requestPushToken();
    if (!result.token) {
      setError(result.reason ?? "Couldn't get a push token.");
      setStatus(Notification.permission === "denied" ? "denied" : "off");
      return;
    }
    try {
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fcmToken: result.token, device: "web" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Server rejected the subscription (${res.status}).`);
        setStatus("off");
        return;
      }
      localStorage.setItem("pushSubscribed", "1");
      setStatus("on");
    } catch (err: any) {
      setError(`Couldn't reach the server: ${err?.message || err}`);
      setStatus("off");
    }
  }

  if (status === "unsupported" || status === "on") return null; // nothing to do

  return (
    <div className={compact ? undefined : "w-full"}>
      <button
        type="button"
        onClick={enable}
        disabled={status === "busy" || status === "denied"}
        className={compact ? "btn btn-ghost btn-sm" : "btn btn-ghost btn-sm btn-block"}
        title={
          status === "denied"
            ? "Notifications blocked — enable them in your browser's site settings"
            : "Turn on notifications for assigned tasks and shifts"
        }
      >
        <span className="w-[18px] h-[18px] inline-block">
          <Icon d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </span>
        {!compact && (status === "busy" ? "Enabling…" : status === "denied" ? "Blocked" : "Enable alerts")}
      </button>
      {error && !compact && (
        <p className="text-xs text-danger mt-1 px-1 leading-snug">{error}</p>
      )}
    </div>
  );
}


export default function AppShell({
  user,
  children,
}: {
  user: SafeUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [counts, setCounts] = useState<{ pendingTasks: number; pendingQuotes: number; unreadNotifications: number } | null>(null);
  const [toast, setToast] = useState<{ title: string; body: string; linkPath?: string } | null>(null);

  // Foreground push: FCM's onBackgroundMessage only fires when the tab is
  // NOT focused, so we need our own listener for the active-tab case.
  useEffect(() => {
    if (!user) return;
    let toastTimer: ReturnType<typeof setTimeout>;
    onForegroundPush((title, body, linkPath) => {
      setToast({ title, body, linkPath });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setToast(null), 6000);
      fetch("/api/counts")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setCounts(d))
        .catch(() => {});
    });
    return () => clearTimeout(toastTimer);
  }, [user]);

  // Nav badges: refresh on every navigation so counts stay honest.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/counts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.pendingTasks === "number") setCounts(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  const badgeFor = (href: string): number => {
    if (!counts) return 0;
    if (href === "/tasks") return counts.pendingTasks;
    if (href === "/quotations") return counts.pendingQuotes;
    if (href === "/notifications") return counts.unreadNotifications;
    return 0;
  };

  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const nav = isAdmin ? ADMIN_NAV : WORKER_NAV;
  const tabs = isAdmin ? ADMIN_TABS : WORKER_TABS;

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Full navigation so the server re-resolves the (now empty) session.
      window.location.href = "/signin";
    }
  }

  /* ---- Signed-out: centered content on paper, minimal chrome ---- */
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="px-5 py-4 flex items-center justify-between">
          <Link href="/signin" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <BrandMark />
            Factory Tracker
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15.5rem_1fr]">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="hidden md:flex flex-col border-r border-line bg-surface sticky top-0 h-screen">
        <div className="px-4 pt-5 pb-2">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandMark />
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Factory Tracker</div>
              <div className="meta">Wrapzone · Citiprints</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
          {nav.map((section, i) => (
            <div key={i}>
              {section.title && <div className="nav-section">{section.title}</div>}
              {!section.title && <div className="mt-4" />}
              {section.items.map((item) => {
                const badge = badgeFor(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="navlink"
                    data-active={isActive(item.href)}
                  >
                    <span className="w-[18px] h-[18px] shrink-0">
                      <Icon d={ICONS[item.icon]} />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-on-accent text-[11px] font-semibold font-mono inline-flex items-center justify-center">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-3 py-3">
          <div className="flex items-center gap-2.5 px-1.5 pb-2.5">
            <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-sm font-semibold shrink-0">
              {user.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="meta capitalize">{user.role.toLowerCase()}</div>
            </div>
          </div>
          <div className="mb-2">
            <PushToggle />
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="btn btn-outline btn-sm btn-block"
          >
            <span className="w-4 h-4 inline-block">
              <Icon d={ICONS.logout} />
            </span>
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex flex-col min-h-screen min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-surface/90 backdrop-blur border-b border-line">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <BrandMark />
            Factory Tracker
          </Link>
          <div className="flex items-center gap-1">
            <PushToggle compact />
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn btn-ghost btn-sm"
              aria-label="Sign out"
              title="Sign out"
            >
              <span className="w-[18px] h-[18px] inline-block">
                <Icon d={ICONS.logout} />
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-5 md:py-8 pb-24 md:pb-8">
          {children}
        </main>

        {toast && (
          <button
            onClick={() => {
              window.location.href = toast.linkPath || "/dashboard";
            }}
            className="fixed z-30 left-3 right-3 bottom-[4.75rem] md:left-auto md:right-6 md:bottom-6 md:w-80 card card-pad !bg-[var(--raised)] shadow-lg text-left"
          >
            <div className="font-medium text-sm">{toast.title}</div>
            <div className="text-sm text-muted mt-0.5">{toast.body}</div>
          </button>
        )}

        {/* Mobile bottom tab bar — big targets for the factory floor */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-surface/95 backdrop-blur border-t border-line px-2 pt-1.5"
          style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex">
            {tabs.map((t) => {
              const badge = badgeFor(t.href);
              return (
                <Link key={t.href} href={t.href} className="tabbar-item relative" data-active={isActive(t.href)}>
                  <span className="relative inline-flex">
                    <Icon d={ICONS[t.icon]} />
                    {badge > 0 && (
                      <span className="absolute -top-1.5 -right-3 min-w-4 h-4 px-1 rounded-full bg-accent text-on-accent text-[10px] font-semibold font-mono inline-flex items-center justify-center leading-none">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
