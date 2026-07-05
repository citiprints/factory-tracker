import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import Header from "./Header";
import { UserProvider } from "./UserContext";

export const metadata = {
  title: "Factory Tracker",
  description: "Attendance, scheduling, and job tracking for Wrapzone / Citiprints",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved ONCE, on the server, before anything renders.
  // No client fetch, no loading flicker, no hydration mismatch.
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111827" />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <UserProvider user={user}>
          <div className="flex flex-col min-h-screen">
            <Header user={user} />
            <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
