"use client";

import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type InstallPWAProps = {
  compact?: boolean;
  className?: string;
};

export function InstallPWA({ compact = false, className }: InstallPWAProps) {
  const {
    installed,
    isIos,
    canPrompt,
    supportsNativePrompt,
    promptInstall,
    dismiss,
  } = usePwaInstall();

  if (installed || !canPrompt) {
    return null;
  }

  if (isIos && !supportsNativePrompt) {
    return (
      <div
        className={cn(
          "border-border bg-card flex max-w-xs items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm",
          className,
        )}
      >
        <Share className="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">Install {APP_NAME}</p>
          <p className="text-muted-foreground">
            Tap Share, then &quot;Add to Home Screen&quot;.
          </p>
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:underline"
            onClick={dismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!supportsNativePrompt) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        size={compact ? "sm" : "default"}
        variant="outline"
        onClick={() => {
          void promptInstall();
        }}
      >
        <Download className="size-3.5" />
        Install {APP_NAME}
      </Button>
      {!compact ? (
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      ) : null}
    </div>
  );
}
