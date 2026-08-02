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

  for (const c of cases) {
    test(`rejects ${c.name}`, async ({ request }) => {
      const res = await request.post("/api/audit", {
        data: { url: c.url, lang: "es" },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(c.error);
    });
  }

  test("rejects a malformed body", async ({ request }) => {
    const res = await request.post("/api/audit", {
      headers: { "content-type": "application/json" },
      data: "not json at all",
    });
    expect(res.status()).toBe(400);
  });
});
