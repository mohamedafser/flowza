"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutRequest } from "@/lib/api/auth-client";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH } from "@/lib/auth/paths";

type LogoutButtonProps = {
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
  iconOnly?: boolean;
};

export function LogoutButton({
  variant = "outline",
  size = "default",
  className,
  label = "Sign out",
  iconOnly = false,
}: LogoutButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : size}
      className={className}
      disabled={pending}
      aria-label={label}
      onClick={() => {
        startTransition(async () => {
          await signOutRequest();
          router.replace(LOGIN_PATH);
          router.refresh();
        });
      }}
    >
      <LogOut />
      {iconOnly ? null : pending ? "Signing out…" : label}
    </Button>
  );
}
