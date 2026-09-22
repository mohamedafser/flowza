import { LogoutButton } from "@/components/auth/LogoutButton";
import { ErrorState } from "@/components/common/ErrorState";

export default function SuspendedPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10">
      <ErrorState
        title="Account suspended"
        message="This restaurant account is suspended or inactive. Team members cannot access the dashboard until platform support reactivates the account."
      />
      <p className="text-muted-foreground mt-4 text-sm">
        If you believe this is a mistake, contact your platform administrator or
        support team with your restaurant name.
      </p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
