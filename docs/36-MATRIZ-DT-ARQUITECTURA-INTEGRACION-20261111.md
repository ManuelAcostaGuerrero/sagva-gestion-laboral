# SAGVA Gestión Laboral — integración estructural y matriz DT 38/2024

**Fecha:** 11-11-2026. **Alcance:** rama de ensayo `feat/dt-integracion-validacion-20261111`, derivada de P3 (PR #20), que depende de P2 (PR #19); no fusionar a `main` ni desplegar sin cumplir las puertas de salida. **Estado jurídico: NO CERTIFICADO / NO AUTORIZADO POR DT.**

## Fuentes oficiales, alcance y decisión

- [Código del Trabajo, art. 33 (BCN)](https://www.bcn.cl/leychile/navegar?idNorma=207436): controlar asistencia/horas y autorización de plataforma electrónica por DT.
- [Resolución Exenta 38/2024, texto actualizado (BCN)](https://www.bcn.cl/leychile/navegar?idNorma=1203415): requisitos de sistema electrónico de asistencia.
- [DT: Ley 21.561, reducción 44/42/40](https://www.dt.gob.cl/portal/1628/w3-article-125909.html): máximo ordinario general por fecha.
- [DT ORD. 737 de 11-11-2025](https://www.dt.gob.cl/legislacion/1624/w3-article-128557.html): certificación por tercero independiente y posterior autorización por DT.
- [DT ORD. 408 de 11-09-2026](https://www.dt.gob.cl/legislacion/1624/w3-article-129729.html): geolocalización no puede bloquear la marcación por estar fuera del radio.

**Criterio legal:** un sistema internamente funcional no está por ello autorizado para sustituir un libro, reloj control u otro método de asistencia admitido. Mantener un medio vigente/permitido hasta disponer de la autorización del sistema electrónico. Cualquier parámetro de convenios, regímenes excepcionales, contratos de jornadas inferiores o empresas multi-RUT debe revisarse con documentos; no inferirlos desde registros históricos.

## Fase A — arquitectura consolidada en rama de integración

| Objeto | Modelo ensayado | Límite actual |
|---|---|---|
| Persona | `employees.id` estable; ficha legal y cambios auditados | Fichas existentes no son múltiples empleos; no inferir RUT ni duplicados |
| Empresa/local | `company_profiles`, nuevas `company_branches` | Falta UI de locales y aislamiento integral por empresa/terminal |
| Relación laboral | `employment_relationships` | Sólo relaciones confirmadas; nueva tabla vacía |
| Cargo/área | `work_positions`, `work_areas`, `employment_assignments` por vigencia | Falta flujo autorizado de altas/cambios y conciliación |
| Contrato/jornada | `employee_contract_terms` y nueva `employment_terms_versions` | No reemplazar snapshots firmados ni salarios de otra fecha |
| Turnos | `work_shifts`, planificador/calendario | No confundir turno programado con pacto contractual |
| Marcación | `attendance_records` y `attendance_employment_links` confirmados | Falta cadena probatoria por marca y mecanismo DT de rectificaciones |
| Horas extras | Indicador de exceso técnico `overtimeMinutes` en reportes | **No equivale a pacto escrito, autorización ni pago** |
| AFP y salud | `labor_entities`, `employee_prevision_versions` | No hay backfill validado desde JSON |
| Permisos/documentos | Root, controles por permiso, historial y PDF | Alcance multiempresa/DT aún no verificado |
| Auditoría | `audit_logs` y cambios versionados | Se requiere garantía integral, evidencias inmutables y exportaciones |

**Prohibiciones:** no borrar marcaciones, anexos, PDFs o auditorías; no editar claves; no declarar históricos reconciliados si las relaciones nuevas están vacías; no mezclar Propinas/Pagos.

## Fase B — matriz inicial de conformidad (estado de ingeniería, NO dictamen jurídico)

Las categorías son `PARCIAL`, `NO_IMPLEMENTADO` y `NO_DEMOSTRADO`. Ningún ítem es `CONFORME_DT` sin prueba independiente.

| ID | Exigencia y referencia | Estado | Evidencia de código actual y acción necesaria | Prioridad |
|---|---|---|---|---|
| DT-01 | Art. 33 CT: autorización | NO_DEMOSTRADO | Certificación de tercero y resolución de autorización DT todavía no aportadas | **Bloqueante** |
| DT-02 | Res. 38 art. 8: hash/checksum de cada marca y verificación web | NO_IMPLEMENTADO | `token.routes.js` graba `attendance_records` y audita, pero no emite hash público verificable por registro; diseñar protección criptográfica real y prueba contra adulteración | **Bloqueante** |
| DT-03 | Res. 38 arts. 9-10: transmisión central y contingencia | NO_DEMOSTRADO | SQLite local; definir transmisión online y cola offline segura con antirreplay y sincronización comprobada | **Bloqueante** |
| DT-04 | Res. 38 arts. 12-13: comprobante con datos exigidos | PARCIAL | Existe notificación tras marcar, pero sin evidencia completa de comprobante, contenido, firma/hash y entrega consistente | **Bloqueante** |
| DT-05 | Res. 38 art. 14: seguridad, replicación y continuidad | NO_DEMOSTRADO | `Respaldar.bat` local ayuda a preservar, pero no demuestra plataforma de alta disponibilidad, servidores replicados ni retención de cinco años | **Bloqueante** |
| DT-06 | Res. 38 arts. 22-23: portal DT remoto y accesos | NO_IMPLEMENTADO | Root ≠ portal fiscalizador. Diseñar autenticación DT, consulta y registros de acceso según resolución, sin inventar cuentas oficiales | **Bloqueante** |
| DT-07 | Res. 38 art. 27: reportes diarios/semanales auditables | PARCIAL | Existen reportes de asistencia, pero estructura, precisión y exportaciones normativas no están acreditadas | **Bloqueante** |
| DT-08 | Res. 38 arts. 39-40: rectificación con aviso, oposición y 48 horas | PARCIAL | Hay marca manual y anulación auditada, pero falta flujo legal completo, notificación y conservación de versiones/oposición | **Bloqueante** |
| DT-09 | Res. 38 art. 44: contabilizar HH:MM:SS | PARCIAL | `attendanceReport.js` reduce a minutos; incorporar precisión en segundos sin redondear antes de reportar | Alta |
| DT-10 | Res. 38 arts. 36 y 38: marcación voluntaria y sin bloqueos improcedentes | NO_DEMOSTRADO | Verificar QR/PIN/terminal, cuenta desactivada, ubicación, conexión y contingencias para no impedir injustificadamente la marca | **Bloqueante** |
| DT-11 | Res. 38 art. 45.2: alerta de jornada excesiva no bloqueante | PARCIAL | Nueva evaluación normativa por fecha disponible en `/api/contract-terms/jornada/assessment`; falta conectarla a todos los formularios y casos especiales | Alta |
| DT-12 | Ley 21.561: 44 h 2024, 42 h 2026, 40 h 2028 (general) | PARCIAL | `dt_jornada_normative_versions` mantiene reglas versionadas, test de fechas y alerta; no actualiza contratos históricos ni asume régimen general para todos | Alta |
| DT-13 | Res. 38 arts. 42-43: descuentos/compensación de horas extraordinarias | NO_IMPLEMENTADO | No clasificar exceso como pago; implementar pactos/compensaciones y aprobaciones sin descuento diario automático | Alta |
| DT-14 | Res. 38 art. 58: disponibilidad histórica de cinco años | NO_DEMOSTRADO | Respaldo local no equivale a repositorio histórico consultable seguro; diseñar políticas de retención/exportación | **Bloqueante** |
| DT-15 | Auditoría de permisos, empresa y documentos | PARCIAL | `securityPermissions.js`, `audit_logs` presentes; probar aislamiento de cada endpoint y PDF entre empresas distintas | Alta |
| DT-16 | Art. 47: generación y firmas de documentos laborales | PARCIAL | Hay adjuntos PDF y aprobación de anexos de sueldo; faltan flujos generales con firma, trazabilidad y evidencia | Alta |

Los artículos citados definen el trabajo a revisar; la conformidad formal depende del texto vigente, pruebas sobre la solución completa y de la certificadora independiente.

## Jornada general versionada — desarrollo en esta rama

`server/src/dtJornadaNormativa.js` crea tabla con vigencia histórica 45 h hasta 25-04-2024, 44 h desde 26-04-2024, 42 h desde 26-04-2026, 40 h desde 26-04-2028. La consulta interna `assessWeeklyOrdinaryHours` y el endpoint autenticado `GET /api/contract-terms/jornada/assessment?on=2026-11-11&weeklyHours=45&regime=GENERAL` **advierten**, no rechazan la carga. `regime=SPECIAL` y `regime=EXEMPT` responden sin determinar conformidad, exigiendo revisión particular. Se conserva el esquema versionado, sin cambios automáticos a contratos.

## Fase C — procedimiento de reconstrucción segura

1. Verificar ruta, rama, aplicación real y respaldo offline consistente de SQLite, WAL, PDF, auditorías, Root y configuración, sin publicar secretos.
2. Ensayar restauración y comprobar `integrity_check`, `foreign_key_check`, documentos, conteos, hashes de respaldos y muestras históricas.
3. Crear **nueva base de pruebas aislada**, nunca sobrescribir `data/asistencia.db` productiva. Datos sintéticos inicialmente; personas reales sólo mediante carga manual controlada del propietario si lo autoriza.
4. Conciliar identificadores antiguos y nuevas relaciones por evidencia: conservar el registro original y las decisiones humanas, sin inventar fechas o causas de término.
5. Ensayar creación de perfiles, contratos, jornadas y empresas desde cero, con revisión negativa para duplicados, jurisdicciones múltiples y recontrataciones.
6. La transición productiva requiere ventana aprobada, plan de reversión, documentación de respaldo y conservación histórica; no permitir que una base nueva esconda registros de asistencia anteriores.

## Fase D — pruebas exigidas

**Automatizadas:** migraciones P2/P3 y reglas DT idempotentes; relaciones vigentes, fechas límite, valores legales, FK, solapamientos, seguridad de rutas y no pérdida de históricos. **Pendientes:** pruebas presenciales Windows/Android, horarios nocturnos y cambios de hora de Chile, cortes de red/reintentos, manipulación de marcaciones, correo trabajador/48 h, reportes DT, alta disponibilidad y performance.

La simulación fiscalizadora debe tener cuentas ficticias de prueba y datos sintéticos; nunca hacerse pasar por personal real de la DT ni inventar un sello de aprobación. Un reporte sin algún requisito bloqueante verificado se marca `NO APTO PARA CERTIFICACIÓN`.

## Fase E — entregables y puertas de salida

- Rama de integración + PR **en borrador**, documentación, tests y esquema normalizado sin backfill.
- Hoja de ruta implementable por control DT-01..DT-16 con evidencia y responsable; no cerrar un control simplemente porque exista una tabla o endpoint.
- Entrega de manual Windows y procedimiento de respaldo/restauración cuando se completen pruebas físicas.
- **No fusionar a main, no ejecutar Actualizar.bat para P2/P3, no sustituir el sistema oficial de asistencia, no borrar historiales.**
- Aprobación explícita para producción y proceso separado de certificación externa y autorización de la DT.

## Decisión de arquitectura

La instalación SQLite local sigue siendo útil para desarrollo y pruebas, pero **no demuestra por sí sola** cumplimiento de los requisitos de transmisión a servidor central, replicación, contingencia y fiscalización remota. La elección del proveedor/infrastructura de producción debe hacerse en etapa separada, con evidencia de disponibilidad, seguridad y costos. No afirmar que cambiar de motor a PostgreSQL resuelve por sí solo el cumplimiento DT.
