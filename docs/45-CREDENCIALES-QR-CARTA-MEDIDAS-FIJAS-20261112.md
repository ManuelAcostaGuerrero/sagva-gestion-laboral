# Credenciales QR RED TAURUS — impresión carta con medidas bloqueadas

**Fecha:** 12-11-2026. **Producto:** SAGVA Gestión Laboral, rama `main` de pruebas tras integración aprobada.

## Dimensiones invariables (la tarjeta original es vertical)

- Cara individual: **54 mm de ancho × 85 mm de alto**, equivalente a la medida nominal aprobada **85 × 54 mm**, en orientación vertical.
- Credencial plegable desplegada: **108 × 85 mm**: dos caras **idénticas** de 54 × 85 mm, con línea central de pliegue.
- QR personal: **30 × 30 mm** por cara desde la implementación P08 (PR #43, 14-11-2026), sin escalar. El tamaño **28 × 28 mm** sigue documentado como versión anterior y referencia de comparación física.
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
- Pendiente en físico para P08: imprimir hoja carta con **escala 100 %**, medir 54 × 85 mm y QR **30 mm** con regla, cortar, doblar y leer ambos QR reales con la terminal autorizada. Comparar con QR anterior de 28 mm.

**Política:** integrar código y documentación en `main` del entorno de pruebas después de CI. No equivale a actualizar automáticamente el Windows local ni a declarar aprobada la impresión física.


## Reimpresión segura de credenciales (14-11-2026)

- Hay **un QR activo por trabajador**. El contenido se guarda **cifrado AES-256-GCM** en `worker_tokens.token_ciphertext` y el hash actual sigue siendo el único medio de validación al marcar.
- El diseño del carnet está centralizado en `client/src/printQrCards.js`, compartido para todos; se renderiza una imagen QR por trabajador desde su código cifrado **sin generar ni revocar otro**. La reimpresión requiere sesión administrativa autorizada y queda auditada como preparación de reimpresión. 
- Administración → Credenciales y terminales → **Reimprimir carnets existentes** muestra hasta 100 trabajadores por página, selección de 1 a 20, luego **Cargar selección para imprimir** y **Imprimir selección / Guardar PDF**.
- Para los QR creados **antes** de esta migración, solo se guardó hash y **no es posible deducir el código**. Si todavía existe el carnet impreso, leer su contenido mediante un lector QR, buscar trabajador en Administración y usar **Recuperar una tarjeta QR ya impresa**. SAGVA compara el hash de la lectura con el hash activo y conserva el código cifrado **sin revocarlo ni modificarlo**. Si no se tiene el QR original, emitir uno nuevo invalida el anterior de manera explícita.
- Seguridad: respuesta con `Cache-Control: private, no-store`, no registrar secreto en bitácora, no imprimir QR inactivos/revocados. La bóveda usa `SAGVA_QR_DATA_KEY` hex de 64 caracteres si se configura; en instalaciones existentes deriva una clave AES del `JWT_SECRET` fuerte generado por `Preparar.bat`. Respaldar `server/.env` junto con SQLite: **rotar/perder la clave sin migrar el cifrado impide futuras reimpresiones**. No permitir acceso de la terminal a esta función.
- La impresión en el navegador *no prueba físicamente que la impresora haya impreso*: se audita la **preparación para reimpresión**, no una entrega comprobada. No se alteran registros de asistencia.

## Legibilidad para cámara Samsung SM-P613 (14-11-2026)

- Se aumentó el QR impreso de **20 × 20 mm a 28 × 28 mm** (40 % por lado, cerca del doble de superficie). El contenido del QR emitido por trabajador **no cambia**: reimprimir no reemplaza ni revoca credenciales.
- Se conserva cada cara **54 × 85 mm**, las dos caras idénticas, el plegado y **cuatro carnets por hoja carta** a escala 100 %. El QR se centra en 13 mm y se desplaza el pie a 76,4 mm para evitar superposición.
- La cámara trasera de esta tablet dispone de enfoque automático según las especificaciones Samsung, mientras que la frontal es la apropiada para orientación al trabajador cuando el equipo está fijo; probar ambas. El frontend solicita resolución ideal 1280 × 720, no obligatoria.
- La imagen digital del QR se escala con bordes definidos, no con desenfoque; exigir prueba real con carné impreso, mica y luz del local, verificando lectura a distancia razonable. La resolución solicitada puede no ser respetada por todas las cámaras.


## Implementación P08 (PR #43, 14-11-2026) · QR de 30 × 30 mm

- Se modifica **solo presentación**: `qrSizeMm=30`, caja QR centrada a **12 mm del borde izquierdo** y **45,8 mm desde arriba**. Nombre, cargo y pie se redistribuyen para conservar separación y evitar cortes; ambas caras siguen siendo idénticas.
- Permanecen sin cambio el contenido y validez del QR personal, la bóveda cifrada, la emisión y revocación, la empresa asignada, el logotipo, el tamaño 54 × 85 mm, el plegado y cuatro carnets por hoja carta.
- Se ajustan dos suites unitarias, la prueba sintética de navegador y el texto de Administración a 30 mm. Una prueba automatizada **no equivale** a una prueba con impresora ni cámara frontal real.
- La validación de 30 mm queda **pendiente de medición y comparación física** en la Samsung SM-P613 contra la versión de 28 mm aceptada anteriormente por el propietario. Si la mejora no se verifica, revertir únicamente diseño/tamaño de impresión.
- Instrucciones operativas y criterios en [plan P08](49-PLAN-QR-30MM-LECTURA-SEGURA-20261114.md). La incorporación a `main` de pruebas **no actualiza automáticamente** la instalación Windows.
