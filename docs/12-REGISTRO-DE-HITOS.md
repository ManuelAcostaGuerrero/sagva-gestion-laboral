# 12. Registro de avances verificables

**Corte vigente: 09-11-2026.** El primer cuadro conserva el estado histórico del 03-11. El avance actual se documenta en la actualización final de este archivo y en el [documento 24](24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md).

Este documento debe mantenerse al día **después de resultados observados**, nunca para declarar un trabajo futuro como realizado. Un PR puede formar parte de un hito, pero no equivale a haberlo completado.

| Hito | Estado original (histórico al 03-11-2026) | Evidencia disponible | Responsable de aceptación |
|---|---|---|---|
| INT-000 Documentación y reglas | Publicada; revisión del propietario pendiente | Commit `fe08da0c6cc89e80f25a8bacfcb01580fa7109a3` y readback en main | Propietario (revisión) |
| INT-001 Huella base | **Código fusionado a main; hito funcional NO APROBADO** | PR #1 fusionado a `a23de9b4`; dos CI verdes en `fccf017d3`; tres recursos privados solo en PC; pruebas funcionales/visuales completas pendientes | Propietario |
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
- GitHub Actions aprobó servidor y compilación en `652a1783a3a8d06cf2c3aed2451dbd5a4c93ba86`, después del cambio del ojito. En esa fecha PR #1 seguía en borrador (estado **histórico**, supersedido por el merge de 03-11-2026).
- El propietario reportó haber instalado/abierto una copia local. **No existe evidencia completa registrada de paridad funcional/visual, ensayo privado restaurable o aprobación INT-002**. Se mantiene INT-001 sin cierre e INT-002 no iniciado formalmente.
- Se corrigió una recomendación prematura de iniciar INT-003: **la conciliación de trabajadores de Propinas no corresponde todavía**. Primero documentar y acreditar las funciones, pantallas, credenciales, QR/PIN, permisos, documentos, licencias, planificador y restauración exigidos para INT-002. No importar datos reales ni compartir identidades por GitHub.
- Nueva regla de trabajo: criterio independiente y control de fases en `AGENTS.md` (decisión D-016). No confundir la aceptación de una idea futura con autorización o conveniencia de ejecutarla de inmediato.

## Reparación de operación local (03-11-2026)
- Se identificaron y retiraron cuatro carpetas QR de ensayo, con archivo privado recuperable; se conserva Huella original y el proyecto INT-001 separado.
- Puertos propios: Huella 4000/5173; Gestión Laboral 4010/5183. Inicio repetido y rechazo real de conflicto sin cerrar otros proyectos comprobados.
- [Informe, SHA exacto, pruebas y límites](15-ORDEN-LOCAL-Y-PUERTOS-20261103.md). Esta reparación no acepta ni cierra INT-001/INT-002 y no inicia INT-003.

## Publicación de código en main (03-11-2026)
- Petición expresa del propietario de implementar los PR de ambos sistemas.
- Huella original: PR #13 fusionado en `main` con commit `0ad30d002b3d6dc2315cd8f89fb39e672c4185ba`; ojo de contraseña con pulsación temporal. CI del HEAD del PR verde.
- SAGVA Gestión Laboral: PR #1 fusionado en `main` con commit `a23de9b4164b975d2589091782c7a5d4a538f0f5`; incluye Huella base, ojo de contraseñas y exportación XLSX/XML; CI del HEAD `fccf017d3` verde.
- **Estado de hitos sin cambio**: INT-001 pendiente aceptación funcional completa; INT-002 no certificado; INT-003 bloqueado. Merge no ejecutó cambios en Windows ni bases de producción; `Actualizar.bat` de Gestión Laboral permanece no habilitado durante INT-001.

## Actualización vigente — 09-11-2026: entregas funcionales y fase 3

- **Entrega 1:** PR #4 fusionado, código de Personal/Empresas/Identidad. CI correcto en `162b8f4a797f`. [Detalle](21-ENTREGA1-IMPLEMENTACION-20261108.md).
- **Entrega 2:** PR #7 fusionado como `f1cff679539e`; contratos, anexos, AFP/Isapre, cierres de ficha y borradores. CI servidor/web + QR móvil correcto. [Detalle](22-ENTREGA2-CONTRATOS-20261109.md).
- **Contabilidad Laboral:** PR #8 fusionado como `281b9182d186`; gestión y edición versionada de previsión, permisos, auditoría y selección en ficha. CI `42560860962` y `42560860965` correctos. [Detalle](23-CONTABILIDAD-LABORAL-20261109.md).
- **Prueba Windows reportada por propietario:** `Actualizar.bat`, respaldos, migraciones, persistencia, ficha, AFP/Isapres, sueldo base, anexos, historial y permisos. **Sin log privado de esta instalación adjunto al repositorio**, por privacidad.
- **Prueba móvil reportada:** API LAN `/api/health` accesible; web en HTTP desde teléfono blanca; mediante enlace HTTPS temporal de Cloudflare la web abrió y funcionó, con detalles visuales. Confirmado verbalmente por propietario, sin prueba de cámara QR/terminal atribuible a esta verificación.
- **Aprobación expresa:** el propietario declaró **aprobada la Fase 3 de validación funcional reciente**. Diseño móvil menor pendiente no bloqueante. **Esta aprobación no cierra `INT-002` ni el lanzamiento**.
- **Hitos INT no cerrados:** `INT-001` requiere aceptación formal del hito original; `INT-002` requiere matriz de paridad y restauración aislada; `INT-003/004/005` aplazados; `INT-006` no iniciado; `v1.0.0` no liberada.
- **No ejecutado en esta actualización documental:** migración, restauración, cambios de SQLite, nuevos tests en PC, despliegue, integración Propinas o creación del perfil root.

[Checklist y hoja de ruta consolidada](24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md).

## 09-11-2026 — Ejecución BL-001 a BL-005

- Se creó PR #9 con BL-003 (catálogo de bancos), BL-004 (cargas), BL-001 (subdivisión ficha), BL-002 (cuenta bancaria cifrada) y BL-005 (tramos versionados), en una sola integración.
- Validación GitHub **real** del último commit de funcionalidad `d323d6db95e5ff2a3ea4469ecec20e9fa945e1e8`: `42689884990` y `42689885021` = success. Último cambio corrige guardado si solamente cambia cuenta o cargas y conserva historia privada cifrada/snapshots.
- **No equivale** a ensayo de restauración de SQLite productiva, verificación del cifrado/custodia de claves en PC, revisión de datos bancarios con contadora ni acceso móvil físico. Producción continúa sin autorización.
- [Informe técnico, permisos transitorios y límites](28-BL001-BL005-IMPLEMENTACION-EN-REVISION-20261109.md).
