import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

function resolveOtpPepper(): string {
  const pepper =
    process.env.OTP_PEPPER?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";

  if (pepper) {
    return pepper;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OTP_PEPPER (or SUPABASE_SERVICE_ROLE_KEY) is required in production.",
    );
  }

  return "flowza-otp-dev-pepper";
}

/** Cryptographically strong 6-digit code (000000–999999). */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string, email: string, purpose: string): string {
  const pepper = resolveOtpPepper();
  return createHash("sha256")
    .update(`${pepper}:${purpose}:${email}:${code}`)
    .digest("hex");
}

export function secureEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  const pepper = resolveOtpPepper();
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}
