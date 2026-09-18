import { cn } from "@/lib/utils";

type QueueTokenCardProps = {
  token: string;
  className?: string;
};

export function QueueTokenCard({ token, className }: QueueTokenCardProps) {
  return (
    <div
      className={cn(
        "border-border bg-card rounded-3xl border px-4 py-8 text-center shadow-sm",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
        Your number
      </p>
      <p
        className="text-foreground mt-2 font-mono text-6xl font-semibold tracking-[0.12em]"
        aria-label={`Queue token ${token}`}
      >
        {token}
      </p>
    </div>
  );
}
