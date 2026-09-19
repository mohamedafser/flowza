"use client";

import * as React from "react";
import PhoneNumberInput, {
  type Country,
  type Props as PhoneNumberInputProps,
  type Value,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { cn } from "cn";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/utils/phone";

type PhoneInputProps = Omit<
  PhoneNumberInputProps<React.ComponentProps<"input">>,
  "value" | "onChange" | "numberInputProps"
> & {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  className?: string;
  inputClassName?: string;
};

const PhoneTextInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(function PhoneTextInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="tel"
      data-slot="phone-input"
      className={cn(
        "placeholder:text-muted-foreground h-8 min-w-0 flex-1 border-0 bg-transparent px-2.5 py-1 text-base outline-none md:text-sm",
        className,
      )}
      {...props}
    />
  );
});

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      onBlur,
      id,
      name,
      disabled,
      required,
      className,
      inputClassName,
      defaultCountry = DEFAULT_PHONE_COUNTRY,
      international = true,
      countryCallingCodeEditable = false,
      ...props
    },
    ref,
  ) {
    return (
      <PhoneNumberInput
        {...props}
        international={international}
        countryCallingCodeEditable={countryCallingCodeEditable}
        defaultCountry={defaultCountry as Country}
        flags={flags}
        value={(value || undefined) as Value | undefined}
        onChange={(next) => {
          onChange?.(next ?? "");
        }}
        onBlur={onBlur}
        disabled={disabled}
        numberInputProps={{
          id,
          name,
          required,
          "aria-invalid": props["aria-invalid"],
          "aria-required": props["aria-required"],
          "aria-describedby": props["aria-describedby"],
          className: inputClassName,
          ref,
        }}
        inputComponent={PhoneTextInput}
        className={cn(
          "border-input focus-within:border-ring focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 flex h-8 w-full min-w-0 items-stretch overflow-hidden rounded-lg border bg-transparent transition-colors focus-within:ring-3",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
          props["aria-invalid"] && "border-destructive ring-destructive/20 ring-3",
          className,
        )}
      />
    );
  },
);
