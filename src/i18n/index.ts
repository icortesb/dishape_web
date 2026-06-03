import { es } from "./es";
import { en } from "./en";

export const languages = { es: "ES", en: "EN" } as const;
export const localeNames = { es: "Español", en: "English" } as const;
export const defaultLang = "es" as const;

export const ui = { es, en };
export type Lang = keyof typeof ui;

/** Resolve the active locale from the global Astro object inside any component. */
export function getLang(astro: { currentLocale?: string }): Lang {
  const l = astro.currentLocale;
  return l === "en" || l === "es" ? l : defaultLang;
}

/** Translation dictionary for the active locale. */
export function getDict(lang: Lang) {
  return ui[lang];
}
