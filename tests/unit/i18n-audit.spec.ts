import { test, expect } from "@playwright/test";
import { es } from "../../src/i18n/es";
import { en } from "../../src/i18n/en";
import { registry } from "../../src/lib/audit/registry";
import { interpolate } from "../../src/lib/audit/copy";

test.describe("audit copy", () => {
  test("every registered check has Spanish copy", () => {
    const missing = registry
      .map((c) => c.id)
      .filter((id) => !(id in es.audit.checks));
    expect(missing).toEqual([]);
  });

  test("every registered check has English copy", () => {
    const missing = registry
      .map((c) => c.id)
      .filter((id) => !(id in en.audit.checks));
    expect(missing).toEqual([]);
  });

  test("the two dictionaries declare the same check ids", () => {
    expect(Object.keys(es.audit.checks).sort()).toEqual(
      Object.keys(en.audit.checks).sort(),
    );
  });

  test("every check entry has all four fields in both languages", () => {
    for (const dict of [es, en]) {
      for (const [id, copy] of Object.entries(dict.audit.checks)) {
        for (const field of ["name", "why", "found", "fix"] as const) {
          expect(typeof copy[field], `${id}.${field}`).toBe("string");
          expect(copy[field].length, `${id}.${field}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

test.describe("interpolate", () => {
  test("substitutes evidence values", () => {
    expect(interpolate("Tiene {actual} de {max}", { actual: 87, max: 60 })).toBe(
      "Tiene 87 de 60",
    );
  });

  test("leaves unknown placeholders untouched rather than printing undefined", () => {
    expect(interpolate("Valor {nope}", { actual: 1 })).toBe("Valor {nope}");
  });

  test("handles a missing evidence object", () => {
    expect(interpolate("Sin datos", undefined)).toBe("Sin datos");
  });
});
