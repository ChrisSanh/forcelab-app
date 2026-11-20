import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the HTTP security policy in next.config.ts.
 * The config computes its values when it is imported, so each test sets the
 * environment first and then loads a fresh copy of the module.
 */

type Header = { key: string; value: string };

async function loadHeaders(env: { NODE_ENV: string; NEXT_PUBLIC_SUPABASE_URL?: string }) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", env.NODE_ENV);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const mod = await import("../../../../next.config");
  const config = mod.default;
  const rules = await config.headers!();
  const headers = rules[0].headers as Header[];
  const byKey = Object.fromEntries(headers.map((h) => [h.key, h.value]));
  return { config, rules, byKey };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security headers", () => {
  it("applies the headers to every route", async () => {
    const { rules } = await loadHeaders({ NODE_ENV: "production" });
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/(.*)");
  });

  it("sets every required header with its strict value", async () => {
    const { byKey } = await loadHeaders({ NODE_ENV: "production" });
    expect(byKey["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(byKey["X-DNS-Prefetch-Control"]).toBe("off");
  });

  it("blocks camera, microphone and geolocation in the Permissions-Policy", async () => {
    const { byKey } = await loadHeaders({ NODE_ENV: "production" });
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(byKey["Permissions-Policy"]).toContain(`${feature}=()`);
    }
  });

  it("does not advertise the framework", async () => {
    const { config } = await loadHeaders({ NODE_ENV: "production" });
    expect(config.poweredByHeader).toBe(false);
  });
});

describe("Content-Security-Policy", () => {
  it("forbids framing, plugins and foreign base URIs", async () => {
    const { byKey } = await loadHeaders({ NODE_ENV: "production" });
    const csp = byKey["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("allows Supabase over HTTPS and WebSocket", async () => {
    const { byKey } = await loadHeaders({ NODE_ENV: "production" });
    const csp = byKey["Content-Security-Policy"];
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("wss://*.supabase.co");
  });

  it("adds the exact project origin from the environment", async () => {
    const { byKey } = await loadHeaders({
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://abcd1234.supabase.co/rest/v1/",
    });
    expect(byKey["Content-Security-Policy"]).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co https://abcd1234.supabase.co");
  });

  it("ignores a malformed Supabase URL instead of breaking the policy", async () => {
    const { byKey } = await loadHeaders({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "not a url" });
    expect(byKey["Content-Security-Policy"]).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co;");
  });

  it("is strict in production: no eval, no localhost, upgrades insecure requests", async () => {
    const { byKey } = await loadHeaders({ NODE_ENV: "production" });
    const csp = byKey["Content-Security-Policy"];
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("localhost");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("only relaxes eval and localhost in development", async () => {
    const { byKey } = await loadHeaders({ NODE_ENV: "development" });
    const csp = byKey["Content-Security-Policy"];
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws://localhost:*");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("never allows wildcard script sources", async () => {
    const { byKey } = await loadHeaders({ NODE_ENV: "production" });
    const scriptSrc = byKey["Content-Security-Policy"].split("; ").find((d) => d.startsWith("script-src"))!;
    expect(scriptSrc).not.toMatch(/\*|https?:/);
  });
});
