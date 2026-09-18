"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

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
          await signOutAction();
        });
      }}
    >
      <LogOut />
      {iconOnly ? null : pending ? "Signing out…" : label}
    </Button>
  );
}
