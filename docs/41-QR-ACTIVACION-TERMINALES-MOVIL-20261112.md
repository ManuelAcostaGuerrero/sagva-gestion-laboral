# Terminal de asistencia: activación por QR y cabecera responsiva — 12-11-2026

## Objetivo
Evitar transcribir códigos largos de activación en celulares y corregir el desbordamiento horizontal del logotipo/menú visto en la captura móvil de `prueba.sagva.cl`.

## Flujo administrativo actual
1. Usuario administrador o supervisor autorizado abre **Credenciales y terminales → Configurar terminales**.
2. Al crear un equipo para una empresa activa, el servidor devuelve **código** y **QR** en el mismo resultado. Ambos representan exactamente el **mismo código temporal de 43 caracteres**, en formato de lectura `sagva-terminal:<código>`.
3. En caso de **reasignar empresa** a una terminal ya existente, se revoca la credencial anterior y se genera un código/QR nuevos. Cambiar solo permisos de cámara **no** genera otro QR.
4. El administrador enseña el QR al equipo que se va a activar o introduce el código a mano. Se ocultan del panel al pulsar «Ocultar código y QR».
5. El QR no se almacena en la base ni se vuelve a consultar después de esta respuesta. Solo se conserva un hash SHA256 del código, con caducidad de **10 minutos** y **un solo uso**.

## Flujo del equipo nuevo
1. Pantalla pública **Asistencia → Activar terminal de asistencia**.
2. Permite **introducir código** o pulsar **«Escanear QR de activación»**.
3. La cámara solicita permiso en un origen HTTPS seguro, utiliza BarcodeDetector con formato `qr_code`, solo acepta el prefijo `sagva-terminal:` y una clave de 43 caracteres; rechaza QR personales `asistencia:at_...`.
4. La lectura completa el campo, **no activa automáticamente**. El operador confirma pulsando «Activar este equipo».
5. La API `/api/tokens/activate` conserva su contrato original y recibe solo el código bruto. Después de consumirlo se borran `activation_hash` y `activation_expires`, y se emite el token de terminal como antes.
6. Si el navegador no tiene BarcodeDetector, cámara o HTTPS, **no se bloquea** el método manual.

## Cabecera y logotipos
El problema de la captura se produce por las dos columnas mínimas de `.public-sidebar` en dispositivos angostos. El layout se transforma a una columna en viewport móvil, con logo al centro, `object-fit:contain`, menú en dos botones del mismo ancho, padding adaptable y sin desplazamiento lateral. También se limita el ancho del logo de la vista administrativa. El recurso opcional `/brand/red-taurus-sidebar.png` **no figura en el árbol de GitHub**: si la instalación lo sirve, se muestra sin recortes; si falta, se renderiza una cabecera textual «RED TAURUS / CODEX ASISTENCIA» en vez de una imagen rota. No se inventa ni sustituye el logo oficial.

## Pruebas y límites
- `tokens.test.js`: QR PNG, separación del prefijo QR del trabajador, hash y un solo uso.
- `terminal-company.test.js`: QR de reactivación después de cambiar empresa y ausencia de QR al cambiar solo permiso.
- `tools/test-terminal-activation-browser.mjs`: navegador Chrome con cámara emulada, QR, activación manual, liberación de la cámara y verificación de anchos 360/390/768.
- GitHub Actions: pruebas, build y beta en SQLite sintética.
- **Pendiente**: confirmar en celular Android físico y en el sitio de pruebas HTTPS tras actualizar el servidor. No afirmar que modificar GitHub actualiza `prueba.sagva.cl` automáticamente.
- No se modifica producción, empleados, marcaciones, contratos, Propinas, Repartos ni nómina. QR de activación **no es** la tarjeta personal del trabajador.
