// Shared, language-agnostic site constants.
export const SITE = {
  name: "dishape",
  url: "https://dishape.dev",
  email: "dishape.dev@gmail.com",
  whatsapp: "5491158583740", // E.164 without "+", used for wa.me links
  whatsappDisplay: "+54 9 11 5858-3740",
  social: {
    github: "https://github.com/icortesb",
    linkedin: "https://www.linkedin.com/in/ivan-cortes-buenard/",
  },
} as const;

export const waLink = (text?: string) =>
  `https://wa.me/${SITE.whatsapp}${
    text ? `?text=${encodeURIComponent(text)}` : ""
  }`;
