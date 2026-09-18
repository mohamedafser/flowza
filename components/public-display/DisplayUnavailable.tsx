import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";

type DisplayUnavailableProps = {
  message?: string;
};

export function DisplayUnavailable({ message }: DisplayUnavailableProps) {
  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {PUBLIC_DISPLAY_MESSAGES.unavailable}
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-base sm:text-lg">
        {message ?? PUBLIC_DISPLAY_MESSAGES.contactStaff}
      </p>
    </div>
  );
}
