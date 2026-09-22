import Link from "next/link";
import { AccessDenied } from "@/components/common/AccessDenied";
import { Button } from "@/components/ui/button";
import { DASHBOARD_OVERVIEW_PATH, LOGIN_PATH } from "@/lib/auth/paths";

export default function AdminUnauthorizedPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10">
      <AccessDenied
        title="Platform admin"
        message="Restaurant accounts cannot access the SaaS admin area. Super Admin access must be granted through a secure administrative process."
      />
      <div className="mt-6 flex flex-wrap gap-2">
        <Button render={<Link href={DASHBOARD_OVERVIEW_PATH} />}>
          Go to dashboard
        </Button>
        <Button variant="outline" render={<Link href={LOGIN_PATH} />}>
          Sign in
        </Button>
      </div>
    </div>
  );
}
