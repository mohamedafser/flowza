import { JSON_HEADERS, parseJsonResult } from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type { AuthFlowData } from "@/services/auth/flows";

export type AuthApiData = AuthFlowData;

async function postAuth(
  path: string,
  body?: unknown,
): Promise<ActionResult<AuthApiData>> {
  const response = await fetch(path, {
    method: "POST",
    headers: JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return parseJsonResult(response);
}

export function signUpRequest(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  invitationId?: string;
}): Promise<ActionResult<AuthApiData>> {
  return postAuth("/api/auth/signup", input);
}

export function signInRequest(input: {
  email: string;
  password: string;
}): Promise<ActionResult<AuthApiData>> {
  return postAuth("/api/auth/login", input);
}

export function forgotPasswordRequest(input: {
  email: string;
}): Promise<ActionResult<AuthApiData>> {
  return postAuth("/api/auth/forgot-password", input);
}

export function verifyOtpRequest(input: {
  email: string;
  code: string;
  purpose: "SIGNUP" | "PASSWORD_RESET" | "INVITATION";
}): Promise<ActionResult<AuthApiData>> {
  return postAuth("/api/auth/verify-otp", input);
}

export function resendOtpRequest(input?: {
  email?: string;
  purpose?: "SIGNUP" | "PASSWORD_RESET" | "INVITATION";
}): Promise<ActionResult<AuthApiData>> {
  return postAuth("/api/auth/resend-otp", input ?? {});
}

export function resetPasswordRequest(input: {
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<AuthApiData>> {
  return postAuth("/api/auth/reset-password", input);
}

export function signOutRequest(): Promise<ActionResult<AuthApiData>> {
  return postAuth("/api/auth/logout");
}
