import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// No client fetch, no "checking auth..." flash — middleware already
// guarantees a session cookie exists here (or we'd never have reached
// this page), and this just resolves where to send the user.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/signin");
}
