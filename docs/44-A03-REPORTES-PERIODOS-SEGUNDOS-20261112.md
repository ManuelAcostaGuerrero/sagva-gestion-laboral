# A03 — Reportes por período y precisión de segundos (12-11-2026)

**Alcance:** exclusivamente desarrollo de las subtareas A03.1, A03.2 y A03.4 del [plan de asistencia](42-PLAN-TRABAJO-ASISTENCIA-20261112.md). No se ejecuta conciliación con datos reales ni se certifican horas extras.

## Programado en esta rama

- **A03.1**: desde `Reportes`, consultar asistencia **diaria, semanal y mensual** del mes elegido y por trabajador; las semanas empiezan en lunes y al cruzar el mes se cuentan solo los días del mes filtrado. Conserva el reporte mensual anterior.
- **A03.2**: calcular jornada, colación, atraso, salida anticipada, faltante y exceso técnico **en segundos** antes de sumar o truncar; conservar los campos de minutos anteriores por compatibilidad. El tiempo no calculable por marcas incompletas se indica aparte y no se presenta como jornada completa.
- **A03.4**: exportación **CSV autenticada** del mismo filtro consultado, generada en servidor; registra identificador de exportación, fecha UTC, filtros, número de filas y SHA-256 del CSV en bitácora. Protección contra fórmulas inyectadas y respuesta privada sin caché. No se publican datos personales en enlaces.

## Pendientes deliberadamente fuera de esta entrega

- **A03.3**: clasificación **jurídica** de horas extraordinarias, autorizaciones y compensaciones. El sistema muestra únicamente *exceso técnico no autorizado*, sin calcular ni prometer pagos.
- **A03.5**: enlazar marcaciones antiguas con relaciones laborales verificadas: depende del diagnóstico privado y conciliación caso a caso del [issue #16](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/issues/16).
- **A04**: aislamiento integral por empresa/local y revisión de permisos. Se restringen los nuevos endpoints a `admin` y `supervisor` centrales como medida inicial, sin declarar seguridad multiempresa completa.
- Validación visual física Windows/Android y auditoría posterior no acreditadas por CI.

## Verificación técnica exigida

1. `npm test --workspace server`, incluye `attendance-reports-a03.test.js`: segundos fraccionarios, agregación por persona/semana, límites de mes, CSV seguro, control de acceso y auditoría SHA-256 sin alterar marcaciones.
2. `npm run build --workspace client`, reporte desde menú existente.
3. Workflows GitHub: **Verificar proyecto**, **Validar mejoras QR móvil** y **Validar beta estructura laboral 1A–1E** en commit final.
4. Antes de instalar: respaldo/restauración probada, actualización **manual** `Actualizar.bat`, pruebas en dispositivo físico y verificación de accesos. Sin despliegue automático ni manipulación de SQLite real desde este PR.

**Fuente:** `server/src/attendanceReport.js`, `server/src/attendancePeriodReport.js`, `server/src/routes/attendance.routes.js`, `client/src/AttendancePeriodReports.jsx`. No duplica el módulo laboral ni introduce una base distinta. No acredita conformidad con DT.
