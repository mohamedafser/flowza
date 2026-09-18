import { getAppOrigin } from "@/lib/auth/paths";
import { publicDisplayPath } from "@/lib/public-display/paths";
import { publicQRCodePath } from "@/lib/public-qr/paths";
import {
  publicQueueJoinPath,
  publicQueueStatusPath,
} from "@/lib/public-queue/paths";

/**
 * Canonical absolute public URLs for QR codes, displays, and queue links.
 * Always use these helpers — do not hardcode domains or stitch paths ad hoc.
 */

export function getPublicQueueJoinUrl(input: {
  restaurantSlug: string;
  branchSlug: string;
}): string {
  return `${getAppOrigin()}${publicQueueJoinPath(
    input.restaurantSlug,
    input.branchSlug,
  )}`;
}

export function getPublicQueueStatusUrl(input: {
  restaurantSlug: string;
  branchSlug: string;
  accessToken: string;
}): string {
  return `${getAppOrigin()}${publicQueueStatusPath(
    input.restaurantSlug,
    input.branchSlug,
    input.accessToken,
  )}`;
}

export function getPublicDisplayUrl(input: { publicToken: string }): string {
  return `${getAppOrigin()}${publicDisplayPath(input.publicToken)}`;
}

export function getPublicQRCodeUrl(input: { publicToken: string }): string {
  return `${getAppOrigin()}${publicQRCodePath(input.publicToken)}`;
}
