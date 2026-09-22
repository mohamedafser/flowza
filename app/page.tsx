import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} · Restaurant queue, guest flow & billing`,
  description: `${APP_TAGLINE} ${APP_DESCRIPTION} Start free, then upgrade plans as your restaurant grows.`,
};

export default function HomePage() {
  return <LandingPage />;
}
