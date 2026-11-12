# SAGVA Gestión Laboral — Plan de pantalla de marcación (12-11-2026)

**Estado:** planificación aprobada para desarrollo posterior, NO implementada por crear este archivo. **Rama de destino:** `main` del producto de pruebas. **Repositorio exclusivo:** `ManuelAcostaGuerrero/sagva-gestion-laboral`.

## Propósito

Una sola entrada al producto con dos accesos grandes, **Asistencia** y **Administración**. El dispositivo fijo (Android/tablet) debe presentar una pantalla de marcación minimalista y segura. Tras el escaneo del QR se conserva la hora de recepción del evento y luego se elige tipo de marcación, sin cobrar al trabajador demoras de navegación injustificadas. El diseño de acto de marcación en dos etapas debe pasar revisión específica frente a la Resolución Exenta DT Nº 38/2024 antes de declararse apto para uso laboral.

## Estado real previo (12-11-2026)

- `client/src/main.jsx`: abre actualmente directamente la vista `attendance`, salvo sesión administrativa existente, y muestra la navegación pública superior.
- `client/src/TokenKiosk.jsx`: muestra los cuatro botones de tipo antes de escanear QR; separa «Solo identificar» de «Registrar asistencia»; los métodos QR manual/PIN son alternativos; confirma 30 segundos con datos de marcación.
- `client/src/TerminalActivationScanner.jsx` y `server/src/routes/token.routes.js`: ya permiten activación por código o QR, vigencia 10 minutos y validación de credencial de terminal.
- `POST /api/tokens/identify` identifica sin marcar; `POST /api/tokens/mark` crea la marca con hora definida al completar la petición de marcación. No existe todavía una marca provisional firmada ni una sesión de marcación de escaneo primero.
- **Importante:** actualmente cada terminal queda vinculada a **una sola empresa** por `company_id`; no afirmar que el mismo equipo ya permite marcar simultáneamente personal de dos empresas.

## Fases técnicas

### P01 — Portal de acceso (frontend)

1. Crear vista inicial dedicada con dos botones grandes: **Asistencia** y **Administración**. Sin activar cámara automáticamente.
2. Botón Asistencia dirige directamente al flujo de terminal, no a un paso intermedio; botón Administración dirige al login o panel según la sesión.
3. Preservar rutas existentes, sesiones y acceso desde móvil/PC; asegurar diseño responsive para tablet de pared.
4. Mantener acceso administrativo desde kiosco con botón pequeño pero visible, protegido por autenticación/roles (ocultar no es seguridad).

**Aceptación:** al iniciar sesión pública se ven únicamente las dos entradas. Al seleccionar Asistencia se abre el kiosco y no se exponen menús administrativos.

### P02 — Comprobación/alta de terminal

1. Al entrar a Asistencia consultar al servidor el estado real de autorización de la terminal.
2. Si no hay credencial vigente o fue revocada, **no abrir cámara de asistencia**: mostrar primero formulario para **ingresar código o escanear QR de activación**.
3. Reutilizar activación existente (código/QR de un solo uso, vencimiento, empresa asignada); no confundir QR del terminal con QR del trabajador.
4. Si está autorizada, abrir kiosco de espera directamente.
5. No reenrolar silenciosamente ni aceptar códigos caducados. En terminal revocada bloquear todo registro.

**Aceptación:** equipo no autorizado jamás puede generar una marcación; equipo activo sí puede marcar exclusivamente para su empresa autorizada.

### P03 — Pantalla de espera minimalista

1. Estética RED TAURUS, ocupando la pantalla: logo, botón grande **Escanear QR**, reloj informativo y pequeño control **Administración/Salir**.
2. Cámara se abre al pulsar Escanear QR, usando HTTPS y permisos del dispositivo; se apaga al identificar o cancelar.
3. No mostrar antes del escaneo los cuatro tipos de marcación; no pedir elegir acción previamente.
4. Conservar PIN y lector externo como métodos de respaldo discretos, sujetos a permisos.
5. Manejar pantalla vertical/horizontal, tamaño táctil, error de cámara y reconexión.

**Aceptación:** durante la espera la información de trabajadores no es visible y cámara no permanece prendida.

### P04 — Sesión de escaneo con sello temporal seguro (backend + frontend, puerta jurídica)

