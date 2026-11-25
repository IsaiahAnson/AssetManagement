import { getAuditExportRows } from "@/lib/audit";
import { actingUserHasFirearmAccess } from "@/lib/authz";
import { getActingUser } from "@/lib/session";

// Escapes a value for CSV (wraps in quotes, doubles embedded quotes).
function csv(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  // API routes are outside the proxy, so check the session here.
  if (!(await getActingUser())) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const filters = {
    q: params.get("q")?.trim() || undefined,
    recordType: params.get("recordType") || undefined,
    actor: params.get("actor") || undefined,
    action: params.get("action") || undefined
  };

  const rows = await getAuditExportRows(filters, await actingUserHasFirearmAccess());

  const header = ["Entry", "Timestamp (ET)", "Actor", "Action", "Record type", "Record", "Result"];
  const lines = rows.map((r) =>
    [r.entry, r.timestamp, r.actor, r.action, r.recordType, r.record, r.result].map(csv).join(",")
  );
  const body = [header.map(csv).join(","), ...lines].join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asset-management-audit-log-${stamp}.csv"`
    }
  });
}
