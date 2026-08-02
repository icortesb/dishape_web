import { test, expect } from "@playwright/test";
import { safeFetch, isBlockedAddress } from "../../src/lib/audit/safeFetch";

test.describe("isBlockedAddress", () => {
  const blocked = [
    "127.0.0.1",
    "127.53.1.9",
    "0.0.0.0",
    "10.0.0.5",
    "172.16.4.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata — the one that actually gets exploited
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
  ];
  for (const ip of blocked) {
    test(`blocks ${ip}`, () => {
      expect(isBlockedAddress(ip)).toBe(true);
    });
  }

  const allowed = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "11.0.0.1", "2606:4700::1"];
  for (const ip of allowed) {
    test(`allows ${ip}`, () => {
      expect(isBlockedAddress(ip)).toBe(false);
    });
  }
});

test.describe("safeFetch rejects hostile input", () => {
  test("non-http scheme", async () => {
    const r = await safeFetch("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_invalid");
  });

  test("embedded credentials", async () => {
    const r = await safeFetch("https://user:pass@example.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_invalid");
  });

  test("loopback host", async () => {
    const r = await safeFetch("http://127.0.0.1:8080/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_blocked");
  });

  test("localhost by name", async () => {
    const r = await safeFetch("http://localhost:4321/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_blocked");
  });

  test("cloud metadata endpoint", async () => {
    const r = await safeFetch("http://169.254.169.254/latest/meta-data/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_blocked");
  });
});
