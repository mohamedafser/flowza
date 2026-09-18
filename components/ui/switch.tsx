"use client";

import { cn } from "@/lib/utils";

type SwitchProps = {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

export function Switch({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className,
      )}
    >
      <span
        className={cn(
          "bg-background pointer-events-none block size-4 rounded-full shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
