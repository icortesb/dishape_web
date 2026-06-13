// Shared, language-agnostic site constants.
export const SITE = {
  name: "dishape",
  url: "https://dishape.dev",
  email: "dishape.dev@gmail.com",
  calendly: "https://calendly.com/dishape-dev/10min",
  whatsapp: "5491158583740", // E.164 without "+", used for wa.me links
  whatsappDisplay: "+54 9 11 5858-3740",
  social: {
    github: "https://github.com/icortesb",
    linkedin: "https://www.linkedin.com/in/ivan-cortes-buenard/",
  },
  // Author identity for BlogPosting schema (a linkable Person is a trust
  // signal, not a seniority claim — kept out of the visible byline).
  author: "Iván Cortés",
} as const;

export const waLink = (text?: string) =>
  `https://wa.me/${SITE.whatsapp}${
    text ? `?text=${encodeURIComponent(text)}` : ""
  }`;
