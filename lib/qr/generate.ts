import QRCode from "qrcode";

/** High error correction — suitable for print and partial occlusion. */
const QR_ERROR_CORRECTION: QRCode.QRCodeErrorCorrectionLevel = "H";

export async function generateQRCodeSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: QR_ERROR_CORRECTION,
    margin: 2,
    width: 512,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

export async function generateQRCodePngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: QR_ERROR_CORRECTION,
    margin: 2,
    width: 512,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

/**
 * Sanitize a QR download filename (no tokens or path separators).
 */
export function sanitizeQRFilename(
  name: string,
  extension: "svg" | "png",
): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  if (!base) {
    return `queue-qr.${extension}`;
  }
  return `${base}-queue-qr.${extension}`;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadQRCodeSvg(
  url: string,
  name: string,
): Promise<void> {
  const svg = await generateQRCodeSvg(url);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(sanitizeQRFilename(name, "svg"), blob);
}

export async function downloadQRCodePng(
  url: string,
  name: string,
): Promise<void> {
  const dataUrl = await generateQRCodePngDataUrl(url);
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  downloadBlob(sanitizeQRFilename(name, "png"), blob);
}
