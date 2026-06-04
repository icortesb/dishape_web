export const en = {
  meta: {
    title: "Custom web design & development | dishape",
    description:
      "The same person designs, builds, ships and maintains your website. Design, development, infrastructure and analytics in one place, with no vendors to coordinate.",
  },
  nav: {
    services: "Services",
    ai: "AI",
    process: "Process",
    stack: "Stack",
    benefits: "Benefits",
    contact: "Contact",
    cta: "Let's talk",
    book: "Book 10 min",
  },
  hero: {
    badge: "AVAILABLE FOR NEW PROJECTS",
    title: "The same person who designs your website builds it, ships it and maintains it.",
    subtitle:
      "Design, development, infrastructure and analytics in one place. No splitting the project across vendors, no paying each middleman's markup.",
    ctaPrimary: "Let's talk about your project",
    ctaSecondary: "See services",
    panelFile: "flow.ts",
    panelComment: "// the pieces I handle on every project",
    flow: [
      ["design", "UI/UX interfaces"],
      ["development", "frontend + backend"],
      ["data", "SQL / NoSQL"],
      ["infra", "deploy · hosting · email"],
      ["analytics", "GA4 / GTM"],
      ["conversion", "SEO · CRO · performance"],
    ],
  },
  trust: {
    // Industry benchmarks with sources — used as a diagnostic lens, not as dishape's own results.
    // Intentional (authority by diagnosis): we are NOT presenting case studies or testimonials.
    caption: "What's at stake when a site is built badly",
    metrics: [
      { prefix: "", count: 53, suffix: "%", label: "abandon a site that takes over 3 s to load" },
      { prefix: "+", count: 8, suffix: "%", label: "more conversions for every 0.1 s of speed gained" },
      { prefix: "", count: 68, suffix: "%", label: "of online experiences begin with a search engine" },
      { prefix: "−", count: 24, suffix: "%", label: "lower abandonment when Core Web Vitals pass" },
    ],
    stance:
      "That's why performance is the first thing I solve on every project, before any other layer. It's the foundation everything else sits on.",
    sources: "Sources: Google · Deloitte · BrightEdge",
  },
  value: {
    eyebrow: "01 / ALL IN ONE",
    title: "One point of contact for the whole project.",
    intro:
      "Coordinating a designer, a developer, a sysadmin and an agency separately costs time, and each one's markup adds up on the invoice. Here, one person handles every piece and is accountable for how they fit together.",
    items: [
      ["user", "A single point of contact", "You deal directly with whoever designs, builds and ships the project. No middlemen translating what the business needs."],
      ["timer", "Less friction", "No cross-team meetings, no waiting between vendors. The project moves in one direction."],
      ["wallet", "Lower cost", "One person instead of three or four vendors. The budget goes into the product, not into coordination overhead."],
      ["layers", "Decisions with judgment", "Every technical decision is made with the full picture: design, performance, security and scalability aligned from the start."],
    ],
  },
  services: {
    eyebrow: "02 / SERVICES",
    title: "Services",
    intro: "Everything a project needs to run well and turn visitors into customers.",
    items: [
      ["pen-tool", "UI/UX Design", "Tidy interfaces where every element guides the user toward the action that matters: buy, contact, sign up."],
      ["code", "Custom development", "Apps built for the business, not adapted from a template. Your own code, maintainable and extendable without rewriting from scratch."],
      ["database", "Databases", "Data modelling and optimization designed from the start so queries stay fast as the volume grows."],
      ["plug", "Third-party integrations", "Payment gateways, CRMs, APIs and automations wired into the systems the business already uses."],
      ["server", "Infrastructure & hosting", "Servers, domains, SSL certificates and automated deployment. The part almost nobody sees, and the one that decides whether the site stays up under load."],
      ["bar-chart-3", "Analytics & conversion", "Tracking real events to know what visitors do and where they drop off. Without data, optimizing is guessing."],
    ],
  },
  ai: {
    eyebrow: "03 / AI & AUTOMATION",
    title: "AI applied to concrete problems, not to hype",
    intro:
      "Artificial intelligence put where it cuts manual work or improves service: around-the-clock answers, processes that run on their own and decisions backed by data. Only where there's a real problem to solve.",
    items: [
      ["bot", "Chatbots & assistants", "Around-the-clock service with AI trained on the business's own information, answering in its tone and handing off to a person when needed."],
      ["workflow", "Process automation", "Workflows that take over the repetitive tasks: classify, reply, load and move data with no manual work."],
      ["share-2", "Agents & MCP", "AI wired into the business's tools and data via the Model Context Protocol, so it carries out actions and doesn't just answer."],
      ["database", "Smart data (RAG)", "Search and answers over the business's own documents, with automatic analysis and enrichment."],
    ],
  },
  process: {
    eyebrow: "04 / PROCESS",
    title: "How I work",
    intro: "A clear, predictable process, with a fixed price agreed before starting.",
    steps: [
      ["1", "Defining goals", "First I understand the business, its users and the result it's after. Scope, priorities and success metrics follow from that."],
      ["2", "Design & technical proposal", "Interface design, architecture, and a proposal with timelines, deliverables and a fixed price."],
      ["3", "Development & integrations", "The product is built in parts, with partial deliveries. At every stage there's something working to see, not only at the end."],
      ["4", "Launch & optimization", "Going live, monitoring, analytics and improvements backed by real usage data."],
    ],
  },
  stack: {
    eyebrow: "05 / STACK",
    title: "What I work with",
    intro:
      "Every layer chosen for a reason, not for hype. This is what I run in production.",
    groups: [
      ["Frontend", ["React", "Next.js", "TypeScript", "Tailwind CSS", "Astro"]],
      ["Backend", ["Node.js", "Express", "PHP", "Laravel", "REST APIs"]],
      ["Databases", ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Firebase", "Supabase"]],
      ["Infrastructure / DevOps", ["Vercel", "AWS", "VPS", "Docker", "CI/CD", "Nginx", "Cloudflare"]],
      ["Analytics & Payments", ["Google Analytics", "GTM", "Search Console", "Stripe", "MercadoPago", "Mailing"]],
    ],
  },
  results: {
    eyebrow: "06 / RESULTS",
    title: "Benefits for your business",
    intro:
      "The part the business actually feels: the site loads, it shows up on Google, and the sale closes without friction.",
    cta: "Let's talk about your project",
    items: [
      ["gauge", "Real speed", "Core Web Vitals in the green and low load times. Every tenth of a second counts: it lifts conversion and your ranking on Google."],
      ["search", "Technical SEO from day one", "Structure, metadata and performance handled from the start, when fixing them is cheap and not a rebuild."],
      ["shield-check", "Security & backups", "HTTPS, attack protection and automatic backups, so a single incident doesn't take the business down with it."],
      ["credit-card", "Payments & automation", "Stripe, MercadoPago and automated flows that charge, invoice and record with no manual steps to get stuck on."],
      ["wrench", "Support & maintenance", "Updates, monitoring and support after launch. The site isn't abandoned the day it goes live."],
      ["smartphone", "Flawless on mobile", "Where most customers land first. The site looks and works right on any screen, with no broken version."],
    ],
  },
  contact: {
    eyebrow: "07 / CONTACT",
    title: "Ready to start your project?",
    intro:
      "With a short description of the project, I'll send back a clear proposal within 24 hours.",
    form: {
      name: "Name *",
      namePh: "Your name",
      email: "Email *",
      emailPh: "you@email.com",
      company: "Company (optional)",
      companyPh: "Your company name",
      message: "Message *",
      messagePh: "A short description of the project: what you need and your timeline.",
      submit: "Send message",
      sending: "Sending…",
      success: "Message sent. I'll reply within 24 hours.",
      error: "The message couldn't be sent. You can also reach me on WhatsApp.",
    },
    asideTitle: "Rather talk directly?",
    asideBody:
      "For a more direct conversation, or if the project is already defined, any of these channels works.",
    calendlyLabel: "Video call",
    calendlyValue: "Book a 10-min call",
    emailLabel: "Email",
    whatsappLabel: "WhatsApp",
    whatsappPrefill: "Hi! I'd like to talk about a project.",
    responseTime: "Reply within 24 hours",
  },
  footer: {
    tagline: "Web design, development and infrastructure from one person.",
    rights: "All rights reserved.",
  },
  consent: {
    message:
      "We use cookies to measure traffic and improve your experience. You can accept or reject them.",
    accept: "Accept",
    reject: "Reject",
  },
} as const;
