"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  containerClassName?: string;
};

export function PasswordInput({
  className,
  containerClassName,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        autoComplete={props.autoComplete}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        nativeButton
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
