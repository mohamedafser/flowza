import type { Metadata } from "next";
import { RestaurantOnboardingForm } from "@/components/restaurant/RestaurantOnboardingForm";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AppLogo } from "@/components/common/AppLogo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireOnboardingPage } from "@/lib/context/workspace";

export const metadata: Metadata = {
  title: "Set up your restaurant",
};

export const dynamic = "force-dynamic";

export default async function RestaurantOnboardingPage() {
  const auth = await requireOnboardingPage();

  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex w-full max-w-xl items-center justify-between">
        <AppLogo />
        <LogoutButton variant="ghost" size="sm" />
      </div>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Set up your restaurant</CardTitle>
          <CardDescription>
            Create your restaurant profile to start managing branches and
            queues. You can update these details later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RestaurantOnboardingForm defaultEmail={auth.user.email ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
