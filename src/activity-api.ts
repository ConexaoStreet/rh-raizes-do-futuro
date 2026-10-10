import { client } from "./api";
import {
  resolveActivityNames,
  activityReferenceName,
  type ActivityEntry,
} from "../shared/activity-language";

export function readActivityNames(entries: readonly ActivityEntry[]) {
  return resolveActivityNames(entries, async (request) => {
    const result = await client()
      .from(request.table)
      .select(
        "id," +
          request.field +
          (request.table === "permissions" ? ",code" : ""),
      )
      .in("id", request.ids);
    if (result.error) return [];
    return (result.data as unknown as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      name: activityReferenceName(request, row),
    }));
  });
}