1. **Antes de escanear**, mostrar una instrucción clara: «Al escanear se registrará la hora del intento; luego debes confirmar el tipo de marcación».
2. Identificar QR válido y empresa/terminal; en ese instante **el servidor** registra un evento provisional de lectura con ID aleatorio, fecha/hora/segundos, empleador, dispositivo y trabajador, junto a prueba de integridad. No usar el reloj modificable del móvil para fijar la hora oficial.
3. Devolver los datos de la sesión y la hora capturada. Mostrar nombre identificado y cuatro opciones grandes: **Entrada**, **Salida a colación**, **Regreso de colación**, **Salida**.
4. Al elegir una opción, realizar **una única** transacción atómica que la vincule al evento provisional; no cambiar hora a la pulsación del botón. Asegurar idempotencia, firma/hashes, comprobante y auditoría, preservando ambos momentos (escaneo y elección).
5. El evento provisional no se considera por sí mismo una entrada/salida válida, no se liquida como jornada y no aparece como marcación definitiva si nunca se eligió el tipo. Registrar cancelación, expiración y fallas de forma auditable.
6. Definir caducidad acotada de selección (propuesta inicial: 120 segundos, configurable y probada); al vencer, no aceptar confirmaciones tardías ni crear automáticamente marcas. Permitir cancelar y volver a escanear.
7. Probar concurrencia de dos trabajadores, repetición de lecturas, latencia, caída de red y reintentos para impedir duplicados o asociar marca al usuario equivocado.
8. **Puerta de cumplimiento obligatoria:** validar con documentación DT si el acto consciente y voluntario puede constituirse como una confirmación posterior que utiliza la hora previa registrada. La Resolución Nº38/2024, artículo 36, exige que el trabajador conozca con antelación cuándo su acción genera una marcación. Si esta interpretación no se acredita, conservar la hora del escaneo como evidencia de intento y utilizar la hora de confirmación para la marcación legal; nunca presentar una hora retroactiva artificial como si estuviera certificada.

**Aceptación:** la hora de escaneo es inmutable y comprobable; la hora de marca legal sólo se fija conforme al criterio DT validado; ninguna marca automática nace de una identificación abandonada.

### P05 — Resultado y reinicio automático

1. Después de registrar, mostrar pantalla de confirmación con **nombre**, **tipo**, **fecha y hora con segundos**, **empresa** y estado de comprobante.
2. El resultado permanecerá **15 segundos** (propuesta inicial) y volverá automáticamente a **espera de escaneo**, no al portal principal.
3. Botón grande **Finalizar / Siguiente trabajador** permite volver de inmediato. No registrar segunda marca al tocarlo.
4. En errores no mostrar éxito; permitir reintento seguro con el mismo ID de solicitud y revisar registro/auditoría.
5. Ocultar datos personales al concluir el plazo; detener cámara; limpiar token/sesión QR del frontend.

**Aceptación:** auto-retorno en 15 segundos o antes por toque; una sola marca y comprobante por confirmación.

### P06 — Multempresa y seguridad (separar de rediseño visual)

1. Decisión pendiente: si **Gastro-Bar y Rentacar** compartirán físicamente un equipo, diseñar **autorizaciones de terminal por empresa**, no mezclar trabajadores por nombre ni asumir mismo empleador.
2. Un QR sólo debe resolver una relación contractual **verificada** y empresa apropiada; el comprobante, el historial, el RUT y los reportes deben conservar al empleador correcto. Si hay ambigüedad, rechazar o pedir selección segura, sin guardar marca en empresa equivocada.
3. Usuarios administrativos con acceso limitado por empresa; Root puede administrar autorizaciones explícitas. El botón pequeño de Administración exige sesión/autenticación.
4. Auditar cambio de empresa y revocación; respetar aislamiento en API y DB. **No activar simultaneidad multempresa sólo por reutilizar el teléfono**.

**Aceptación:** pruebas negativas obligatorias para que empresa A no lea, marque ni exporte datos de B.

### P07 — Pruebas, regresión y entrega a `main`

1. Pruebas unitarias/integración sintéticas: reloj servidor, rango de tolerancia próximo a límite (p. ej. 4:58 frente a 5:00), latencia, duplicados y fallas.
2. Pruebas navegador tablet/Android: portal, alta, lector, elección post-escaneo, confirmación, botón siguiente, retorno automático, bloqueo y accesibilidad.
3. Pruebas de empresa: empresa/terminal inválida, PIN, QR vencido, ausencia de cámara, sesión caducada y roles.
4. No modificar bases reales ni contratos; migración **aditiva y reversible** si se agregan tablas de eventos provisionales. Conservar `Actualizar.bat` manual con respaldo previo.
5. Tres CI y revisión de seguridad deben pasar antes de fusionar cada incremento a **`main` de pruebas**.
6. Prueba física de dispositivo fijo y ensayo con operarios. La aprobación legal/certificación DT siguen siendo **externas** al éxito de CI.

## Orden recomendado de desarrollo

1. **PR-K01** portal y selección Asistencia/Administración.
2. **PR-K02** kiosco en espera + activación obligatoria reutilizada.
3. **PR-K03** sello horario provisional, modelo de dos etapas e integridad; **depende del criterio legal DT** para uso definitivo.
4. **PR-K04** elección de marcación, comprobante, tiempo de confirmación y retorno.
5. **PR-K05** autorización multempresa de terminal (sólo si Gastro-Bar y Rentacar compartirán el dispositivo).
6. **PR-K06** pruebas físicas/seguridad, documentación y cierre operacional.

## Referencias normativas

- Resolución Exenta DT N.º 38 de 26-04-2024, especialmente artículos 3, 36 y disposiciones sobre marcaciones, comprobantes y autorización: https://www.bcn.cl/leychile/navegar?idNorma=1203415
- Código del Trabajo, artículo 33 y régimen de sistemas electrónicos autorizados: https://www.dt.gob.cl/portal/1628/w3-article-60140.html

**Alcance de este archivo:** únicamente planificación; no cambia la interfaz, APIs, permisos ni marcaciones actuales.
