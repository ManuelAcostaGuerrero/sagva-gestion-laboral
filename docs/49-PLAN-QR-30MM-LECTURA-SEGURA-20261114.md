# P08 · Plan de optimización del QR impreso a 30 × 30 mm

**Fecha:** 14-11-2026. **Repositorio:** `ManuelAcostaGuerrero/sagva-gestion-laboral`. **Estado:** código P08 implementado en **PR #43** sobre rama de pruebas, pendiente de validación física. **Destino:** `main` de pruebas después de revisión y CI. La aceptación física de 30 mm NO está acreditada.

## Contexto y objetivo

El propietario confirmó en conversación que el **QR de 28 × 28 mm funciona en prueba física**, aunque tarda algo en reconocerse en la tablet fija. Esa aceptación es del tamaño actual, no del propuesto. Probar un aumento **moderado a 30 × 30 mm** sin cambiar contenido, identidad, validez o longitud de QR, ni comprometer la plantilla plegable.

La Galaxy Tab S6 Lite SM-P613 está montada en pared y debe usar la cámara **frontal**; la trasera apunta a la pared. El tamaño físico mayor podría ayudar, pero no garantiza mejorar la latencia de lectura; intervienen enfoque fijo, distancia, iluminación, impresión y margen blanco.

## Invariantes no negociables

- Cada cara sigue **54 mm de ancho × 85 mm de alto**, vertical, con **dos caras iguales**. Par desplegado: **108 × 85 mm**, línea de pliegue y corte intactas.
- Hoja carta **215,9 × 279,4 mm** a **100 % de escala**, **4 pares máximo por hoja**, **20 carnets máximo por lote**; no cambiar `paginateQrCredentials`.
- No modificar **ningún token, hash, ciphertext, secreto, RUT o identificador** de trabajadores; no llamar emisión, regeneración ni revocación al reimprimir.
- Conservar el **logotipo aprobado RED TAURUS**, `GASTRO-BAR`, nombre, cargo y «USO INTERNO | ASISTENCIA». Sin superponer textos, zona blanca QR, márgenes, pliegue o corte.
- La mejora es exclusivamente de **presentación de impresión** y pruebas. No requiere migraciones ni alterar base de datos, permisos, API de marcación, cámara o comprobantes.
- Guardar las tarjetas QR solo para fines autorizados; no compartir capturas de credenciales reales, secretos o PDFs privados en GitHub.

## Impacto comprobado en el repositorio (main, 14-11-2026)

1. `client/src/qrCredentialPrintLayout.js`: `qrSizeMm: 28` y CSS `.qr-face-image` con `left:13mm;top:47mm;width:28mm;height:28mm`. La cara tiene 54 × 85 mm. El pie actual inicia en `top:76.4mm`, y el cargo en `top:40.8mm` con `height:5.6mm`.
2. `client/src/printQrCards.js`: una sola plantilla para imprimir uno o varios carnets; el logo se carga desde `/red-taurus-logo.svg`. **No alterar generación ni lectura de tokens.**
3. `client/src/TokenCredentials.jsx`: texto explicativo todavía menciona QR 28 × 28 mm; actualizarlo cuando se implemente el ajuste.
4. Pruebas con expectativa explícita de 28 mm: `server/src/__tests__/qr-credential-print-layout.test.js` y `server/src/__tests__/laboral-carnets-ux-20261114.test.js`. Actualizar a 30 mm en el mismo PR.
5. Prueba de navegador existente: `tools/test-qr-mobile-browser.mjs`. Ajustar toda expectativa de dimensión y verificar la vista previa.
6. Referencias documentales: `docs/45-CREDENCIALES-QR-CARTA-MEDIDAS-FIJAS-20261112.md` y `docs/48-CONFIGURACION-TABLET-SM-P613-20261113.md`: mantener registro histórico de 28 mm y añadir nueva vigencia, **sin reescribir la historia de la prueba anterior**.

## Diseño propuesto: distribución preliminar y verificación geométrica

Ajuste tentativo, sujeto a visualización y medición real, coordenadas en milímetros **desde esquina superior izquierda de cada cara**, no de la hoja:

| Elemento | Situación actual | Propuesta inicial |
|---|---|---|
| Cara | 54 × 85 | **54 × 85 (sin cambio)** |
| Logo | izq. 10; arriba 7; 34 × 19,3 | **sin cambio** |
| Subtítulo | arriba 27 | **sin cambio** |
| Nombre | arriba 32; altura 7,6 | arriba **31,5**; altura **7,4** |
| Cargo | arriba 40,8; altura 5,6 | arriba **39,5**; altura **5,6** |
| QR | izq. 13; arriba 47; **28 × 28** | izq. **12**; arriba **45,8**; **30 × 30** |
| Pie | arriba 76,4; altura 6 | arriba **77**; altura **6** |

Se conservaría una holgura vertical propuesta de ~0,7 mm entre cargo y QR y ~1,2 mm entre QR y pie. **Es una hipótesis de diseño, no una medición aprobada**. Antes de implementar confirmar mediante medidas DOM/PDF e impresión que CSS, fuentes, borde y datos largos no alteren estos espacios. No modificar ni recortar el QR para hacerlo caber. Verificar zona de silencio blanca alrededor del símbolo, sin decoraciones superpuestas, y medir el **cuadrado impreso completo** de 30 mm.

