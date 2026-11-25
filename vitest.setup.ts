import { readFileSync } from "node:fs";
import { vi } from "vitest";

// Tests call the lib directly, outside a request, so there is no session
// cookie. Library writes refuse to run without a signed-in user, so the
// integration suites act as the first seeded Asset Manager. Tests can
// override either function with mockResolvedValueOnce.
vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    getActingUser: vi.fn(actual.getActingUser),
    getActingUserId: vi.fn(async (): Promise<string | null> => {
      if (!process.env.DATABASE_URL) return null;
      const { getPool } = await import("@/lib/db");
      const r = await getPool().query<{ id: string }>(
        `SELECT u.id
           FROM app_users u
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           LEFT JOIN roles r ON r.id = ur.role_id
          WHERE u.active = true
          ORDER BY (r.code = 'asset_manager') DESC NULLS LAST, u.display_name
          LIMIT 1`
      );
      return r.rows[0]?.id ?? null;
    })
  };
});

// Load the local .env into process.env (no dotenv dependency) so DB integration
// tests can connect. If .env is absent (e.g., CI), DATABASE_URL stays unset and
// the integration tests skip themselves.
try {
  const env = readFileSync(new URL("./.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // No .env present; integration tests will skip.
}
