import { test, expect } from "@playwright/test";
import { takeToken, clientIp, LIMIT, WINDOW_MS } from "../../src/lib/audit/rateLimit";

test.describe("takeToken", () => {
  test("allows up to the limit then refuses", () => {
    const ip = `test-${Math.random()}`;
    for (let i = 0; i < LIMIT; i++) expect(takeToken(ip)).toBe(true);
    expect(takeToken(ip)).toBe(false);
  });

  test("refills once the window has passed", () => {
    const ip = `test-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < LIMIT; i++) expect(takeToken(ip, t0)).toBe(true);
    expect(takeToken(ip, t0)).toBe(false);
    expect(takeToken(ip, t0 + WINDOW_MS + 1)).toBe(true);
  });

  test("tracks each ip separately", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < LIMIT; i++) takeToken(a);
    expect(takeToken(a)).toBe(false);
    expect(takeToken(b)).toBe(true);
  });
});

test.describe("clientIp", () => {
  test("takes the first entry of X-Forwarded-For (nginx sits in front)", () => {
    const req = new Request("https://dishape.dev/api/audit", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  test("falls back to a constant when the header is absent", () => {
    const req = new Request("https://dishape.dev/api/audit");
    expect(clientIp(req)).toBe("unknown");
  });
});
