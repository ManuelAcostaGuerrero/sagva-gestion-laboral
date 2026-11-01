# 00. Índice maestro y estado del proyecto

**Actualizado: 01-11-2026.** Estado declarado aquí = hechos verificados, no intención ni calendario.

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
| Versión de integración | `INT-000`, solo documentación |
| Aplicación copiada al repo nuevo | **NO** |
| Datos reales importados | **NO** |
| Paridad funcional acreditada | **NO** |
| Pruebas CI acreditadas en repo nuevo | **NO** |
| Instalación local del repo nuevo | **NO VERIFICADA** |
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

Operación de asistentes: [AGENTS.md](../AGENTS.md). Cambios: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Semáforo de avance
- `INT-000` Documentación y gobernanza: **publicada y verificada en `main`**, pendiente de revisión del propietario. Evidencia: commit `fe08da0c6cc89e80f25a8bacfcb01580fa7109a3`.
- `INT-001` Huella copiada íntegra y probada: pendiente.
- `INT-002` Restauro privado y paridad integral Huella: pendiente.
- `INT-003` Identidad/conciliación Propinas: pendiente, requiere propietario.
- `INT-004` PostgreSQL único y migración: pendiente.
- `INT-005` Propinas integrada y paridad monetaria: pendiente.
- `INT-006` Rescate y validación general: pendiente.
- `v1.0.0`: no liberada.

**No marcar un hito terminado por abrir un PR, fusionarlo, compilar o enseñar una pantalla.** El hito exige pruebas y conformidad explícita de lo que involucra.
