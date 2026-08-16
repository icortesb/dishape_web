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
  test("takes the last X-Forwarded-For entry, which nginx appends", () => {
    // A client that sends its own X-Forwarded-For gets it prepended, not
    // trusted: bucketing on the first entry would let it pick its own bucket.
    const req = new Request("https://dishape.dev/api/audit", {
      headers: { "x-forwarded-for": "1.2.3.4, 190.55.10.20" },
    });
    expect(clientIp(req)).toBe("190.55.10.20");
  });

  test("falls back to x-real-ip when there is no forwarded chain", () => {
    const req = new Request("https://dishape.dev/api/audit", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  test("falls back to unknown when the header is absent", () => {
    const req = new Request("https://dishape.dev/api/audit");
    expect(clientIp(req)).toBe("unknown");
  });
});
