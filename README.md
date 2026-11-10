# SAGVA Gestión Laboral

**Sistema modular de gestión de personal y control de asistencia.** El módulo de Propinas es complementario, no el núcleo del producto.

> **Estado al 09-11-2026:** Huella base, Entregas 1 y 2 y Contabilidad Laboral integradas en `main`, con CI aprobado; el propietario reportó pruebas Windows y acceso móvil HTTPS y aprobó la fase funcional reciente. **No** se ha acreditado la restauración/paridad completa `INT-002`, ni integrado Propinas/PostgreSQL, ni autorizado producción o versión `v1.0.0`. [Cierre y hoja de ruta](docs/24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md). [Plan de trabajo del 10-11-2026: campos, root y contabilidad](docs/25-PLAN-CONTABILIDAD-LABORAL-CAMPOS-Y-PERMISOS-20261110.md).

## Objetivo

Un único sistema con módulos y subcategorías, un único registro maestro de cada trabajador y una futura base de datos central PostgreSQL, sin alterar el comportamiento y las pantallas originales que ya funcionan.

| Módulo | Subcategorías previstas | Fuente funcional |
|---|---|---|
| Personal | Trabajadores, ficha general, contratos, documentos, licencias y ficha médica | Asistencia Huella Digital |
| Asistencia | Marcaciones QR/PIN, terminales, horario semanal, turnos, reportes e historial | Asistencia Huella Digital |
| Administración | Empresas/locales, usuarios, roles/permisos, áreas/cargos, auditoría | Huella + mejoras técnicas aprobadas |
| Propinas (extra) | Planillas, semanas, participación diaria, cálculo, cierre, entregas, respaldos | Propinas Local |

**Regla UX:** la organización del menú puede evolucionar con aprobación; **no rediseñar ni recortar las pantallas y flujos originales**. No convertir dos programas en pantallas simplificadas sin paridad demostrada.

## Orígenes, que deben permanecer intactos

- [Asistencia Huella Digital](https://github.com/ManuelAcostaGuerrero/asistencia-huella-digital), referencia funcional inicial v1.19.2, React/Vite + Express + SQLite; archivo local habitual `data/asistencia.db`.
- [Propinas Local](https://github.com/ManuelAcostaGuerrero/propinas-local), referencia funcional inicial v4.4.0, Node + SQLite; archivo local habitual `data/propinas.db`.
- [SAGVA Gestión Integral](https://github.com/ManuelAcostaGuerrero/sagva-gestion-integral), legado **solo para rescate selectivo posterior**. No reutilizar su interfaz como base.

**Fuera de alcance:** Reparto/Delivery y Sagva-System (ERP/ventas). Un área de personal llamada DELIVERY no implica integrar la aplicación de Reparto.

## Orden obligatorio

1. `INT-001` Copia limpia de Huella original; probar que ejecuta igual, con base sintética.
2. `INT-002` Pruebas de paridad de Huella y ensayo de restauración privada en PC autorizada.
3. `INT-003` Inventario/conciliación de personas de Propinas con confirmación **individual del propietario**.
4. `INT-004` Esquema canónico y migración ensayada, segura y repetible hacia PostgreSQL.
5. `INT-005` Incorporación de Propinas sin cambios en su algoritmo, interfaz ni semanas históricas.
6. `INT-006` Evaluación/rescate selectivo de componentes del legado y validación completa.

Cada fase tiene puertas de salida; el orden no autoriza saltar pruebas. Las fases pueden dividirse en entregas menores con evidencia, sin prometer hitos que no se han realizado.

**Numeración:** `INT-NNN` mientras se integra; después de aprobación completa, iniciar `v1.0.0`. Regla propia `X.Y.Z`: **X** nuevas funciones, **Y** mejoras visuales autorizadas, **Z** errores/código corregido. Más detalle: [versionado](docs/07-VERSIONADO-Y-CAMBIOS.md).

## Índice de documentación

**Estado y cierre recientes:** [Fase 3 aprobada y pendientes](docs/24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md). Empieza en [docs/00-INDICE-Y-ESTADO.md](docs/00-INDICE-Y-ESTADO.md). Para el primer trabajo técnico, sigue [docs/11-INT-001-PASO-A-PASO.md](docs/11-INT-001-PASO-A-PASO.md). Agentes, colaboradores y Work deben leer [AGENTS.md](AGENTS.md).

## Plan vigente de próximas mejoras (09-11-2026)

- [Bitácora de decisiones: ficha, cuenta bancaria, bancos, cargas y auditoría](docs/26-BITACORA-FICHA-BANCOS-CARGAS-AUDITORIA-20261109.md).
- [Plan de acción: seguridad Root, auditoría, formularios y autoregistro](docs/27-PLAN-ACCION-FICHA-CAMPOS-BANCOS-CARGAS-AUDITORIA-20261109.md).
- [BL-013: registro de bonos pactados y asignación por pérdida de caja, sin liquidaciones](docs/29-BONOS-REGISTRO-SIN-CALCULO-20261110.md).

**Planificación, no implementación:** no se han instalado estas funcionalidades, y la bitácora operativa existente requiere ampliar su cobertura.

**Integrado en `main` (PR #9):** [BL-001 a BL-005: ficha, bancos, cargas familiares y parámetros](docs/28-BL001-BL005-IMPLEMENTACION-EN-REVISION-20261109.md). CI correcto; pendiente validación física y panel Root futuro.

## Datos y seguridad

Este es un **repositorio público solo de código y documentación no sensible**. Las bases SQLite reales, la conciliación nominal de trabajadores, contratos, RUT, antecedentes médicos, PDFs, imágenes de documentos, sesiones, secretos, exportaciones y respaldos **jamás se suben aquí**, ni a incidencias, PR, CI o logs. La fuente real vive en almacenamiento privado autorizado.

**Sin afirmaciones falsas:** una copia de código no contiene por sí sola los empleados/empresas reales. Antes de integrar la información se necesita respaldo consistente y restauración comprobada. No tocar las bases operativas originales.
