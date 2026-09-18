import { redirect } from "next/navigation";
import { SETTINGS_GENERAL_PATH } from "@/lib/auth/paths";

export default function RestaurantSettingsRedirectPage() {
  redirect(SETTINGS_GENERAL_PATH);
}
