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
    more: "Dedicated pages:",
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
    sectionsTitle: "Sections",
    servicesTitle: "Services",
  },
  servicePages: {
    web: {
      slug: "web-development",
      navLabel: "Web development",
      metaTitle: "Custom web development for businesses | dishape",
      metaDescription:
        "Custom websites and web apps, designed, built and maintained by one person. Your own code, fast and built to turn visitors into customers.",
      eyebrow: "WEB DEVELOPMENT",
      h1: "Custom web development, from the first line of code to deploy.",
      subtitle:
        "Websites and apps built for your business, not adapted from a template. The same person designs them, builds them, ships them and maintains them.",
      ctaPrimary: "Let's talk about your project",
      ctaSecondary: "See everything I do",
      back: "Back to home",
      includes: {
        eyebrow: "WHAT'S INCLUDED",
        title: "Everything the project needs, in one place",
        intro:
          "From the design to the server it runs on. One person is accountable for how every piece fits together.",
        items: [
          ["pen-tool", "Interface design", "Screens built to guide the user toward the action that matters, not just to look good."],
          ["code", "Your own code", "Apps you can maintain and extend without rewriting from scratch as the business grows."],
          ["gauge", "Performance from the start", "Core Web Vitals in the green and low load times, solved during development, not after."],
          ["search", "Technical SEO", "Structure, metadata and speed ready for Google to understand and index the site."],
          ["smartphone", "Truly responsive", "The site works just as well on mobile, where most customers land first."],
          ["server", "Deploy & maintenance", "Going live, hosting and support after launch. The site isn't abandoned."],
        ],
      },
      why: {
        eyebrow: "WHY IT MATTERS",
        title: "Speed isn't a technical detail, it's conversion",
        body:
          "53% of visitors abandon a site that takes over 3 seconds to load, and every 0.1s of speed gained can add up to 8% more conversions. That's why performance is the first thing I solve, before any other layer.",
        points: [
          ["A single point of contact", "You deal directly with whoever designs and builds it, no middlemen translating what the business needs."],
          ["No surprises", "A fixed price agreed before starting and partial deliveries to see progress at every stage."],
          ["Built to grow", "The architecture is designed so adding features later doesn't mean rebuilding everything."],
        ],
      },
    },
    ecommerce: {
      slug: "online-store",
      navLabel: "Online store",
      metaTitle: "Custom online store development | dishape",
      metaDescription:
        "Your own online store, fast and ready to sell. Stripe and MercadoPago payments, integrations and analytics, built and maintained by one person.",
      eyebrow: "ONLINE STORE",
      h1: "Your own online store, ready to sell without friction.",
      subtitle:
        "Your own e-commerce, not a rental on a platform that charges per sale. Fast, wired to your payment methods and built so the purchase actually closes.",
      ctaPrimary: "Let's talk about your project",
      ctaSecondary: "See everything I do",
      back: "Back to home",
      includes: {
        eyebrow: "WHAT'S INCLUDED",
        title: "From the storefront to checkout, all connected",
        intro:
          "A store isn't just a catalog: it's payments, stock, shipping and data working together without anything getting stuck.",
        items: [
          ["credit-card", "Integrated payments", "Stripe and MercadoPago wired in to charge without redirects that lose the sale."],
          ["package", "Catalog & stock", "Product, variant and inventory management adapted to how your business works."],
          ["gauge", "Fast loading", "Every tenth counts: a slow store is a lost sale before it starts."],
          ["smartphone", "Buying from mobile", "Most people buy from their phone. The checkout works flawlessly on any screen."],
          ["bar-chart-3", "Sales analytics", "Real event tracking to know where the purchase drops off and where to optimize."],
          ["plug", "Integrations", "Invoicing, shipping, CRM and automations wired to the systems you already use."],
        ],
      },
      why: {
        eyebrow: "WHY IT MATTERS",
        title: "Your own store doesn't charge you a fee on every sale",
        body:
          "Rental platforms take a cut of every transaction and tie you to their rules. A custom store is yours: the margin stays in your business and so do the decisions.",
        points: [
          ["No fee per sale", "You pay for the build once, not a percentage of every purchase forever."],
          ["Full control", "Design, rules and data are yours, with no dependence on what a closed platform allows."],
          ["Built to convert", "Every checkout step designed to reduce abandonment, with data to keep improving."],
        ],
      },
    },
    ai: {
      slug: "ai-chatbots",
      navLabel: "AI chatbots",
      metaTitle: "AI chatbots for businesses | dishape",
      metaDescription:
        "AI chatbots and assistants trained on your business's information. Around-the-clock service, wired to your tools, applied to concrete problems.",
      eyebrow: "AI CHATBOTS",
      h1: "AI applied to your business, not to the hype.",
      subtitle:
        "Chatbots and assistants trained on your own information, answering around the clock in your tone and handing off to a person when needed.",
      ctaPrimary: "Let's talk about your project",
      ctaSecondary: "See everything I do",
      back: "Back to home",
      includes: {
        eyebrow: "WHAT'S INCLUDED",
        title: "Service that never sleeps, trained on your business",
        intro:
          "Not a canned bot: an assistant that knows your information, speaks in your tone and knows when to hand off to a person.",
        items: [
          ["bot", "Custom chatbots", "Automated service trained on the business's real information, not generic answers."],
          ["clock", "Available 24/7", "Answers questions at any hour, so no opportunity is lost to a schedule."],
          ["database", "Your own data (RAG)", "Search and answers over your documents, with automatic analysis and enrichment."],
          ["share-2", "Agents & MCP", "AI wired to your tools via the Model Context Protocol, so it acts and doesn't just answer."],
          ["workflow", "Hands off when needed", "Spots when a query needs a person and passes the full context along."],
          ["bar-chart-3", "Measurement", "A record of what users ask, to improve service with data."],
        ],
      },
      why: {
        eyebrow: "WHY IT MATTERS",
        title: "AI helps when it solves a real problem, not when it's trendy",
        body:
          "Put where it belongs, AI cuts manual work and improves service: instant answers, processes that run on their own and decisions backed by data. Put as decoration, it just adds noise.",
        points: [
          ["On a concrete problem", "Problem first, tool second. AI goes only where there's something real to solve."],
          ["Integrated, not isolated", "Wired to the tools and data you already use, so it acts and doesn't just reply."],
          ["In your voice", "Trained on your information and tone, so the service feels part of the business."],
        ],
      },
    },
    automation: {
      slug: "automation",
      navLabel: "Automation",
      metaTitle: "Business process automation | dishape",
      metaDescription:
        "Automation of repetitive tasks and workflows: classify, reply, load and move data with no manual work. Wired to the tools you already use.",
      eyebrow: "AUTOMATION",
      h1: "Leave the repetitive tasks to the software.",
      subtitle:
        "Workflows that take on the manual, repetitive work: classifying, replying, loading and moving data between your systems, with no one doing it by hand.",
      ctaPrimary: "Let's talk about your project",
      ctaSecondary: "See everything I do",
      back: "Back to home",
      includes: {
        eyebrow: "WHAT'S INCLUDED",
        title: "Less manual work, fewer errors",
        intro:
          "Anything someone does by hand repetitively today is a candidate for automation: time that goes back to the business.",
        items: [
          ["workflow", "Custom workflows", "Automations designed around how your business works, not rigid templates."],
          ["plug", "Systems talking to each other", "Your tools, CRMs and APIs connected, with no copy-pasting data."],
          ["mail", "Automatic responses", "Messages, notifications and follow-ups that go out on their own at the right moment."],
          ["database", "Loading & moving data", "Information classified, recorded and moved between systems with no manual work."],
          ["file-text", "Automatic reports", "Reports generated and sent on their own, ready for decisions."],
          ["shield-check", "Fewer errors", "What software does doesn't get forgotten or mistyped. Fewer errors, less rework."],
        ],
      },
      why: {
        eyebrow: "WHY IT MATTERS",
        title: "Time spent on repetitive tasks is time that doesn't come back",
        body:
          "Every manual process costs hours and opens the door to errors. Automating it frees that time for what actually moves the business, and lowers the cost of each operation.",
        points: [
          ["Time recovered", "The hours lost on repetitive tasks go back to the work that matters."],
          ["Fewer errors", "Software doesn't get tired or distracted: the same task comes out the same every time."],
          ["Scales without added cost", "More volume doesn't mean more manual work or more people for the same thing."],
        ],
      },
    },
  },
  consent: {
    message:
      "We use cookies to measure traffic and improve your experience. You can accept or reject them.",
    accept: "Accept",
    reject: "Reject",
  },
} as const;
