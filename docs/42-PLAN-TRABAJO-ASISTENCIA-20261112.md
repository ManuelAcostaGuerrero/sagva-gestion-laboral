# SAGVA Asistencia — Plan de trabajo del 12-11-2026

**Repositorio:** `ManuelAcostaGuerrero/sagva-gestion-laboral` · **Base:** `main` (pruebas).  
**Estado:** planificación aprobada para organizar la jornada; **seleccionado no equivale a implementado**.  
**Alcance de hoy:** 13 subtareas en 3 bloques. Las fases 4–6 se conservan para después.

## 1. Comprobantes — PR-A01 (identificador de planificación, no número de GitHub)

- [x] Generar comprobante inmutable de cada marcación nueva; sin retrorelleno histórico (código en PR #28).
- [ ] Completar datos legales, fecha, hora y tipo de marca: estructura implementada; domicilio efectivo/local, régimen excepcional y casos EST pendientes de validación.
- [ ] Entregar comprobante al trabajador y registrar evidencia de entrega: impresión y registro de intento implementados; proveedor requiere configuración y la recepción real aún no está probada.
- [x] Habilitar verificación de integridad y autenticidad: SHA-256 y verificador sin PII; HMAC requiere secreto estable.

**Estado:** [PR #28 en borrador](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/28), pendiente pruebas y cierre de brechas. [Detalle técnico A01](43-A01-COMPROBANTES-20261112.md). No fusionado.

## 2. Rectificaciones — PR-A02

- [ ] Solicitar corrección de una marcación.
- [ ] Notificar al trabajador y gestionar oposición.
- [ ] Implementar plazo y procedimiento de 48 horas según revisión normativa aplicable.
- [ ] Conservar marca original, corrección e historial de auditoría.

**Condición:** no editar ni sobrescribir la marcación original. **Estado:** seleccionado, sin PR funcional creado.

## 3. Reportes — PR-A03

- [ ] Completar reportes diarios, semanales y mensuales.
- [ ] Registrar tiempos con precisión HH:MM:SS.
- [ ] Separar horas ordinarias, excesos técnicos y horas extras autorizadas; no inferir pago ni autorización.
- [ ] Agregar exportación de informes y trazabilidad.
- [ ] Vincular marcaciones históricas con relaciones laborales **verificadas**, sin asociaciones automáticas por nombre o ID legado.

**Dependencia:** la conciliación de históricos requiere revisión privada y autorización caso por caso (issue #16). **Estado:** seleccionado, sin PR funcional creado.

## 4. Seguridad — pendiente de selección

- [ ] Verificar permisos Root, administradores y trabajadores.
- [ ] Aislar información por empresa, local y terminal.
- [ ] Proteger reportes, documentos y exportaciones.
- [ ] Auditar cambios y accesos.
- [ ] Validar integridad y conservación de registros.

## 5. Continuidad operativa — pendiente de selección

- [ ] Definir procedimiento cuando no hay conexión.
- [ ] Implementar sincronización segura sin duplicar marcas.
- [ ] Establecer respaldos automáticos y recuperación probada.
- [ ] Definir infraestructura central, disponibilidad y retención histórica.
- [ ] Probar fallas de conexión, recuperación y actualización manual.

## 6. Certificación — pendiente de selección

- [ ] Completar matriz de cumplimiento de la DT.
- [ ] Implementar acceso fiscalizador y consultas exigidas.
- [ ] Preparar evidencia técnica, pruebas y documentación.
- [ ] Realizar auditoría y certificación por tercero independiente.
- [ ] Tramitar autorización ante la Dirección del Trabajo.

## Seguimiento de ejecución

| Bloque | Seleccionado para el 12-11 | PR real | Estado |
|---|---:|---|---|
| PR-A01: Comprobantes | 4/4 | [#28](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/28) | Borrador: 2 ítems implementados y 2 con brechas |
| PR-A02: Rectificaciones | 4/4 | Sin crear | Planificado |
| PR-A03: Reportes | 5/5 | Sin crear | Planificado |
| Seguridad | 0/5 | — | Pendiente |
| Continuidad operativa | 0/5 | — | Pendiente |
| Certificación | 0/5 | — | Pendiente |

**Ejecución:** revisar código y brechas → rama por bloque → implementación y tests con datos sintéticos → revisión/CI y pruebas necesarias → aprobación → fusión a `main` → actualizar **este mismo documento** con número real de PR, SHA y casillas respaldadas por evidencia. Los identificadores PR-A01/A02/A03 son nombres de trabajo, no PR existentes.

**Puertas obligatorias:** las comprobaciones de permisos, acceso y privacidad pertinentes son obligatorias desde cada PR, aunque la fase 4 quede programada para después. No publicar datos de trabajadores ni respaldos, no modificar SQLite real ni desplegar a producción automáticamente. Conservar `Actualizar.bat` como actualización **manual** y respaldo previo. No declarar conformidad de asistencia ante DT sin certificación y autorización.

**Referencia:** [Matriz DT](36-MATRIZ-DT-ARQUITECTURA-INTEGRACION-20261111.md) · [Consolidación y pendientes](40-CONSOLIDACION-RAMAS-Y-PENDIENTES-20261112.md) · [Criterios de pruebas](06-PRUEBAS-Y-ACEPTACION.md) · [QR aprobado en PR #26](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/26).
