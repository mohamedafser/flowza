import { jsonFail, jsonOk, statusForActionCode } from "@/lib/api/json";
import type { AuthFlowResult } from "@/services/auth/flows";

export function jsonFromAuthFlow(result: AuthFlowResult, successStatus = 200) {
  if (!result.ok) {
    return jsonFail(
      result.code,
      result.message,
      statusForActionCode(result.code),
      result.data,
    );
  }
  return jsonOk(result.data, successStatus);
}
