# PR-A01 — Comprobantes de marcación (12-11-2026)

**PR real:** [#28](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/28) · **Rama:** `feat/a01-comprobantes-asistencia-20261112` · **Estado:** fusionado a `main` de pruebas el 12-11-2026 en `98a5c522`. CI: servidor/compilación, QR móvil y beta laboral aprobados. Configuración externa y validación DT permanecen pendientes.

## Alcance realizado en la rama

1. Para cada marcación nueva de QR/PIN (o inserción manual administrativa) se preserva la marca original y se produce comprobante ligado a `attendance_integrity_proofs`; no se fabrican comprobantes de marcas antiguas.
2. Se registra en SQLite un JSON canónico del comprobante, SHA-256 del mismo y HMAC-SHA256 solo si `SAGVA_RECEIPT_SIGNING_KEY` tiene al menos 32 caracteres. Triggers impiden reescribir/borrar el comprobante.
3. El comprobante incluye folio, fecha dd/mm/aa, hora HH:MM:SS, tipo y método, nombre y RUT del trabajador, razón social/RUT del empleador, terminal, dirección/territorio informado y SHA-256 de la marcación.
4. La ubicación proviene *temporalmente* de la ficha de empresa. **No acredita el domicilio efectivo del local**. Los regímenes excepcionales no tienen aún fuente validada; aparecen como **SIN_VERIFICAR**. Se señalan brechas, nunca se inventan datos.
5. Terminal QR/PIN ofrece visualización e impresión durante 30 segundos tras la marca. El verificador público usa folio + checksum: `GET /api/attendance/receipts/:id/verify?checksum=...`; devuelve exclusivamente integridad y autenticidad, sin datos personales.
6. El envío por correo usa un adaptador HTTPS de Resend con remitente de sistema. Se guarda un intento inmutable e identificador cuando el proveedor acepta la solicitud; los reintentos se reservan a administración. Un webhook firmado Svix con comprobación de integridad y prevención de repeticiones registra entregas, rebotes y retrasos, sin exponer datos personales. **Aceptación no significa entrega en buzón ni lectura por el trabajador**.
7. Pruebas sintéticas en `server/src/__tests__/attendance-receipts-a01.test.js`. La suite actual del repositorio prueba también idempotencia QR/PIN y marca administrativa.

## Migración y compatibilidad

`20261112_043_attendance_receipts` crea exclusivamente `attendance_receipts` y `attendance_receipt_delivery_attempts`. Es aditiva y no reescribe empleados, contratos, históricos, archivos privados ni huella original. Requiere respaldo antes de ejecutar `Actualizar.bat`, siempre manual, según el protocolo Windows vigente.

**Sin credenciales de correo en repositorio.** Para comprobar un entorno real, configurar de manera privada:

- `SAGVA_RECEIPT_SIGNING_KEY`: secreto aleatorio, estable y de al menos 32 caracteres. Debe respaldarse con seguridad; perderlo impide validar firmas anteriores.
- `RESEND_API_KEY`: token privado del proveedor de correo configurado.
- `SAGVA_RECEIPT_FROM`: remitente de sistema no nominativo bajo dominio verificado por el proveedor.
- `RESEND_WEBHOOK_SECRET`: secreto privado de autenticación del webhook emitido por el proveedor (Svix). Configurar evento firmado contra `POST /api/attendance/receipts/webhook/resend`; usar HTTPS público bajo dominio gestionado; nunca exponer claves.

Estados de envío: `EMAIL_MISSING`, `EMAIL_DUPLICATED`, `CONFIG_PENDING`, `FAILED`, `ACCEPTED_BY_PROVIDER`, `DELIVERED_TO_MAIL_SERVER`, `BOUNCED`, `DELIVERY_DELAYED`. Los últimos tres requieren un evento auténtico del proveedor. `DELIVERED_TO_MAIL_SERVER` no acredita lectura por el trabajador; no confundir la aceptación de API con recepción efectiva. El envío faltante puede reintentarse de forma auditada mediante `POST /api/attendance/receipts/:id/retry` con perfil administrador.

## Puertas que siguen abiertas

- [x] Verificar CI completo de PR #28, test y build web. Tres flujos aprobados en commit `8c22bcdd` antes de fusionar.
- [ ] Probar marcaciones QR/PIN e impresión en Windows y teléfono físico, con datos ficticios.
- [ ] Configurar y probar firma HMAC y proveedor de correo desde un entorno aislado.
- [ ] Probar en un entorno real el webhook firmado del proveedor, registrar entrega efectiva y rebotes, y revisar el tratamiento de información personal. La recepción técnica por servidor de correo no prueba lectura.
- [ ] Validar correo personal único y reglas de actualizaciones de correo.
- [ ] Confirmar domicilio real **por terminal/local** y datos de jornada excepcional, EST o subcontratación antes de declarar comprobantes legales completos.
- [ ] Revisar permisos, segmentación por empresa, auditoría y seguridad; no modificar registros reales.
- [ ] Acreditar certificación y autorización DT por las vías correspondientes. **No se obtiene automáticamente con A01**.

### Referencias

- [Resolución Exenta 38/2024 DT, artículos 12 y 13](https://www.bcn.cl/leychile/navegar?idNorma=1203415): envío automático, formato imprimible y datos mínimos del comprobante.
- [Plan 12-11-2026](42-PLAN-TRABAJO-ASISTENCIA-20261112.md) y [matriz DT](36-MATRIZ-DT-ARQUITECTURA-INTEGRACION-20261111.md).

**Criterio de cierre:** no fusionar el PR solo porque pasan los tests; distinguir implementación, evidencia de entrega real y autorización DT.