# SAGVA Asistencia — Plan de trabajo del 12-11-2026

**Repositorio:** `ManuelAcostaGuerrero/sagva-gestion-laboral` · **Base:** `main` (pruebas).  
**Estado:** seguimiento en curso; **seleccionado no equivale a implementado, ni CI aprobado equivale a validación física o legal**.  
**Alcance de hoy:** 13 subtareas en 3 bloques. Las fases 4–6 se conservan para después.

## 1. Comprobantes — PR-A01 (identificador de planificación, no número de GitHub)

- [x] Generar comprobante inmutable de cada marcación nueva; sin retrorelleno histórico (código en PR #28).
- [ ] Completar datos legales, fecha, hora y tipo de marca: estructura implementada; domicilio efectivo/local, régimen excepcional y casos EST pendientes de validación.
- [ ] Entregar comprobante al trabajador y registrar evidencia de entrega: impresión y registro de intento implementados; proveedor requiere configuración y la recepción real aún no está probada.
- [x] Habilitar verificación de integridad y autenticidad: SHA-256 y verificador sin PII; HMAC requiere secreto estable.

**Estado:** [PR #28 fusionado a `main`](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/28) el 12-11-2026 (commit `98a5c522`); tres workflows CI aprobados. [Detalle técnico A01](43-A01-COMPROBANTES-20261112.md). Sigue pendiente la configuración operativa y validación legal de comprobantes, sin certificar DT.

## 2. Rectificaciones — PR-A02

- [ ] Solicitar corrección de una marcación.
- [ ] Notificar al trabajador y gestionar oposición.
- [ ] Implementar plazo y procedimiento de 48 horas según revisión normativa aplicable.
- [ ] Conservar marca original, corrección e historial de auditoría.

**Condición:** no editar ni sobrescribir la marcación original. **Estado:** seleccionado, sin PR funcional creado.

## 3. Reportes — PR-A03

- [x] Reportes diarios, semanales y mensuales por trabajador y mes: desarrollo integrado en PR #29, CI aprobado; pruebas físicas pendientes.
- [x] Registrar tiempos con precisión HH:MM:SS en el motor y en la nueva vista, conservando campos antiguos de minutos: PR #29, CI aprobado.
- [ ] Separar horas ordinarias, excesos técnicos y horas extras **autorizadas**: se muestra exceso técnico sin conferir autorización; falta diseño/revisión legal.
- [x] Exportación CSV autenticada y trazable con identificador, SHA-256 y auditoría: PR #29, CI aprobado; uso en instalación real pendiente.
- [ ] Vincular marcaciones históricas con relaciones laborales **verificadas**, sin asociaciones automáticas por nombre o ID legado: depende de conciliación privada y autorizaciones (issue #16).

**Estado:** [PR #29 fusionado a `main`](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/29) el 12-11-2026 (merge `eb6ad497`); tres workflows aprobados. **Desarrollo 3/5; cierre operacional y legal aún pendiente.** [Detalle A03](44-A03-REPORTES-PERIODOS-SEGUNDOS-20261112.md).

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
| PR-A01: Comprobantes | 4/4 | [#28](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/28) | Fusionado a `main`; 2 ítems implementados y 2 con brechas |
| PR-A02: Rectificaciones | 4/4 | Sin crear | Planificado |
| PR-A03: Reportes | 5/5 | [#29](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/29) | Fusionado a `main`; 3 ítems de desarrollo con CI y 2 por completar (legal / datos reales) |
| Seguridad | 0/5 | — | Pendiente |
| Continuidad operativa | 0/5 | — | Pendiente |
| Certificación | 0/5 | — | Pendiente |

**Ejecución:** revisar código y brechas → rama por bloque → implementación y tests con datos sintéticos → revisión/CI y pruebas necesarias → aprobación → fusión a `main` → actualizar **este mismo documento** con número real de PR, SHA y casillas respaldadas por evidencia. Los identificadores PR-A01/A02/A03 son nombres de trabajo, no PR existentes.

**Puertas obligatorias:** las comprobaciones de permisos, acceso y privacidad pertinentes son obligatorias desde cada PR, aunque la fase 4 quede programada para después. No publicar datos de trabajadores ni respaldos, no modificar SQLite real ni desplegar a producción automáticamente. Conservar `Actualizar.bat` como actualización **manual** y respaldo previo. No declarar conformidad de asistencia ante DT sin certificación y autorización.

**Referencia:** [Matriz DT](36-MATRIZ-DT-ARQUITECTURA-INTEGRACION-20261111.md) · [Consolidación y pendientes](40-CONSOLIDACION-RAMAS-Y-PENDIENTES-20261112.md) · [Criterios de pruebas](06-PRUEBAS-Y-ACEPTACION.md) · [QR aprobado en PR #26](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/26).
