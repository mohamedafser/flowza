"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  disabled?: boolean;
};

export function SearchInput({
  value,
  defaultValue,
  onChange,
  placeholder = "Search…",
  className,
  name = "q",
  disabled = false,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full max-w-sm", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        name={name}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="pl-8"
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}
