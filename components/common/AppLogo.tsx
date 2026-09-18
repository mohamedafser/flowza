import Image from "next/image";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeStyles = {
  sm: {
    mark: "size-8",
    px: 32,
    wordmark: "text-sm",
  },
  md: {
    mark: "size-9",
    px: 36,
    wordmark: "text-lg",
  },
  lg: {
    mark: "size-11",
    px: 44,
    wordmark: "text-xl",
  },
} as const;

export function AppLogo({
  className,
  markClassName,
  showWordmark = true,
  size = "sm",
}: AppLogoProps) {
  const styles = sizeStyles[size];

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/icons/icon-192x192.png"
        alt={showWordmark ? "" : APP_NAME}
        width={styles.px}
        height={styles.px}
        className={cn("shrink-0", styles.mark, markClassName)}
        priority
      />
      {showWordmark ? (
        <span
          className={cn(
            "text-foreground truncate font-semibold tracking-tight",
            styles.wordmark,
          )}
        >
          {APP_NAME}
        </span>
      ) : null}
    </span>
  );
}
