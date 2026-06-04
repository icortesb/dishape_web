export const es = {
  meta: {
    title: "Diseño y desarrollo web a medida | dishape",
    description:
      "La misma persona diseña, programa, publica y mantiene tu web. Diseño, desarrollo, infraestructura y analítica en un solo lugar, sin coordinar proveedores.",
  },
  nav: {
    services: "Servicios",
    ai: "IA",
    process: "Proceso",
    stack: "Stack",
    benefits: "Beneficios",
    contact: "Contacto",
    cta: "Hablemos",
    book: "Agendar 10 min",
  },
  hero: {
    badge: "DISPONIBLE PARA NUEVOS PROYECTOS",
    title:
      "La misma persona que diseña tu web la programa, la publica y la mantiene.",
    subtitle:
      "Diseño, desarrollo, infraestructura y analítica en un solo lugar. Sin repartir el proyecto entre varios proveedores ni pagar el margen de cada intermediario.",
    ctaPrimary: "Hablemos de tu proyecto",
    ctaSecondary: "Ver servicios",
    panelFile: "flujo.ts",
    panelComment: "// las piezas que resuelvo en cada proyecto",
    flow: [
      ["diseño", "interfaces UI/UX"],
      ["desarrollo", "frontend + backend"],
      ["datos", "SQL / NoSQL"],
      ["infra", "deploy · hosting · mails"],
      ["analítica", "GA4 / GTM"],
      ["conversión", "SEO · CRO · performance"],
    ],
  },
  trust: {
    // Datos de industria con fuente — usados como lente diagnóstica, no como resultados propios.
    // Es intencional (autoridad por diagnóstico): no presentamos casos ni testimonios.
    caption: "Lo que está en juego cuando un sitio está mal hecho",
    metrics: [
      { prefix: "", count: 53, suffix: "%", label: "abandona un sitio que tarda más de 3 s en cargar" },
      { prefix: "+", count: 8, suffix: "%", label: "más conversión por cada 0,1 s de mejora en velocidad" },
      { prefix: "", count: 68, suffix: "%", label: "de las experiencias online empiezan en un buscador" },
      { prefix: "−", count: 24, suffix: "%", label: "menos abandono al cumplir Core Web Vitals" },
    ],
    stance:
      "Por eso en cada proyecto el rendimiento es lo primero que resuelvo, antes que cualquier otra capa. Es la base sobre la que se apoya todo lo demás.",
    sources: "Fuentes: Google · Deloitte · BrightEdge",
  },
  value: {
    eyebrow: "01 / TODO EN UNO",
    title: "Un solo interlocutor para todo el proyecto.",
    intro:
      "Coordinar diseñador, programador, administrador de servidores y agencia por separado cuesta tiempo, y el margen de cada uno se suma a la factura. Acá hay una sola persona que domina todas las piezas y responde por cómo encajan entre sí.",
    items: [
      ["user", "Un único interlocutor", "El trato es directo con quien diseña, programa y publica el proyecto. Sin intermediarios que traduzcan lo que el negocio necesita."],
      ["timer", "Menos fricción", "Sin reuniones entre equipos ni esperas entre proveedores. El proyecto avanza en una sola dirección."],
      ["wallet", "Menos costo", "Una sola persona en lugar de tres o cuatro proveedores. El presupuesto va al producto, no a coordinar el overhead."],
      ["layers", "Decisiones con criterio", "Cada decisión técnica se toma con el panorama completo: diseño, rendimiento, seguridad y escalabilidad alineados desde el inicio."],
    ],
  },
  services: {
    eyebrow: "02 / SERVICIOS",
    title: "Servicios",
    intro: "Todo lo que un proyecto necesita para funcionar bien y convertir visitas en clientes.",
    items: [
      ["pen-tool", "Diseño UI/UX", "Interfaces ordenadas, donde cada elemento guía al usuario hacia la acción que importa: comprar, contactar, registrarse."],
      ["code", "Desarrollo a medida", "Aplicaciones hechas para el negocio, no adaptadas de una plantilla. Código propio que se puede mantener y ampliar sin reescribir desde cero."],
      ["database", "Bases de datos", "Modelado y optimización de datos pensados desde el inicio para que las consultas sigan siendo rápidas cuando el volumen crezca."],
      ["plug", "Integraciones con terceros", "Pasarelas de pago, CRMs, APIs y automatizaciones conectadas a los sistemas que el negocio ya usa."],
      ["server", "Infraestructura y hosting", "Servidores, dominios, certificados SSL y despliegue automático. La parte que casi nadie ve y que define si el sitio se cae o aguanta."],
      ["bar-chart-3", "Analítica y conversión", "Medición de eventos reales para saber qué hacen los visitantes y dónde se van. Sin datos, optimizar es adivinar."],
    ],
  },
  ai: {
    eyebrow: "03 / IA & AUTOMATIZACIÓN",
    title: "IA aplicada a problemas concretos, no a la moda",
    intro:
      "Inteligencia artificial puesta donde reduce trabajo manual o mejora la atención: respuestas a toda hora, procesos que corren solos y decisiones apoyadas en datos. Solo donde hay un problema real que resolver.",
    items: [
      ["bot", "Chatbots y asistentes", "Atención a toda hora con IA entrenada sobre la información del negocio, que responde con su tono y deriva a una persona cuando hace falta."],
      ["workflow", "Automatización de procesos", "Flujos que se encargan de las tareas repetitivas: clasificar, responder, cargar y mover datos sin intervención manual."],
      ["share-2", "Agentes y MCP", "La IA conectada a las herramientas y los datos del negocio vía Model Context Protocol, para que ejecute acciones y no solo responda."],
      ["database", "Datos inteligentes (RAG)", "Búsqueda y respuestas sobre los documentos propios del negocio, con análisis y enriquecimiento automático."],
    ],
  },
  process: {
    eyebrow: "04 / PROCESO",
    title: "Cómo trabajo",
    intro: "Un proceso claro y predecible, con un precio cerrado antes de empezar.",
    steps: [
      ["1", "Definición de objetivos", "Primero entiendo el negocio, sus usuarios y qué resultado se busca. De ahí salen el alcance, las prioridades y las métricas de éxito."],
      ["2", "Diseño y propuesta técnica", "Diseño de la interfaz, definición de la arquitectura y una propuesta con tiempos, entregables y precio cerrado."],
      ["3", "Desarrollo e integraciones", "El producto se construye por partes, con entregas parciales. En cada etapa hay algo funcionando para ver, no solo al final."],
      ["4", "Lanzamiento y optimización", "Puesta en producción, monitoreo, analítica y mejoras apoyadas en los datos reales de uso."],
    ],
  },
  stack: {
    eyebrow: "05 / STACK",
    title: "Con qué trabajo",
    intro:
      "Cada capa elegida por una razón, no por moda. Esto es lo que corro en producción.",
    groups: [
      ["Frontend", ["React", "Next.js", "TypeScript", "Tailwind CSS", "Astro"]],
      ["Backend", ["Node.js", "Express", "PHP", "Laravel", "APIs REST"]],
      ["Bases de datos", ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Firebase", "Supabase"]],
      ["Infraestructura / DevOps", ["Vercel", "AWS", "VPS", "Docker", "CI/CD", "Nginx", "Cloudflare"]],
      ["Analytics & Pagos", ["Google Analytics", "GTM", "Search Console", "Stripe", "MercadoPago", "Mailing"]],
    ],
  },
  results: {
    eyebrow: "06 / RESULTADOS",
    title: "Beneficios para tu negocio",
    intro:
      "La parte que se nota en el negocio: que el sitio cargue, que aparezca en Google y que la venta se concrete sin fricción.",
    cta: "Hablemos de tu proyecto",
    items: [
      ["gauge", "Velocidad real", "Core Web Vitals en verde y tiempos de carga bajos. Cada décima de segundo cuenta: mejora la conversión y el puesto en Google."],
      ["search", "SEO técnico desde el día uno", "Estructura, metadatos y rendimiento resueltos desde el inicio, cuando corregirlos es barato y no una reconstrucción."],
      ["shield-check", "Seguridad y backups", "HTTPS, protección ante ataques y copias de seguridad automáticas, para que un incidente no se lleve puesto el negocio."],
      ["credit-card", "Pagos y automatización", "Stripe, MercadoPago y flujos automáticos que cobran, facturan y registran sin pasos manuales que se traben."],
      ["wrench", "Soporte y mantenimiento", "Actualizaciones, monitoreo y soporte después del lanzamiento. El sitio no queda abandonado el día que sale a producción."],
      ["smartphone", "Impecable en el celular", "Donde la mayoría de los clientes entra primero. El sitio se ve y funciona bien en cualquier pantalla, sin versiones rotas."],
    ],
  },
  contact: {
    eyebrow: "07 / CONTACTO",
    title: "¿Listo para empezar tu proyecto?",
    intro:
      "Con una descripción breve del proyecto, devuelvo una propuesta clara en menos de 24 horas.",
    form: {
      name: "Nombre *",
      namePh: "Tu nombre",
      email: "Email *",
      emailPh: "tu@email.com",
      company: "Empresa (opcional)",
      companyPh: "Nombre de tu empresa",
      message: "Mensaje *",
      messagePh: "Una breve descripción del proyecto: qué se necesita y en qué plazos.",
      submit: "Enviar mensaje",
      sending: "Enviando…",
      success: "Mensaje enviado. Respondo en menos de 24 horas.",
      error: "El mensaje no se pudo enviar. Otra opción es escribir por WhatsApp.",
    },
    asideTitle: "¿Hablamos directo?",
    asideBody:
      "Para una conversación más directa, o si el proyecto ya está definido, cualquiera de estos canales sirve.",
    calendlyLabel: "Videollamada",
    calendlyValue: "Agendar llamada de 10 min",
    emailLabel: "Email",
    whatsappLabel: "WhatsApp",
    whatsappPrefill: "Hola! Me interesa hablar sobre un proyecto.",
    responseTime: "Respuesta en menos de 24 hs",
  },
  footer: {
    tagline: "Diseño, desarrollo e infraestructura web de una sola mano.",
    rights: "Todos los derechos reservados.",
  },
  consent: {
    message:
      "Usamos cookies para medir el tráfico y mejorar tu experiencia. Se pueden aceptar o rechazar.",
    accept: "Aceptar",
    reject: "Rechazar",
  },
} as const;
