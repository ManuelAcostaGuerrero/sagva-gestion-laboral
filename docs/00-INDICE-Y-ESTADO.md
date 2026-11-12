> **Plan de Asistencia del 12-11-2026:** [Comprobantes, rectificaciones, reportes y fases posteriores](42-PLAN-TRABAJO-ASISTENCIA-20261112.md). 13 subtareas seleccionadas para desarrollar, no completadas.

> **A01 en revisión:** [PR #28: comprobantes de marcación](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/28) y [detalle técnico, pruebas y pendientes](43-A01-COMPROBANTES-20261112.md). No fusionado ni certificado.

> **Estado vigente al 12-11-2026:** consultar [Consolidación de ramas, alcance y pendientes](40-CONSOLIDACION-RAMAS-Y-PENDIENTES-20261112.md). El plan antiguo de Propinas e integración de una base maestra conjunta **queda aplazado**; no bloquea SAGVA Gestión Laboral. Las secciones anteriores permanecen como registro histórico.

# 00. Índice maestro y estado del proyecto

**Actualizado: 09-11-2026.** Se distingue evidencia del repositorio, pruebas reportadas por el propietario y puertas INT todavía abiertas. [Cierre funcional y hoja de ruta](24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md).

| Campo | Situación |
|---|---|
| Producto | SAGVA Gestión Laboral |
| Repositorio | `ManuelAcostaGuerrero/sagva-gestion-laboral` |
| Visibilidad | Público (verificado al iniciar documentación) |
| Propósito principal | Gestión de Personal y Control de Asistencia |
| Complemento | Propinas |
| Fuentes funcionales | Huella 1.19.2; Propinas 4.4.0 (referencias documentales iniciales) |
| Legado de consulta | `sagva-gestion-integral`; no es fuente de UX |
| Base original de Huella | SQLite, carpeta privada local `data/asistencia.db` |
| Base original de Propinas | SQLite, carpeta privada local `data/propinas.db` |
| Base objetivo final | **Una PostgreSQL** con dominios separados y persona maestra única |
| Versión de integración | Huella INT-001 + Entrega 1 + Entrega 2 + Contabilidad Laboral integradas a `main`; último SHA de funcionalidad `281b9182d186` |
| Aplicación copiada al repo nuevo | **SÍ:** Huella base integrada en PR #1; mejoras PR #4, #7 y #8. Recursos privados permanecen solo en PC |
| Datos reales importados | **NO** |
| Paridad funcional acreditada | **Parcialmente reportada** por propietario para las entregas recientes; paridad completa con Huella original y restauración independiente `INT-002` **no acreditadas** |
| Pruebas CI acreditadas en repo nuevo | **SÍ:** últimas verificaciones de servidor/web y QR móvil correctas en `281b9182d186` (Actions `42560860962`, `42560860965`); CI no demuestra restauración privada ni paridad total |
| Instalación local del repo nuevo | El propietario **reportó** pruebas de Windows, datos persistentes y módulos laborales; verificó acceso móvil mediante HTTPS y aprobó la Fase 3 funcional reciente. Falta acta de paridad/restore INT completa |
| Despliegue productivo | **NO AUTORIZADO** |

## Documentos obligatorios
1. [Objetivo, alcance, módulos y arquitectura](01-OBJETIVO-Y-ALCANCE.md).
2. [Fases INT y puertas de aceptación](02-PLAN-DE-INTEGRACION.md).
3. [Inventario y paridad de interfaces/funciones](03-PARIDAD-FUNCIONAL.md).
4. [Datos únicos y conciliación privada](04-DATOS-Y-CONCILIACION.md).
5. [Seguridad, secretos, copias y restauración](05-SEGURIDAD-Y-RESPALDOS.md).
6. [Pruebas y criterios de aceptación](06-PRUEBAS-Y-ACEPTACION.md).
7. [Versiones INT y X.Y.Z](07-VERSIONADO-Y-CAMBIOS.md).
8. [Operación local, migración y despliegue](08-OPERACION-Y-DESPLIEGUE.md).
9. [Rescate selectivo del sistema anterior](09-RESCATE-DE-LEGADO.md).
10. [Decisiones aprobadas y asuntos pendientes](10-DECISIONES-Y-PENDIENTES.md).
11. [Guía ejecutable de planificación INT-001](11-INT-001-PASO-A-PASO.md).
12. [Registro de hitos y evidencia](12-REGISTRO-DE-HITOS.md).
13. [Auditoría previa de campos de ficha y orden de mejoras D-018 a D-021](16-AUDITORIA-CAMPOS-FICHA-Y-PLAN-20261104.md).
14. [Requisitos de empresas, RUT, territorios Chile y nombre completo D-023 a D-027](17-EMPRESAS-RUT-DIRECCIONES-Y-FICHA-20261104.md).
15. [Hallazgos de empresa, RUT médico, fechas y direcciones del trabajador D-028 a D-031](18-HALLAZGOS-FICHAS-EMPRESAS-DOCUMENTOS-20261104.md).
16. [Anexo de aumento salarial, lugar de prestación y RUT en Áreas D-032 y D-033](19-ANEXOS-SUELDO-LUGAR-PRESTACION-RUT-AREAS-20261104.md).
17. [Aclaración salarial, sucursal, previsión y planificación legal D-034 a D-038](20-ETIQUETAS-SUELDO-SUCURSAL-PREVISION-Y-PLANIFICACION-20261104.md).
18. [Entrega 1 integrada: Personal/Empresas](21-ENTREGA1-IMPLEMENTACION-20261108.md).
19. [Entrega 2 integrada: Contratos/anexos](22-ENTREGA2-CONTRATOS-20261109.md).
20. [Actualizador local manual](23-ACTUALIZADOR-LOCAL-20261108.md).
21. [Contabilidad Laboral y previsión](23-CONTABILIDAD-LABORAL-20261109.md).
22. [Cierre funcional reciente, pruebas móviles y hoja de ruta](24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md).
23. [Plan para 10-11-2026: configurador de campos y segregación root/contabilidad/admin local](25-PLAN-CONTABILIDAD-LABORAL-CAMPOS-Y-PERMISOS-20261110.md).
26. [BL-001 a BL-005: implementación, pruebas CI y límites operativos](28-BL001-BL005-IMPLEMENTACION-EN-REVISION-20261109.md).
24. [Bitácora consolidada de ficha, cuentas, bancos, cargas y auditoría](26-BITACORA-FICHA-BANCOS-CARGAS-AUDITORIA-20261109.md).
25. [Plan de acción por entregas: roles, bitácora, ficha, catálogos y autoregistro](27-PLAN-ACCION-FICHA-CAMPOS-BANCOS-CARGAS-AUDITORIA-20261109.md).

Operación de asistentes: [AGENTS.md](../AGENTS.md). Cambios: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Semáforo de avance — corte 09-11-2026
- **Entregas funcionales 1 y 2 y Contabilidad Laboral:** integradas y aprobadas en la revisión funcional reciente; PR #4, #7, #8.
- **Fase 3 de validación reciente:** **aprobada por propietario** para Windows, módulos laborales y apertura móvil HTTPS; detalles responsivos menores pendientes.
- `INT-000`: documentación publicada; mantenimiento de trazabilidad continuo.
- `INT-001`: código de Huella y mejoras integrado; falta acta de aceptación de puerta INT original.
- `INT-002`: pruebas funcionales parciales comunicadas, pero **faltan matriz de paridad frente a Huella y restauración privada independiente**, por lo que no está cerrado.
- `INT-003` a `INT-005`: **aplazados expresamente**; no conciliación Propinas ni migración PostgreSQL.
- `INT-006`: pendiente. `v1.0.0`: **no liberada**. Producción: **no autorizada**.
- **Estudio futuro:** superadministrador `root`, cargas familiares, maternidad/subsidios y remuneraciones automáticas. **No implementados**.

**No confundir aprobación funcional reciente con aceptación técnica integral de las etapas INT.** Detalle y evidencias: [documento 24](24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md).

## Actualización de implementación BL-001 a BL-005 (09-11-2026)

La [integración por PR #9, ya fusionado en `main`](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/9) contiene nueva ficha subdividida, bancos, datos bancarios cifrados, cargas familiares y tramos históricos. Las pruebas GitHub fueron verdes en el SHA funcional `d323d6db95e5ff2a3ea4469ecec20e9fa945e1e8`. **Esta anotación describe código y CI, NO aceptación física Windows/móvil ni despliegue productivo**. [Informe](28-BL001-BL005-IMPLEMENTACION-EN-REVISION-20261109.md).

28. [Etapa 2: perfiles Root/Contabilidad y concesiones individuales, con activación local segura](30-ETAPA2-ROOT-PERMISOS-20261110.md). En PR pendiente de revisión.

29. [Etapa 3: campos complementarios versionados para ficha y contrato](31-ETAPA3-CAMPOS-CONFIGURABLES-20261110.md). En PR pendiente de revisión y pruebas físicas.
