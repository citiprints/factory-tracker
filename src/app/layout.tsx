import "./globals.css";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { getCurrentUser } from "@/lib/session";
import { UserProvider } from "./UserContext";
import AppShell from "./AppShell";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata = {
  title: "Factory Tracker",
  description: "Attendance, scheduling, and job tracking for Wrapzone / Citiprints",
};

// Runs before first paint: restores the saved theme (or falls back to the
// OS preference) so there is no flash and the toggle state survives reloads.
const themeInit = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved ONCE, on the server, before anything renders.
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#121214" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${archivo.variable} ${plexMono.variable} min-h-screen`}>
        <UserProvider user={user}>
          <AppShell user={user}>{children}</AppShell>
        </UserProvider>
      </body>
    </html>
  );
}
