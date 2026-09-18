"use client";

import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { QRCodeImage } from "@/components/qr-codes/QRCodeImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadQRCodePng, downloadQRCodeSvg } from "@/lib/qr/generate";
import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";
import { getPublicQRCodeUrl } from "@/lib/utils/public-urls";
import type { QRCodeListItem } from "@/services/qr-codes";

type QRPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: QRCodeListItem | null;
  onPrint?: (qrCode: QRCodeListItem) => void;
};

export function QRPreviewDialog({
  open,
  onOpenChange,
  qrCode,
  onPrint,
}: QRPreviewDialogProps) {
  if (!qrCode) return null;

  const url = getPublicQRCodeUrl({ publicToken: qrCode.public_token });
  const alt = `QR code for ${qrCode.name} queue`;

  const onDownloadSvg = async () => {
    try {
      await downloadQRCodeSvg(url, qrCode.name);
      toast.success("SVG downloaded.");
    } catch {
      toast.error("Unable to download SVG.");
    }
  };

  const onDownloadPng = async () => {
    try {
      await downloadQRCodePng(url, qrCode.name);
      toast.success("PNG downloaded.");
    } catch {
      toast.error("Unable to download PNG.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{qrCode.name}</DialogTitle>
          <DialogDescription>
            Preview of the printable queue join QR code.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <QRCodeImage url={url} alt={alt} sizeClassName="size-64 sm:size-72" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {PUBLIC_QR_MESSAGES.scanToJoin}
            </p>
            <p className="text-muted-foreground text-sm">
              {qrCode.branch_name}
            </p>
            <p className="text-muted-foreground text-sm">{qrCode.queue_name}</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex w-full flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => void onDownloadSvg()}
            >
              <Download className="size-4" />
              Download SVG
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => void onDownloadPng()}
            >
              <Download className="size-4" />
              Download PNG
            </Button>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              onPrint?.(qrCode);
              onOpenChange(false);
            }}
          >
            <Printer className="size-4" />
            Print QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
