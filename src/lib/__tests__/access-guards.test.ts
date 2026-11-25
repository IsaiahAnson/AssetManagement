import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import * as session from "@/lib/session";
import { canActingUserWrite } from "@/lib/authz";
import { resolveActor } from "@/lib/audit";

// A fake pg pool: each query is matched by a SQL snippet. No database needed.
type Handler = { match: string; rows: Record<string, unknown>[] };
const handlers: Handler[] = [];
const issued: string[] = [];

const fakeClient = {
  query: vi.fn(async (sql: string) => {
    issued.push(sql);
    const h = handlers.find((x) => sql.includes(x.match));
    const rows = h?.rows ?? [];
    return { rows, rowCount: rows.length };
  }),
  release: vi.fn()
};

vi.mock("@/lib/db", () => ({
  getPool: () => ({ connect: async () => fakeClient, query: fakeClient.query })
}));

const { transferCustody, checkInAsset, dispositionAsset, updateComputerAsset } = await import("@/lib/assets");

const USER_ID = "3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b";

beforeEach(() => {
  handlers.length = 0;
  issued.length = 0;
  vi.mocked(session.getActingUserId).mockResolvedValue(USER_ID);
  handlers.push({
    match: "SELECT id, display_name FROM app_users",
    rows: [{ id: USER_ID, display_name: "Test User" }]
  });
});

describe("canActingUserWrite", () => {
  it("is false when nobody is signed in", async () => {
    vi.mocked(session.getActingUser).mockResolvedValueOnce(null);
    expect(await canActingUserWrite()).toBe(false);
  });

  it("is false for the read-only role", async () => {
    vi.mocked(session.getActingUser).mockResolvedValueOnce({
      id: USER_ID, displayName: "Reader", roleCode: "read_only", roleName: "Read-Only"
    });
    expect(await canActingUserWrite()).toBe(false);
  });

  it("is true for an asset manager", async () => {
    vi.mocked(session.getActingUser).mockResolvedValueOnce({
      id: USER_ID, displayName: "Manager", roleCode: "asset_manager", roleName: "Asset Manager"
    });
    expect(await canActingUserWrite()).toBe(true);
  });
});

describe("resolveActor", () => {
  it("refuses when nobody is signed in", async () => {
    vi.mocked(session.getActingUserId).mockResolvedValueOnce(null);
    await expect(resolveActor(fakeClient as unknown as PoolClient)).rejects.toThrow(/signed-in user/);
  });

  it("returns the signed-in user", async () => {
    await expect(resolveActor(fakeClient as unknown as PoolClient)).resolves.toEqual({
      id: USER_ID,
      label: "Test User"
    });
  });
});

describe("generic asset writes refuse high-sensitivity assets", () => {
  const sensitiveRow = {
    id: "a1", asset_tag: "NWA-FRM-00472", current_custodian_id: USER_ID, status: "available", sensitive: true
  };

  beforeEach(() => {
    handlers.push({ match: "FROM assets a JOIN asset_categories c", rows: [sensitiveRow] });
  });

  it.each([
    ["transferCustody", () => transferCustody("NWA-FRM-00472", USER_ID)],
    ["checkInAsset", () => checkInAsset("NWA-FRM-00472")],
    ["dispositionAsset", () => dispositionAsset("NWA-FRM-00472")],
    ["updateComputerAsset", () => updateComputerAsset("a1", { model: "m", serial: "s", office: "o" })]
  ])("%s throws and rolls back", async (_name, run) => {
    await expect(run()).rejects.toThrow(/Firearms module/);
    expect(issued.some((sql) => sql.startsWith("UPDATE assets"))).toBe(false);
    expect(issued).toContain("ROLLBACK");
  });
});

describe("retired assets", () => {
  beforeEach(() => {
    handlers.push({
      match: "FROM assets a JOIN asset_categories c",
      rows: [{ id: "a2", current_custodian_id: null, status: "retired", sensitive: false }]
    });
  });

  it("cannot be dispositioned twice", async () => {
    await expect(dispositionAsset("NWA-CMP-10001")).rejects.toThrow(/already dispositioned/);
    expect(issued.some((sql) => sql.startsWith("UPDATE assets"))).toBe(false);
  });

  it("cannot be issued again", async () => {
    await expect(transferCustody("NWA-CMP-10001", USER_ID)).rejects.toThrow(/retired/);
    expect(issued.some((sql) => sql.startsWith("UPDATE assets"))).toBe(false);
  });
});
