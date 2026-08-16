import { test, expect } from "@playwright/test";
import { buildContactEmail } from "../../src/lib/contactEmail";

// The contact email is the only artifact the owner ever reads: if the audit id
// does not reach it, the lead arrives undiagnosed. These tests assert the
// PAYLOAD, not a status code — a route that returns 200 and drops the link is
// the failure mode that matters.

const BASE = {
  name: "Ana Pérez",
  email: "ana@ejemplo.com",
  company: "Ejemplo <S.A.>",
  message: "Hola\nquiero <esto>",
};

// Captured from the route as it stood before auditId existed (commit f1118e6),
// by executing its own template literal. Pinned byte-for-byte: a request with
// no auditId must produce exactly the mail it produced then, whitespace
// included.
const BEFORE = {
  subject: "Nuevo contacto: Ana Pérez · Ejemplo <S.A.>",
  html:
    "\n        <h2>Nuevo mensaje desde dishape.dev</h2>\n" +
    "        <p><strong>Nombre:</strong> Ana Pérez</p>\n" +
    "        <p><strong>Email:</strong> ana@ejemplo.com</p>\n" +
    "        <p><strong>Empresa:</strong> Ejemplo &lt;S.A.&gt;</p>\n" +
    "        <p><strong>Mensaje:</strong></p>\n" +
    '        <p style="white-space:pre-wrap">Hola\nquiero &lt;esto&gt;</p>\n' +
    "      ",
  text:
    "Nombre: Ana Pérez\nEmail: ana@ejemplo.com\nEmpresa: Ejemplo <S.A.>\n" +
    "\nHola\nquiero <esto>",
};

const REPORT = "https://dishape.dev/auditoria/r/abc12345/";

test.describe("buildContactEmail — no audit id", () => {
  test("builds exactly the mail it built before auditId existed", () => {
    expect(buildContactEmail(BASE)).toEqual(BEFORE);
  });

  test("an absent, empty or blank auditId is the same mail", () => {
    for (const auditId of [undefined, "", "   "]) {
      expect(buildContactEmail({ ...BASE, auditId }), JSON.stringify(auditId)).toEqual(
        BEFORE,
      );
    }
  });

  test("an empty company still omits its line, with an audit id present", () => {
    const withAudit = buildContactEmail({ ...BASE, company: "", auditId: "abc12345" });
    expect(withAudit.html).not.toContain("Empresa");
    expect(withAudit.text).not.toContain("Empresa");
    expect(withAudit.subject).toBe("Nuevo contacto: Ana Pérez");
    // The report line is independent of the company line.
    expect(withAudit.html).toContain(REPORT);
    expect(withAudit.text).toContain(REPORT);
  });
});

test.describe("buildContactEmail — a well-formed audit id", () => {
  const mail = buildContactEmail({ ...BASE, auditId: "abc12345" });

  test("puts the report link in the HTML body, as a link", () => {
    expect(mail.html).toContain(`<a href="${REPORT}">${REPORT}</a>`);
  });

  test("puts the report link in the text body too", () => {
    // Some clients render only text/plain. A link that exists in one body and
    // not the other reaches half the mail readers.
    expect(mail.text).toContain(`Reporte: ${REPORT}\n`);
  });

  test("changes nothing else about the mail", () => {
    expect(mail.subject).toBe(BEFORE.subject);
    // Strip the added line and the mail must be byte-identical to before.
    const stripped = mail.html.replace(
      `\n        <p><strong>Reporte de la auditoría:</strong> <a href="${REPORT}">${REPORT}</a></p>`,
      "",
    );
    expect(stripped).toBe(BEFORE.html);
    expect(mail.text.replace(`Reporte: ${REPORT}\n`, "")).toBe(BEFORE.text);
  });

  test("trims surrounding whitespace rather than rejecting the id", () => {
    expect(buildContactEmail({ ...BASE, auditId: " abc12345 " }).html).toContain(REPORT);
  });
});

test.describe("buildContactEmail — a malformed audit id never reaches the mail", () => {
  // The id is interpolated into a URL. Anything that is not the store's own
  // 8-char shape (src/lib/audit/id.ts) must be dropped, not escaped and kept:
  // there is no report behind it either way.
  const malformed = [
    "abc1234", // 7 chars
    "abc123456", // 9 chars
    "ABC12345", // uppercase — the store never issues one
    "abc-1234",
    "abc 1234",
    "abc1234\n",
    "abc12345/../../etc/passwd",
    "../../../etc/passwd",
    "abc12345?x=1",
    "abc12345#frag",
    'abc12345"><script>alert(1)</script>',
    'a" onmouseover="alert(1)',
    "javascript:alert(1)",
    "https://evil.example/",
    "%2e%2e%2f",
  ];

  for (const auditId of malformed) {
    test(`drops ${JSON.stringify(auditId)}`, () => {
      const mail = buildContactEmail({ ...BASE, auditId });
      // Not merely "no link": the mail must be the one built with no id at all.
      expect(mail).toEqual(BEFORE);
      expect(mail.html).not.toContain("/auditoria/r/");
      expect(mail.text).not.toContain("/auditoria/r/");
    });
  }

  test("a hostile id leaves no fragment of itself anywhere in the mail", () => {
    const mail = buildContactEmail({
      ...BASE,
      auditId: 'abc12345"><script>alert(1)</script>',
    });
    for (const shard of ["<script", "alert(1)", "abc12345"]) {
      expect(mail.html, shard).not.toContain(shard);
      expect(mail.text, shard).not.toContain(shard);
    }
  });
});
