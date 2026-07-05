"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { SafeUser } from "@/lib/session";
import ThemeToggle from "./ThemeToggle";

const ADMIN_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/schedule", label: "Schedule" },
  { href: "/attendance", label: "Attendance" },
  { href: "/quotations", label: "Quotations" },
  { href: "/customers", label: "Customers" },
  { href: "/archive", label: "Archive" },
];

const WORKER_LINKS = [
  { href: "/dashboard", label: "My Day" },
  { href: "/tasks", label: "My Tasks" },
  { href: "/attendance", label: "Clock In/Out" },
];

export default function Header({ user }: { user: SafeUser | null }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const links = isAdmin ? ADMIN_LINKS : WORKER_LINKS;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Full navigation (not client router) so the server re-resolves
      // the (now logged-out) session on the very next request.
      window.location.href = "/signin";
    }
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href={user ? "/dashboard" : "/signin"} className="text-lg font-bold">
            Factory Tracker
          </Link>

          {user ? (
            <>
              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-3 text-sm">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="px-2 py-1 rounded hover:bg-gray-100">
                    {l.label}
                  </Link>
                ))}
                <span className="text-gray-500 ml-2">{user.name}</span>
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="px-3 py-1 rounded border bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {loggingOut ? "..." : "Logout"}
                </button>
              </nav>

              {/* Mobile toggle */}
              <button
                className="md:hidden px-3 py-1 rounded border"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {menuOpen ? "✕" : "☰"}
              </button>
            </>
          ) : (
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/signin" className="px-3 py-1 rounded border hover:bg-gray-50">
                Sign In
              </Link>
            </nav>
          )}
        </div>

        {/* Mobile menu */}
        {user && menuOpen && (
          <nav className="md:hidden mt-3 flex flex-col gap-1 text-sm border-t pt-3">
            <div className="px-2 py-1 text-gray-500">Signed in as {user.name}</div>
            <div className="px-2 py-1"><ThemeToggle /></div>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-2 py-2 rounded hover:bg-gray-100"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-left px-2 py-2 rounded text-red-700 hover:bg-red-50"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
