type DisplayLoadingProps = {
  restaurantName?: string | null;
};

export function DisplayLoading({ restaurantName }: DisplayLoadingProps) {
  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {restaurantName ? (
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {restaurantName}
        </p>
      ) : null}
      <p className="text-muted-foreground mt-3 text-lg">Loading queue…</p>
    </div>
  );
}
