# 00. Índice maestro y estado del proyecto

**Actualizado: 03-11-2026.** Estado declarado aquí = hechos verificados, no intención ni calendario.

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
| Versión de integración | Código de `INT-001` fusionado a `main` mediante PR #1; aceptación funcional todavía pendiente |
| Aplicación copiada al repo nuevo | **SÍ, disponible en `main`** tras merge `a23de9b4164b975d2589091782c7a5d4a538f0f5` (03-11-2026); tres recursos originales se provisionan solo en PC |
| Datos reales importados | **NO** |
| Paridad funcional acreditada | **NO** |
| Pruebas CI acreditadas en repo nuevo | **SÍ, servidor/compilación y QR móvil** en `fccf017d3` (Actions `41663786088`, `41663785995`); no equivalen a validación funcional integral |
| Instalación local del repo nuevo | **Instalación/arranque reportados por el propietario; paridad y pruebas locales completas aún no acreditadas** |
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

Operación de asistentes: [AGENTS.md](../AGENTS.md). Cambios: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Semáforo de avance
- `INT-000` Documentación y gobernanza: **publicada y verificada en `main`**, pendiente de revisión del propietario. Evidencia: commit `fe08da0c6cc89e80f25a8bacfcb01580fa7109a3`.
- `INT-001` Huella base: **código incorporado a `main`, CI aprobado y PR #1 fusionado**, por solicitud expresa del propietario; **pruebas funcionales integrales y aceptación del hito pendientes**.
- `INT-002` Ensayo privado y paridad integral Huella: **NO INICIADO FORMALMENTE ni acreditado**; no confundir apertura del sistema o CI verde con este hito.
- `INT-003` Identidad/conciliación Propinas: **BLOQUEADO hasta cerrar INT-002**; la coincidencia de personas requiere validación privada del propietario.
- `INT-004` PostgreSQL único y migración: pendiente.
- `INT-005` Propinas integrada y paridad monetaria: pendiente.
- `INT-006` Rescate y validación general: pendiente.
- `v1.0.0`: no liberada.

**No marcar un hito terminado por abrir un PR, fusionarlo, compilar o enseñar una pantalla.** El hito exige pruebas y conformidad explícita de lo que involucra.
