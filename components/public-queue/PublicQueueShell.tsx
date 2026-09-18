import { ThemeToggle } from "@/components/common/ThemeToggle";
import { cn } from "@/lib/utils";

type PublicQueueShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PublicQueueShell({
  children,
  className,
}: PublicQueueShellProps) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <div className="flex justify-end px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))]">
        <ThemeToggle />
      </div>
      <main
        className={cn(
          "mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-2 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
