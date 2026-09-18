"use client";

import { useEffect } from "react";
import { QRCodeImage } from "@/components/qr-codes/QRCodeImage";
import { Button } from "@/components/ui/button";
import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";
import { getPublicQRCodeUrl } from "@/lib/utils/public-urls";
import type { QRCodeListItem } from "@/services/qr-codes";

type QRPrintViewProps = {
  qrCode: QRCodeListItem;
  onClose: () => void;
};

export function QRPrintView({ qrCode, onClose }: QRPrintViewProps) {
  const url = getPublicQRCodeUrl({ publicToken: qrCode.public_token });
  const settings = qrCode.settings;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${qrCode.name} — Queue QR`;
    const timer = window.setTimeout(() => {
      window.print();
    }, 350);

    const onAfterPrint = () => {
      document.title = previousTitle;
      onClose();
    };
    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
      document.title = previousTitle;
    };
  }, [onClose, qrCode.name]);

  return (
    <div className="qr-print-root fixed inset-0 z-[100] bg-white text-slate-900">
      <div className="no-print flex justify-end gap-2 border-b border-slate-200 p-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <div className="qr-print-sheet mx-auto flex min-h-[80dvh] max-w-xl flex-col items-center justify-center gap-6 px-8 py-12 text-center">
        {settings.showRestaurantName ? (
          <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">
            {qrCode.restaurant_name}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">{qrCode.name}</h1>
        <QRCodeImage
          url={url}
          alt={`QR code for ${qrCode.name} queue`}
          sizeClassName="size-72 sm:size-80"
          className="qr-print-code border-slate-200 shadow-none"
        />
        <p className="text-lg font-medium">{PUBLIC_QR_MESSAGES.scanToJoin}</p>
        <div className="space-y-1 text-slate-600">
          {settings.showBranchName ? <p>{qrCode.branch_name}</p> : null}
          {settings.showQueueName ? <p>{qrCode.queue_name}</p> : null}
          {settings.caption ? (
            <p className="text-sm">{settings.caption}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
