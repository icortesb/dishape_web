---
title: "Por qué una web lenta te está costando ventas"
description: "La velocidad de carga no es un detalle técnico: define cuántos visitantes se quedan, cuántos compran y dónde aparece el sitio en Google. Los números y cómo solucionarlo."
pubDate: 2026-06-04
updatedDate: 2026-08-18
lang: es
slug: web-lenta-pierde-ventas
translationKey: speed-conversion
category: "Rendimiento"
readingTime: "6 min"
relatedService: web
---

Un sitio lento parece un problema técnico menor, algo que "ya va a cargar". En realidad es uno de los factores que más directamente afecta las ventas, y casi siempre pasa desapercibido porque no se ve: el visitante que se va por la demora nunca deja rastro. Estos son los números y qué se puede hacer.

## El visitante no espera

El dato más citado viene de Google: **el 53 % de los visitantes abandona un sitio que tarda más de 3 segundos en cargar** en el celular. No es que se quejen ni que avisen; simplemente cierran la pestaña y siguen con otra cosa. Cada décima de segundo de más es gente que se va antes de ver lo que el sitio ofrece.

Y al revés también funciona: estudios de la industria muestran que **cada 0,1 segundo de mejora en la velocidad puede aumentar la conversión hasta un 8 %**. La velocidad no es solo evitar perder visitas; es convertir más de las que ya llegan.

## La velocidad también define el puesto en Google

Hay un segundo efecto, más silencioso. Google mide la experiencia de carga con tres métricas, las Core Web Vitals, y las usa como señal de posicionamiento:

- **LCP** (Largest Contentful Paint): cuánto tarda en aparecer el elemento principal de la pantalla. Bien: menos de 2,5 segundos.
- **INP** (Interaction to Next Paint): cuánto tarda la página en responder a un clic o a un toque. Bien: menos de 200 milisegundos. Reemplazó a la métrica anterior, FID, en marzo de 2024, así que un sitio optimizado antes de esa fecha puede estar aprobando algo que ya no se mide.
- **CLS** (Cumulative Layout Shift): cuánto se mueve el contenido mientras carga, eso de ir a tocar un botón y que salte de lugar. Bien: menos de 0,1.

Dos detalles cambian cómo se leen esos números. Google no mira el promedio, mira el percentil 75 de las visitas reales: para aprobar hace falta que cargue bien para el 75 % de los visitantes, no para el visitante promedio. Y el peso en el ranking es más modesto de lo que se suele vender: funciona como desempate entre páginas de relevancia parecida, no compensa un contenido que no responde a lo que la persona buscó.

Aun así el círculo existe: el sitio carga lento, queda debajo de un competidor equivalente, recibe menos visitas, y las pocas que recibe se van por la demora. La velocidad afecta las dos puntas del embudo a la vez.

## Por qué los sitios terminan lentos

La lentitud rara vez es una sola causa. Las más comunes:

- **Imágenes pesadas.** Fotos sin optimizar que pesan varios megabytes y se cargan tal cual.
- **Exceso de scripts.** Plugins, rastreadores y librerías que se acumulan y bloquean la carga.
- **Plantillas recargadas.** Temas genéricos que traen funciones que el sitio no usa pero igual descarga.
- **Hosting de baja calidad.** Servidores compartidos y saturados que responden lento ante cualquier pico.

Lo importante: ninguna de estas causas es inevitable. Todas se resuelven, y cuestan mucho menos de resolver si se tienen en cuenta desde el desarrollo y no después.

## Qué se puede hacer

El rendimiento se trabaja, no aparece solo. En la práctica:

- Optimizar y servir las imágenes en el formato y tamaño correctos.
- Cargar solo el código necesario y diferir lo que no es urgente.
- Elegir un hosting que responda rápido y aguante los picos.
- Medir con datos reales (no impresiones) qué está frenando la carga y corregir eso.

Por eso, en cualquier proyecto bien hecho, el rendimiento es lo primero que se resuelve, antes que cualquier otra capa. Es la base sobre la que se apoya todo lo demás: si el sitio no carga, el mejor diseño y el mejor producto no llegan a verse.

## En resumen

Una web lenta pierde visitas, convierte menos y aparece más abajo en Google, todo al mismo tiempo, y lo hace de forma invisible. La buena noticia es que es de los problemas con mejor relación entre lo que cuesta resolverlo y lo que se recupera. Un buen punto de partida es [medir cómo carga hoy el sitio](/auditoria/): el diagnóstico devuelve esas tres métricas con datos de visitantes reales, es gratis y no pide registro. El número suele sorprender.
