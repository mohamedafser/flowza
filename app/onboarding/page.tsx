import { redirect } from "next/navigation";
import { ONBOARDING_RESTAURANT_PATH } from "@/lib/auth/paths";

export default function OnboardingIndexPage() {
  redirect(ONBOARDING_RESTAURANT_PATH);
}