Si el texto de nombres/cargos largos pierde legibilidad, corregir su acomodo sin reducir el QR, o rechazar 30 mm y conservar 28 mm. No aumentar automáticamente a 32 mm.

## Ejecución controlada

**P08.1 · Línea base (sin cambios):** fotografiar/medir 28 mm mediante **registros privados**: tres credenciales distintas autorizadas, 10 intentos por credencial en buena luz y 10 con luz habitual del local. Registrar tiempo desde enfocar hasta identificación, éxito, distancia, tipo de papel/mica, cámara frontal fija y fallas. Evitar publicar tokens ni caras completas de tarjetas en GitHub.

**P08.2 · Código mínimo:** crear rama de corrección específica; modificar únicamente geometría y constante de impresión + leyenda de UI; preservar generador, hashes, autorización y API. No tocar el logo ni el futuro diseño multempresa por ahora.

**P08.3 · Pruebas técnicas:** actualizar ambas pruebas 28→30 y pruebas de layout; ejecutar `npm run test:server`, `npm run build --workspace client` y, si el entorno soporta navegador, `node tools/test-qr-mobile-browser.mjs`. Verificar impresión individual y de 1/4/5/20 carnets, sin recortar, sin solapamiento y sin duplicados. Comparar que los mismos QR reimpresos produzcan identificación válida sin nueva emisión.

**P08.4 · Revisión GitHub:** abrir PR hacia `main`; revisión de diff limitada a UI/impresión, CI aprobado y sin datos reales. No fusionar si hay pruebas fallidas, texto recortado o regresión.

**P08.5 · Prueba física en SM-P613:** imprimir **una hoja de prueba** en tamaño carta a 100 %, medir con regla 54 × 85 mm cada cara y QR **30 × 30 mm**, doblar e introducir en portacarnet/mica real. Probar 3 carnets × 10 lecturas con iluminación buena y 3 × 10 en iluminación habitual, a distancias de trabajo, con cámara frontal y tablet en pared. Mantener condiciones comparables a P08.1. Registrar tiempos de lectura (mediana y fallos) y comprobar que cada marca solo se realiza tras confirmación y que no hay identificación equivocada.

**Criterio de aceptación:** 30 mm debe **mejorar mediana de reconocimiento frente a 28 mm**, sin aumentar fallos, sin lecturas de persona incorrecta y sin comprometer contenido de la credencial. Además, todas las medidas/CI deben aprobar. Si no hay mejora medible, **no desplegar el cambio por tamaño solamente**; investigar enfoque/iluminación/material y comparar solución externa de lectura, sin tocar el token.

**P08.6 · Despliegue local manual:** solo tras aprobación, `Actualizar.bat` bajo su protocolo de prevalidación, respaldo, restauración y rollback. No instalar automáticamente; actualizar misma pestaña/PWA conforme al mecanismo disponible y comprobar caché. Guardar hash/SHA del commit de referencia. Mantener referencia del commit anterior y carnets de 28 mm funcionales.

## Precauciones, incidentes y reversión

| Riesgo | Prevención / respuesta |
|---|---|
| QR solapado con nombre, cargo o pie | Comprobar posiciones DOM y versión impresa antes de aprobar, no forzar 32 mm |
| Baja nitidez, escala de impresora incorrecta o mica brillante | Impresión 100 %; medir; papel/portacarnet real; probar luz real y enfoque frontal |
| Cambio de QR o pérdida de validez | No tocar API ni `worker_tokens`; reimpresión únicamente; comparar identidad validada antes/después |
| CI en rojo por aserciones 28 mm | Actualizar constantes, expectativas y pruebas navegador en **mismo PR**, nunca ocultar o desactivar pruebas |
| Lectura más lenta con 30 mm | Comparación cronometrada con línea base; revertir UI a 28 mm si no mejora |
| Actualización interrumpe marcación | Aplicación controlada fuera de horas críticas, respaldo y rollback con `Actualizar.bat`, verificación manual posterior |
| Revelación accidental de QR real | Evidencia anonimizadas/sintéticas en repo; datos de prueba física solo en informe privado |
| Afectar diseño multempresa futuro | Dejar este ajuste aislado en tamaño/geométrico; logo y plantilla por empresa serán un módulo posterior separado |

## Dependencias y asuntos fuera de alcance

- **Modo offline y sincronización cronológica**: otra fase, pendiente de implementar. No vincular su entrega a esta mejora visual.
- **RUT + token temporal de 5 minutos por correo**: fase distinta, no se modifica con el tamaño del QR. SMS descartado.
- **Plantillas y logotipos configurables por empresa**: funcionalidad futura; evitar ampliar alcance de P08 para hacerla ahora.
- Prueba física de 28 mm fue **reportada por el propietario**, mientras que 30 mm **no se ha probado**.

**Estado de avance P08 (PR #43):** código de impresión de 30 mm y pruebas automáticas actualizadas en rama. La revisión/CI, ensayo físico y actualización Windows requieren acreditación independiente; no declarar aprobado el rendimiento real hasta prueba física.
