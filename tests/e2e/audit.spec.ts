import { test, expect } from "@playwright/test";

// The audit endpoint fetches a user-supplied URL. These tests pin the
// failure modes that matter: bad input must be rejected before any fetch,
// and internal addresses must never be reachable through the tool.
test.describe("POST /api/audit — input rejection", () => {
  const cases: { name: string; url: string; error: string }[] = [
    { name: "empty", url: "", error: "url_invalid" },
    { name: "garbage", url: "not a url", error: "url_invalid" },
    { name: "javascript scheme", url: "javascript:alert(1)", error: "url_invalid" },
    { name: "loopback", url: "http://127.0.0.1:4321/", error: "url_blocked" },
    { name: "localhost", url: "http://localhost:4321/", error: "url_blocked" },
    { name: "cloud metadata", url: "http://169.254.169.254/", error: "url_blocked" },
  ];

  // Playwright's request fixture sends no X-Forwarded-For, so every case
  // would otherwise collide on the single clientIp() bucket "unknown" and
  // spuriously rate-limit each other under fullyParallel. Give each case its
  // own synthetic client address, matching how nginx gives each real visitor
  // a distinct one in production.
  cases.forEach((c, i) => {
    test(`rejects ${c.name}`, async ({ request }) => {
      const res = await request.post("/api/audit", {
        headers: { "x-forwarded-for": `203.0.113.${i + 10}` },
        data: { url: c.url, lang: "es" },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(c.error);
    });
  });

  test("rejects a malformed body", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `203.0.113.${cases.length + 10}`,
      },
      data: "not json at all",
    });
    expect(res.status()).toBe(400);
  });
});
