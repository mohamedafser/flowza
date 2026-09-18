import {
  JSON_ACCEPT,
  JSON_HEADERS,
  parseJsonResult,
  toSearchParams,
} from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type { Branch } from "@/lib/context/restaurant";
import type {
  BranchFormValues,
  BranchListQuery,
} from "@/lib/validations/branch";
import { DEFAULT_BRANCH_PAGE_SIZE } from "@/lib/validations/branch";

export type BranchListApiData = {
  items: Branch[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    offset: number;
  };
  filters: {
    q?: string;
    city?: string;
    country?: string;
    status: BranchListQuery["status"];
    sort: BranchListQuery["sort"];
    order: BranchListQuery["order"];
  };
};

export function buildBranchesApiUrl(
  query: Partial<BranchListQuery> = {},
): string {
  const qs = toSearchParams({
    q: query.q,
    city: query.city,
    country: query.country,
    status: query.status && query.status !== "all" ? query.status : undefined,
    sort: query.sort && query.sort !== "name" ? query.sort : undefined,
    order: query.order && query.order !== "asc" ? query.order : undefined,
    page: query.page && query.page > 1 ? query.page : undefined,
    pageSize:
      query.pageSize && query.pageSize !== DEFAULT_BRANCH_PAGE_SIZE
        ? query.pageSize
        : undefined,
  });
  return qs ? `/api/branches?${qs}` : "/api/branches";
}

export async function listBranchesRequest(
  query: Partial<BranchListQuery> = {},
): Promise<ActionResult<BranchListApiData>> {
  const response = await fetch(buildBranchesApiUrl(query), {
    method: "GET",
    headers: JSON_ACCEPT,
    cache: "no-store",
  });
  return parseJsonResult(response);
}

export async function createBranchRequest(
  restaurantId: string,
  values: BranchFormValues,
): Promise<ActionResult<{ branch: Branch }>> {
  const response = await fetch("/api/branches", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ...values, restaurantId }),
  });
  return parseJsonResult(response);
}

export async function updateBranchRequest(
  branchId: string,
  values: BranchFormValues,
): Promise<ActionResult<{ branch: Branch }>> {
  const response = await fetch(`/api/branches/${branchId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
  return parseJsonResult(response);
}

export async function setBranchStatusRequest(
  branchId: string,
  isActive: boolean,
): Promise<ActionResult<{ branch: Branch }>> {
  const response = await fetch(`/api/branches/${branchId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ isActive }),
  });
  return parseJsonResult(response);
}
