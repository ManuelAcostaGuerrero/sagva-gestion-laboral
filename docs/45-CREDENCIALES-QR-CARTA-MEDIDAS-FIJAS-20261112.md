# Credenciales QR RED TAURUS — impresión carta con medidas bloqueadas

**Fecha:** 12-11-2026. **Producto:** SAGVA Gestión Laboral, rama `main` de pruebas tras integración aprobada.

## Dimensiones invariables (la tarjeta original es vertical)

- Cara individual: **54 mm de ancho × 85 mm de alto**, equivalente a la medida nominal aprobada **85 × 54 mm**, en orientación vertical.
- Credencial plegable desplegada: **108 × 85 mm**: dos caras **idénticas** de 54 × 85 mm, con línea central de pliegue.
- QR personal: **20 × 20 mm** por cara, sin escalar.
- Diseño: **RED TAURUS · GASTRO-BAR**, fondo negro y rojo, nombre, cargo, uso interno/asistencia; sin ranura de cordón.
- Las dimensiones se definen una sola vez en `client/src/qrCredentialPrintLayout.js` y se validan por pruebas automáticas. No reducir las credenciales para que entre un lote más grande.

## Hoja carta (215,9 × 279,4 mm)

Con margen de impresión de **12 mm** a cada lado, el área imprimible es 191,9 × 255,4 mm. Para que **cuatro credenciales** quepan con separación y sin pérdida de bordes, los **pares completos** se giran 90° en el papel. **No se deforma ni cambia la medida física de las caras**.

La hoja contiene una cuadrícula de 2 columnas × 2 filas:
- Cada casilla ocupa **85 × 108 mm** (credencial desplegada, girada).
- Entre columnas: **7 mm**. Entre filas: **9 mm**.
- Las cuatro casillas ocupan **177 × 225 mm** dentro del área imprimible, centradas.
- Líneas discontinuas exteriores de corte y línea divisoria central para doblar.

Cantidad | Hojas carta
--- | ---
1, 2, 3 o 4 | 1
5 a 8 | 2
9 a 12 | 3
13 a 16 | 4
17 a 20 | 5

## Uso

1. Desde **Credenciales y terminales**, emitir uno o varios QR, exclusivamente cuando corresponda según el control de revocación existente.
2. La impresión individual y por lote ejecuta la misma plantilla: `printQrCard.js` delega en `printQrCards.js`.
3. Usar **papel carta, escala 100 % / tamaño real**, sin opciones como «ajustar a página», «reducir» o impresión sin bordes. Activar tinta a color y verificar una regla impresa antes de imprimir el lote.
4. Si se solicitan de 1 a 4, generar una hoja; desde 5, dividir automáticamente en varias hojas. El máximo operativo actual es de 20 QR nuevos por lote.

**Notas:** el generador usa arte vectorial integrado y los QR PNG individuales reales emitidos por el servidor; **no** copia códigos QR de prueba del diseño anterior. El rótulo `PERSONAL` se usa solo si no llega un cargo validado en los datos de impresión, sin inventar uno. La versión vectorial mantiene la línea gráfica aprobada, pero no declara paridad píxel a píxel con la ilustración histórica de la Biblioteca. El mecanismo de emisión no conserva en el servidor una imagen recuperable del QR: imprimir o guardar el lote recién emitido antes de cerrarlo.

## Pruebas y cierre

- Prueba unitaria sintética: `server/src/__tests__/qr-credential-print-layout.test.js` valida medidas, lote y cuadrícula.
- Prueba navegador sintética: `tools/test-qr-mobile-browser.mjs` valida dos caras e inspecciona las medidas DOM en impresión.
- Pendiente en físico: imprimir hoja carta con **escala 100 %**, medir 54 × 85 mm y QR 20 mm con regla, cortar, doblar y leer ambos QR reales con dispositivo autorizado.

**Política:** integrar código y documentación en `main` del entorno de pruebas después de CI. No equivale a actualizar automáticamente el Windows local ni a declarar aprobada la impresión física.
