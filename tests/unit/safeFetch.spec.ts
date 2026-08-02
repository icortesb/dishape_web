import { test, expect } from "@playwright/test";
import { safeFetch, isBlockedAddress, createSafeFetch } from "../../src/lib/audit/safeFetch";
import { createServer } from "node:http";

test.describe("isBlockedAddress", () => {
  const blocked = [
    "127.0.0.1",
    "127.53.1.9",
    "0.0.0.0",
    "10.0.0.5",
    "100.100.100.200",
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

  test("re-validates the address on each redirect hop", async () => {
    // A public first hop that 302s into link-local space. The injected policy
    // permits loopback so the local test server is reachable; everything the
    // real policy blocks stays blocked.
    const server = createServer((_req, res) => {
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };

    const fetchAllowingLoopback = createSafeFetch({
      isBlocked: (ip) => ip !== "127.0.0.1" && isBlockedAddress(ip),
    });

    try {
      const result = await fetchAllowingLoopback(`http://127.0.0.1:${port}/`);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("url_blocked");
    } finally {
      server.close();
    }
  });

  test("resolves a hostname through the lookup hook and returns the body", async () => {
    // "localhost" (a name, not a literal) is the only way to exercise pinnedLookup
    // without touching the network. The injected policy permits loopback so the
    // local server is reachable; every other range stays blocked.
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<html><head><title>ok</title></head><body>hola</body></html>");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };

    const fetchAllowingLoopback = createSafeFetch({
      isBlocked: (ip) => ip !== "127.0.0.1" && ip !== "::1" && isBlockedAddress(ip),
    });

    try {
      const result = await fetchAllowingLoopback(`http://localhost:${port}/`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe(200);
        expect(result.html).toContain("<title>ok</title>");
      }
    } finally {
      server.close();
    }
  });

  test("blocks bracketed IPv6 loopback literal", async () => {
    const r = await safeFetch("http://[::1]:1/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_blocked");
  });

  test("blocks bracketed IPv6 link-local literal", async () => {
    const r = await safeFetch("http://[fe80::1]:1/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("url_blocked");
  });
});
