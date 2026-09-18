export const PUBLIC_QR_ROOT = "/qr";
export const PUBLIC_QR_API_ROOT = "/api/public/qr";

export const PUBLIC_QR_TOKEN_MIN = 32;
export const PUBLIC_QR_TOKEN_MAX = 64;
export const PUBLIC_QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export function publicQRCodePath(publicToken: string): string {
  return `${PUBLIC_QR_ROOT}/${encodeURIComponent(publicToken)}`;
}

export function publicQRCodeApiPath(publicToken: string): string {
  return `${PUBLIC_QR_API_ROOT}/${encodeURIComponent(publicToken)}`;
}

export function isValidPublicQRToken(value: string): boolean {
  return (
    value.length >= PUBLIC_QR_TOKEN_MIN &&
    value.length <= PUBLIC_QR_TOKEN_MAX &&
    PUBLIC_QR_TOKEN_PATTERN.test(value)
  );
}

export function isPublicQRPath(pathname: string): boolean {
  return (
    pathname === PUBLIC_QR_ROOT ||
    pathname.startsWith(`${PUBLIC_QR_ROOT}/`) ||
    pathname.startsWith(`${PUBLIC_QR_API_ROOT}/`)
  );
}
