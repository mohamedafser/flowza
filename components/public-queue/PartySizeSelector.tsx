"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MIN_PARTY_SIZE } from "@/lib/validations/queue";

type PartySizeSelectorProps = {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  error?: string;
};

export function PartySizeSelector({
  id,
  value,
  onChange,
  min = MIN_PARTY_SIZE,
  max,
  disabled,
  error,
}: PartySizeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Party size</Label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-12"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label="Decrease party size"
        >
          <Minus />
        </Button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            onChange(Math.min(max, Math.max(min, Math.trunc(next))));
          }}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-12 w-full rounded-xl border bg-transparent text-center text-xl font-semibold tabular-nums outline-none focus-visible:ring-3"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-12"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label="Increase party size"
        >
          <Plus />
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
