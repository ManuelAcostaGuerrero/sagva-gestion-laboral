# 12. Registro de avances verificables

Este documento debe mantenerse al día **después de resultados observados**, nunca para declarar un trabajo futuro como realizado. Un PR puede formar parte de un hito, pero no equivale a haberlo completado.

| Hito | Estado al 02-11-2026 | Evidencia disponible | Responsable de aceptación |
|---|---|---|---|
| INT-000 Documentación y reglas | Publicada; revisión del propietario pendiente | Commit `fe08da0c6cc89e80f25a8bacfcb01580fa7109a3` y readback en main | Propietario (revisión) |
| INT-001 Huella base | **Código/CI en rama de prueba; NO APROBADO** | `api.js` incorporado con SHA original; los 3 recursos restantes se preparan solo en PC; dos CI verdes en `652a1783`; PR #1 borrador; usuario reporta arranque local, sin paridad completa acreditada | Propietario |
| INT-002 Paridad Huella + ensayo privado | **NO INICIADO FORMALMENTE** | Sin matriz de paridad/ensayo privado integral aprobada. La instalación reportada y CI del INT-001 no satisfacen esta fase | Propietario |
| INT-003 Conciliación personas Propinas | **BLOQUEADO por INT-002** | Sin conciliación ni matriz privada autorizadas; no unificar trabajadores todavía | Propietario |
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

## Evidencia histórica de incorporación parcial INT-001 (01-11-2026)
- Fuente: `ManuelAcostaGuerrero/asistencia-huella-digital` `main` commit `fe1f797c3a15ed436899f52cd94063f94db23344` (v1.19.2).
- Destino: rama `int001-huella-codigo` de `sagva-gestion-laboral`, todavía sin aprobar.
- Copiados 187/191 archivos de código/recursos de Huella seleccionados y **SHA de blob idénticos** al origen. Faltantes: `client/src/services/api.js`, imagen del logo y dos archivos vendor DigitalPersona. Ver `docs/13-INT-001-INCORPORACION-CODIGO.md`.
- No ejecutadas pruebas en PC, build, npm install, tests ni validación visual. No hay bases ni trabajadores reales incorporados.
- **Estado real: trabajo parcial, no declarar INT-001 completo.**

## Rectificación de estado y secuencia (02-11-2026)
- La fotografía inicial de 187/191 archivos y 4 faltantes, indicada arriba, es **histórica del 01-11**, no el estado actual. Posteriormente se incorporó `client/src/services/api.js` idéntico al original; el logo y las dos bibliotecas DigitalPersona se dejaron para provisionamiento **solo local**, sin redistribuirlos públicamente.
- GitHub Actions aprobó servidor y compilación en `652a1783a3a8d06cf2c3aed2451dbd5a4c93ba86`, después del cambio del ojito. PR #1 sigue en borrador, sin fusionar a `main`.
- El propietario reportó haber instalado/abierto una copia local. **No existe evidencia completa registrada de paridad funcional/visual, ensayo privado restaurable o aprobación INT-002**. Se mantiene INT-001 sin cierre e INT-002 no iniciado formalmente.
- Se corrigió una recomendación prematura de iniciar INT-003: **la conciliación de trabajadores de Propinas no corresponde todavía**. Primero documentar y acreditar las funciones, pantallas, credenciales, QR/PIN, permisos, documentos, licencias, planificador y restauración exigidos para INT-002. No importar datos reales ni compartir identidades por GitHub.
- Nueva regla de trabajo: criterio independiente y control de fases en `AGENTS.md` (decisión D-016). No confundir la aceptación de una idea futura con autorización o conveniencia de ejecutarla de inmediato.
