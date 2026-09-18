"use client";

import { useEffect, useState } from "react";
import { generateQRCodeSvg } from "@/lib/qr/generate";
import { cn } from "@/lib/utils";

type QRCodeImageProps = {
  url: string;
  alt: string;
  className?: string;
  sizeClassName?: string;
};

function QRCodeImageInner({
  url,
  alt,
  className,
  sizeClassName = "size-64",
}: QRCodeImageProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void generateQRCodeSvg(url)
      .then((value) => {
        if (!cancelled) setSvg(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div
        className={cn(
          "border-border bg-muted text-muted-foreground flex items-center justify-center rounded-lg border text-sm",
          sizeClassName,
          className,
        )}
        role="img"
        aria-label={alt}
      >
        Unable to generate QR
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={cn(
          "border-border bg-muted animate-pulse rounded-lg border",
          sizeClassName,
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "border-border overflow-hidden rounded-lg border bg-white p-3 [&_svg]:h-full [&_svg]:w-full",
        sizeClassName,
        className,
      )}
      role="img"
      aria-label={alt}
      // SVG is generated locally from a trusted absolute app URL.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Remount on URL change so loading state resets without sync setState-in-effect. */
export function QRCodeImage(props: QRCodeImageProps) {
  return <QRCodeImageInner key={props.url} {...props} />;
}
