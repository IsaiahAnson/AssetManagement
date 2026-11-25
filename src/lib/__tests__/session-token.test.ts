import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getSessionSecret,
  signSessionValue,
  verifySessionValue
} from "@/lib/session-token";

const USER_ID = "3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b";
const SECRET = "test-secret-for-unit-tests";

describe("session cookie signing", () => {
  it("round-trips a signed user id", () => {
    const value = signSessionValue(USER_ID, SECRET);
    expect(value.startsWith(`${USER_ID}.`)).toBe(true);
    expect(verifySessionValue(value, SECRET)).toBe(USER_ID);
  });

  it("rejects a value signed with another secret", () => {
    const value = signSessionValue(USER_ID, "some-other-secret");
    expect(verifySessionValue(value, SECRET)).toBeNull();
  });

  it("rejects a bare user id with no signature", () => {
    expect(verifySessionValue(USER_ID, SECRET)).toBeNull();
  });

  it("rejects a valid signature moved to another user id", () => {
    const signature = signSessionValue(USER_ID, SECRET).split(".")[1];
    const otherId = "00000000-0000-4000-8000-000000000000";
    expect(verifySessionValue(`${otherId}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const value = signSessionValue(USER_ID, SECRET);
    const last = value.slice(-1) === "A" ? "B" : "A";
    expect(verifySessionValue(value.slice(0, -1) + last, SECRET)).toBeNull();
  });

  it("treats malformed values as signed out instead of throwing", () => {
    for (const bad of ["", "not-a-uuid", "not-a-uuid.abc", ".", `${USER_ID}.`, "'; DROP TABLE app_users;--"]) {
      expect(verifySessionValue(bad, SECRET)).toBeNull();
    }
    expect(verifySessionValue(undefined, SECRET)).toBeNull();
    expect(verifySessionValue(null, SECRET)).toBeNull();
  });

  it("refuses to sign a non-UUID id", () => {
    expect(() => signSessionValue("admin", SECRET)).toThrow();
  });
});

describe("getSessionSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses SESSION_SECRET when set", () => {
    vi.stubEnv("SESSION_SECRET", "from-env");
    expect(getSessionSecret()).toBe("from-env");
  });

  it("falls back to a dev secret outside production", () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getSessionSecret()).toBeTruthy();
  });

  it("throws in production when SESSION_SECRET is missing", () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET/);
  });
});
