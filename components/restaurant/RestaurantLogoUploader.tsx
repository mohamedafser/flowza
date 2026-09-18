"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  removeRestaurantLogoRequest,
  uploadRestaurantLogoRequest,
} from "@/lib/api/restaurants-client";
import { Button } from "@/components/ui/button";
import { LOGO_MAX_BYTES } from "@/lib/validations/restaurant";

type RestaurantLogoUploaderProps = {
  restaurantId: string;
  logoUrl: string | null;
  canManage: boolean;
};

export function RestaurantLogoUploader({
  restaurantId,
  logoUrl,
  canManage,
}: RestaurantLogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [pending, startTransition] = useTransition();

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    startTransition(async () => {
      const result = await uploadRestaurantLogoRequest(restaurantId, file);
      URL.revokeObjectURL(objectUrl);
      if (!result.ok) {
        setPreview(logoUrl);
        toast.error(result.message ?? "Upload failed.");
        return;
      }
      setPreview(result.data?.logoUrl ?? null);
      toast.success("Logo updated.");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    });
  };

  const onRemove = () => {
    startTransition(async () => {
      const result = await removeRestaurantLogoRequest(restaurantId);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to remove logo.");
        return;
      }
      setPreview(null);
      toast.success("Logo removed.");
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="border-border bg-muted/40 flex size-20 items-center justify-center overflow-hidden rounded-xl border">
        {preview ? (
          <Image
            src={preview}
            alt="Restaurant logo"
            width={80}
            height={80}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-muted-foreground text-xs">No logo</span>
        )}
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={onFileChange}
            disabled={pending}
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Uploading…" : preview ? "Replace logo" : "Upload logo"}
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
