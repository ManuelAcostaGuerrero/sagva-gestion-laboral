# 12. Registro de avances verificables

Este documento debe mantenerse al día **después de resultados observados**, nunca para declarar un trabajo futuro como realizado. Un PR puede formar parte de un hito, pero no equivale a haberlo completado.

| Hito | Estado al 01-11-2026 | Evidencia disponible | Responsable de aceptación |
|---|---|---|---|
| INT-000 Documentación y reglas | Publicada; revisión del propietario pendiente | Commit `fe08da0c6cc89e80f25a8bacfcb01580fa7109a3` y readback en main | Propietario (revisión) |
| INT-001 Huella base | No iniciado | Ninguna | Propietario |
| INT-002 Paridad Huella + ensayo privado | No iniciado | Ninguna | Propietario |
| INT-003 Conciliación personas Propinas | No iniciado | Ninguna (matriz siempre privada) | Propietario |
| INT-004 Base PostgreSQL única | No iniciado | Ninguna | Propietario |
| INT-005 Módulo Propinas | No iniciado | Ninguna | Propietario |
| INT-006 Rescate/validación final | No iniciado | Ninguna | Propietario |
| v1.0.0 Producto estable | No liberada | Ninguna | Propietario |

## Plantilla para registrar cada entrega
### INT-NNN — título concreto
- **Estado:** pendiente / en trabajo / bloqueado / en pruebas / aprobado.
- **Inicio, cierre:** fechas efectivas.
- **Orígenes usados:** repo, rama, SHA, versiones.
- **PR/commits:** enlaces reales.
- **Resultado funcional:** qué se probó y en qué entorno.
- **Pruebas:** comandos, test negativo, Windows/Linux/móvil, CI, resultado.
- **Datos:** solamente sintéticos o ensayo privado; jamás incluir registros reales.
- **Paridad UI y cálculos:** evidencia/criterio satisfecho.
- **Respaldo/rollback:** qué restauración se ensayó.
- **Limitaciones y fallos pendientes:** detallar.
- **Aprobación del propietario:** fecha y contexto verificable.

## Log de decisiones de publicación
- 2026-11-01: documentación publicada y comprobada en `main`, commit `fe08da0c6cc89e80f25a8bacfcb01580fa7109a3`. El propietario aún debe revisarla. No hay avances funcionales implícitos.
