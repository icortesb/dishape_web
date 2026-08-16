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
    blog: "Blog",
    contact: "Contact",
    audit: "Audit",
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
      // Written for someone arriving from an audit report: it is the visitor's
      // message, not ours, and it stays editable. It names the site it is
      // about and leaves the report link; it does not list findings, which are
      // already in the report. Neutral about the outcome — a clean report ends
      // up here too. {url} and {report} are filled by src/scripts/contact.ts.
      auditPrefill:
        "I ran the audit on {url} and I'd like to talk about what the report says:\n{report}\n\n",
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
  blog: {
    metaTitle: "Blog | dishape",
    metaDescription:
      "Articles on web development, online stores, performance and AI applied to business. Clear answers to what's worth knowing before starting a project.",
    eyebrow: "BLOG",
    title: "Notes on web, business and conversion",
    intro:
      "What's worth knowing before starting a project: pricing, technical decisions and why some things move sales and others don't.",
    readingSuffix: "read",
    back: "Back to blog",
    postedOn: "Published on",
    relatedTitle: "Related service",
    ctaTitle: "Have a project in mind?",
    ctaBody:
      "With a short description, I'll send back a clear proposal within 24 hours.",
    ctaButton: "Let's talk about your project",
  },
  consent: {
    message:
      "We use cookies to measure traffic and improve your experience. You can accept or reject them.",
    accept: "Accept",
    reject: "Reject",
  },
  audit: {
    meta: {
      // 57 characters: this string is the landing's <title>, and the tool warns
      // any visitor whose title runs past TITLE_MAX (60). Pinned by
      // tests/unit/i18n-audit.spec.ts against the constant itself.
      title: "Free website audit | Your site's SEO in seconds | dishape",
      description:
        "Paste your site's URL and get a technical diagnosis: SEO, performance and how your site looks when shared. Free, no signup.",
      // schema.org WebApplication.name — the product's name, not the SEO
      // title. The pipe-delimited title above is written for a SERP snippet;
      // as a schema name it reads as three fragments glued together.
      appName: "dishape Website Audit",
    },
    hero: {
      eyebrow: "FREE TOOL",
      title: "Find out what's slowing your site down.",
      subtitle:
        "A technical diagnosis of your site in under a minute: what Google sees, how fast it loads and what it looks like when someone shares the link. No signup, no cost.",
      // Accessible name for the URL field; the design shows only a placeholder.
      label: "Your site's address",
      placeholder: "yoursite.com",
      submit: "Analyze my site",
      analyzing: "Analyzing…",
      disclaimer: "We analyze the page you enter, not the whole site.",
    },
    whatWeCheck: {
      // {count} comes from the check registry, never from a typed number — and
      // the registry holds SEO and sharing only. Performance is measured by
      // PageSpeed, not counted, so the eyebrow names it apart instead of
      // letting the number appear to cover the third card below it.
      eyebrow: "{count} CHECKS + PERFORMANCE",
      title: "What the audit looks at.",
      // Deliberately not report.categoryIntro: those say "this page", meaning
      // the audited page. On the landing nothing has been audited yet, so the
      // same sentence would point at nothing.
      cards: {
        seo: "Title, meta description, canonical, headings, sitemap, hreflang and HTTPS: what Google needs in order to understand a page.",
        social:
          "Open Graph, Twitter Card and favicon: what decides how a link looks when someone pastes it into WhatsApp or LinkedIn.",
        perf: "Load speed measured with Google's PageSpeed Insights API, with lab data plus real-user data when the site has enough traffic.",
      },
    },
    errors: {
      url_invalid: "That address doesn't look valid. Try something like yoursite.com",
      url_blocked: "We can't analyze internal or private addresses.",
      url_unreachable: "We couldn't reach that page. Is it online?",
      not_html: "That address doesn't return a web page.",
      too_large: "The page is too heavy to analyze.",
      rate_limited: "You've reached the analysis limit. Try again in a while.",
      server: "Something failed on our end. Try again.",
    },
    report: {
      auditedOn: "Audited on",
      urgent: "Most urgent",
      urgentEmpty: "We didn't find any critical problems on this page.",
      categories: {
        seo: "Technical SEO",
        social: "When shared",
        perf: "Performance",
      },
      categoryIntro: {
        seo: "What Google finds when it visits this page.",
        social: "What someone sees when they share the link on WhatsApp or LinkedIn.",
        perf: "How fast it loads, measured by Google.",
      },
      passedCount: "{passed} of {total} checks",
      showPassed: "Show the {count} checks that passed",
      // A category with a single passing check is the boundary case, not an
      // edge: the <details> renders as soon as there is one
      // (FindingList.astro:32). The singular carries no {count}.
      showPassedOne: "Show the check that passed",
      status: {
        pass: "Good",
        warn: "Needs work",
        fail: "Problem",
        // Not a verdict: we could not determine this one either way.
        na: "Undetermined",
      },
      severity: { critical: "Critical", important: "Important", minor: "Minor" },
      found: "What we found",
      why: "Why it matters",
      fix: "How to fix it",
      measuring: "Measuring performance with Google…",
      measuringNote: "This takes a few seconds.",
      vitalsUnavailable:
        "We couldn't measure performance right now. The rest of the diagnosis still stands.",
      // Caption for the score card, where the long sentence does not fit.
      vitalsUnavailableShort: "Could not be measured",
      fieldTitle: "Real user data",
      labTitle: "Lab measurement",
      weight: "Weight",
      noFieldData:
        "This site doesn't have enough traffic for Google to report real user data.",
      sharePreview: "How your link looks when shared",
      sharePreviewBroken:
        "This page has no image to share, so the link shows up empty.",
      copyLink: "Copy report link",
      copied: "Link copied",
      reAudit: "Analyze another site",
      expiredTitle: "This report is no longer available.",
      expiredBody:
        "Reports are kept for 30 days. After that the link stops working. Running the analysis again takes under a minute.",
    },
    cta: {
      title: "We found {count} things to fix on this page.",
      // A single problem is the report of an almost-clean site, which is the
      // one a prospect is most likely to be reading: "1 things" there reads as
      // a broken template.
      titleOne: "We found one thing to fix on this page.",
      titleClean: "This page is in good shape.",
      body:
        "Each of these points has a concrete fix. If you want us to handle them, get in touch and we'll tell you what's involved.",
      bodyOne:
        "This point has a concrete fix. If you want us to handle it, get in touch and we'll tell you what's involved.",
      bodyClean:
        "If you're starting a new project or want to take this further, let's talk.",
      button: "I want this fixed",
    },
    faq: {
      title: "Frequently asked questions",
      items: [
        [
          "Is it really free?",
          "Yes. We don't ask for an email or signup, and the full report shows up instantly.",
        ],
        [
          "What exactly does it check?",
          // The number has to cover exactly what the check registry covers: SEO
          // and sharing. Performance is measured with PageSpeed and is not
          // counted, which is what the whatWeCheck eyebrow says too.
          "About twenty technical checks on the page you enter: technical SEO (what Google understands) and how the link looks when shared. Performance is measured separately, with Google's PageSpeed Insights API, and is not part of that count.",
        ],
        [
          "Does it check my whole site?",
          "No. It checks the exact URL you enter. If you want to review several pages, run the analysis once per page.",
        ],
        [
          "Is the performance data reliable?",
          "It comes directly from Google's PageSpeed Insights API, the same one PageSpeed uses. You can verify any number by running the official tool.",
        ],
        [
          "Do you store my site or my data?",
          "We store the report for 30 days so you can share the link. We don't ask for personal data.",
        ],
      ] as [string, string][],
    },
    checks: {
      "seo.title.present": {
        name: "Page title",
        why: "It's the text Google shows as the headline in search results. Without a title, the search engine makes one up from whatever it finds on the page.",
        found: "The page has no <title> tag.",
        fix: "Add a descriptive, unique <title> in the <head>, including the term you want to be found for.",
      },
      "seo.title.length": {
        name: "Title length",
        why: "Google truncates long titles and discounts very short ones as uninformative. Between 30 and 60 characters shows in full.",
        found: "The title is {actual} characters long.",
        // warn fires below TITLE_MIN, so a one-character title lands here:
        // "1 characters" is reachable.
        foundOne: "The title is a single character long.",
        foundEmpty: "This page has no title, so there's no length to measure.",
        // "adjust the title" pointed at something the check had determined does
        // not exist — its "na" branch, where there is no title. "na" is dropped
        // upstream and never renders (score.ts:55 filters it out of the ranked
        // findings, FindingList.astro:17 refilters to fail|warn), so only the
        // warn branch reaches a visitor. A `fix` is still held to being true on
        // every non-pass branch: the rule is stricter than what renders, on
        // purpose, and the requirement form satisfies it.
        fix: "The title needs to be 30–60 characters, with the most important part first.",
      },
      "seo.description.present": {
        name: "Meta description",
        why: "It's the summary that appears below the title in search results. It doesn't affect ranking, but it does affect how many people click.",
        found: "The page has no meta description.",
        fix: "Add <meta name=\"description\" content=\"…\"> with a concrete summary of what the page offers.",
      },
      "seo.description.length": {
        name: "Meta description length",
        why: "Google cuts long descriptions off mid-sentence. Between 70 and 160 characters shows in full.",
        found: "The meta description is {actual} characters long.",
        // Same as seo.title.length: warn covers everything below DESC_MIN,
        // a single character included.
        foundOne: "The meta description is a single character long.",
        foundEmpty: "This page has no meta description, so there's no length to measure.",
        // Same as seo.title.length: the "na" branch has no description to
        // rewrite, and "na" never renders (score.ts:55, FindingList.astro:17).
        // The requirement form holds on it anyway, which is the rule.
        fix: "The meta description needs to be 70 to 160 characters.",
      },
      "seo.h1.unique": {
        name: "Single main heading",
        why: "The H1 tells the search engine what the page is about. With several or none, that signal gets diluted.",
        found: "The page has {actual} H1 headings.",
        fix: "Keep exactly one H1 per page, with the main topic. Everything else goes as H2 or H3.",
      },
      "seo.headings.hierarchy": {
        name: "Heading hierarchy",
        why: "Headings form the page's outline. Skipping levels breaks that structure for search engines and screen readers.",
        found: "There's a jump from {from} to {to} without passing through the level in between.",
        foundEmpty: "This page has no headings to evaluate.",
        fix: "Use headings in order, without skipping levels. If the jump is for visual reasons, change the size with CSS, not the level.",
      },
      "seo.canonical": {
        name: "Canonical URL",
        why: "It tells Google which version of the page is the official one. Without it, variants with parameters compete against each other and split the signal.",
        found: "The declared canonical is {found}.",
        foundEmpty: "This page does not declare a canonical URL of its own.",
        // "Add <link rel=canonical>" was false on two of the three displayed
        // branches: the cross-host warn and the unparseable-href fail both have
        // the tag. What is wrong there is where it points, not that it is absent.
        fix: "The <link rel=\"canonical\"> must point to the absolute, definitive URL of this same page.",
      },
      "seo.html.lang": {
        name: "Declared language",
        why: "Without the lang attribute, search engines guess the language and screen readers mispronounce it.",
        found: "The <html> tag does not declare a lang attribute.",
        fix: "Add the lang attribute to the <html> tag, for example <html lang=\"en\">.",
      },
      "seo.robots.txt": {
        name: "robots.txt file",
        why: "It's the first thing a search engine checks on arrival. Without it there's no blocking, but also no way to point to the sitemap.",
        found: "We couldn't reach /robots.txt.",
        // The only displayed branch is robotsTxt === null, which parse.ts sets
        // for a transport failure and for a non-2xx alike — so "publish a
        // robots.txt" asserts an absence we never observed. Matches the Spanish.
        fix: "The domain root must serve a robots.txt; a minimal one is enough, and it is where the sitemap location is declared.",
      },
      "seo.sitemap": {
        name: "Sitemap",
        why: "It gives Google the full list of pages to index, instead of leaving it to discover them by following links.",
        found: "We couldn't find an accessible sitemap.",
        // On the "na" probe-failure branch nothing was determined about the
        // sitemap, so "generate a sitemap.xml" would assert it is missing.
        // "na" never renders (score.ts:55, FindingList.astro:17); the
        // requirement is written to be true there regardless.
        fix: "The sitemap.xml must be generated and declared in robots.txt, with the line Sitemap: https://yourdomain.com/sitemap.xml",
      },
      "seo.noindex": {
        name: "Indexable page",
        why: "A noindex directive asks Google to exclude the page from results. On a public page it's almost always a configuration mistake.",
        found: "The page is declared noindex ({source}).",
        evidenceLabels: {
          meta: "via the robots tag in the <head>",
          header: "via X-Robots-Tag on the server response",
        },
        fix: "Remove the noindex directive from the meta robots tag or the X-Robots-Tag header. It's usually left over from a staging environment.",
      },
      "seo.hreflang": {
        name: "Hreflang tags",
        why: "On a site with multiple languages, they indicate which version to show each user. An incomplete set makes Google ignore them entirely.",
        found: "We found {count} hreflang tags with a configuration problem.",
        // Both warn branches reach 1: "no-self" counts every entry, and one
        // alternate with no self-reference is the ordinary shape of a
        // half-configured bilingual site; "invalid-code" counts the invalid
        // ones, at least one by its own guard.
        foundOne: "We found one hreflang tag with a configuration problem.",
        foundEmpty: "This page does not declare hreflang tags.",
        fix: "Each version must list all alternatives, including itself, with valid language codes.",
      },
      "seo.https": {
        name: "Secure connection",
        why: "Browsers flag any site without HTTPS as \"not secure\", and Google uses it as a ranking signal.",
        found: "The page is served over HTTP, unencrypted.",
        // The check only observes that this URL came over HTTP; whether the
        // site has a certificate at all was never determined.
        fix: "The site must be served over HTTPS, with a TLS certificate. With Let's Encrypt it's free and renews itself.",
      },
      "seo.http.redirect": {
        name: "Redirect to HTTPS",
        why: "If the HTTP version still responds, there are two copies of every page and traffic splits between them.",
        found: "http:// does not redirect to https://",
        // On the "na" branch the probe never resolved and no redirect was
        // observed either way. "na" never renders (score.ts:55,
        // FindingList.astro:17); the requirement is true on it regardless.
        fix: "All HTTP traffic must redirect to HTTPS with a permanent 301.",
      },
      "social.og.title": {
        name: "Share title",
        why: "It's the headline that shows up when someone pastes the link into WhatsApp, LinkedIn or Slack. Without it, each platform improvises.",
        found: "No og:title tag.",
        fix: "Add <meta property=\"og:title\" content=\"…\"> with the title you want to show when shared.",
      },
      "social.og.description": {
        name: "Share description",
        why: "It's the text below the headline in the link's preview card. It's what decides whether someone clicks or scrolls past.",
        found: "No og:description tag.",
        fix: "Add <meta property=\"og:description\"> with a short, concrete summary.",
      },
      "social.og.image": {
        name: "Share image",
        why: "A link without an image takes up a fraction of the space in the feed and gets far fewer clicks than one with a visual card.",
        // The whole sentence lives in the label: a shared frame like "has a
        // problem: {reason}" asserts a defect before the branch is known, which
        // is false for "declares none" and dishonest for the unverified case.
        found: "{reason}",
        evidenceLabels: {
          missing: "This page declares no share image.",
          unreachable: "The declared image does not respond.",
          relative: "The declared image URL is not absolute.",
          unverified: "We could not confirm the declared image responds.",
        },
        // On the "relative" and "unverified" branches an og:image IS declared,
        // so "publish an image and declare it" contradicts what we found.
        fix: "The share image must be 1200×630 px and declared in og:image with the full absolute URL, including https://",
      },
      "social.twitter.card": {
        name: "X/Twitter card",
        why: "It defines the preview format on X. Without it the link shows in the smallest format available.",
        found: "No twitter:card tag.",
        fix: "Add <meta name=\"twitter:card\" content=\"summary_large_image\"> in the <head>.",
      },
      "social.jsonld": {
        name: "Structured data",
        why: "It tells Google what this page is in a format it understands. It enables rich results and is increasingly important for AI assistants to cite the site.",
        found: "{reason}",
        evidenceLabels: {
          missing: "This page includes no structured data.",
          unparseable: "The declared JSON-LD block is not valid JSON.",
          "no-type": "The declared JSON-LD block states no @type.",
        },
        // "Add a JSON-LD block" was false on both warn branches: social.ts:84
        // gates on hasBlocks before the unparseable and no-type cases, so a
        // <script type="application/ld+json"> demonstrably exists there. Same
        // reasoning as seo.canonical above — what is wrong is the block's
        // content, not its absence — so the requirement names both properties
        // the check actually tests: valid JSON, and a declared @type.
        fix: "The page needs a valid JSON-LD block with the @type that applies (Organization, Product, Article, LocalBusiness…).",
      },
      "social.favicon": {
        name: "Favicon",
        why: "It's the tab icon. Without it, the site becomes hard to find among twenty open tabs.",
        found: "No icon declared.",
        fix: "Add <link rel=\"icon\" href=\"/favicon.svg\"> in the <head>.",
      },
    },
  },
} as const;
