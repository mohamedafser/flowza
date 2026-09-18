import { NextResponse } from "next/server";
import type { HealthResponse } from "@/lib/validations";

export function GET() {
  const body: HealthResponse = { status: "ok" };
  return NextResponse.json(body);
}
