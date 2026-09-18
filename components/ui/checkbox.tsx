"use client";

import { cn } from "@/lib/utils";

type CheckboxProps = {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  name?: string;
};

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
  name,
}: CheckboxProps) {
  return (
    <input
      id={id}
      name={name}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange(event.target.checked)}
      className={cn(
        "border-input accent-primary focus-visible:border-ring focus-visible:ring-ring/50 size-4 shrink-0 rounded border bg-transparent outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}
