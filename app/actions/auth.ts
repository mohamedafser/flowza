"use server";

/**
 * Auth mutations live in `/api/auth/*` JSON route handlers.
 * This file keeps a thin server-action logout for any remaining form actions.
 */
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { signOut } from "@/services/auth/flows";

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect(LOGIN_PATH);
}
