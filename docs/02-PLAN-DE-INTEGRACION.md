> **Actualización de alcance, 12-11-2026:** este documento describe la planificación histórica original. El desarrollo vigente se limita a **SAGVA Gestión Laboral/Asistencia/Contratos/DT/Seguridad**. **No integrar Propinas ni Repartos en esta etapa**. `INT-003` y `INT-005` (Propinas) y la antigua base unificada `INT-004` quedan aplazados y **no bloquean** el desarrollo laboral. Ver [plan vigente y auditoría de ramas](40-CONSOLIDACION-RAMAS-Y-PENDIENTES-20261112.md). No se reescriben funcionalidades existentes.

# 02. Plan de integración, dependencias y puertas de avance

**No hay fechas prometidas ni fases completadas.** Cada INT es un hito, no equivale a un PR ni a una versión oficial. La ejecución exige comprobar el estado actual.

## INT-001 — Montar Huella original, sin reinterpretarla
**Entrada:** repositorio nuevo y original accesibles; registrar commit exacto de origen; repo nuevo no contiene datos reales.
1. Inventariar árbol, scripts, dependencias y versiones originales.
2. Copiar código y recursos desde Huella, **sin** `.git`, `data/`, `.local/`, `.env`, backups, documentos o credenciales. Mantener copias originales intactas.
3. Mantener componentes, pantallas, rutas y flujos; no unificar Propinas aún ni migrar SQLite a PostgreSQL.
4. Instalar en entorno aislado, generar usuario/datos **sintéticos**, ejecutar preparación, UI y servidor. Probar recuperación básica.
5. Verificar Git no contiene material privado y registrar commit, comandos, resultado y captura **sin datos sensibles**.

**Salida:** Huella ejecuta en repo nuevo con paridad básica demostrada, no solo `npm install`. El script `Preparar.bat` original no debe ejecutarse sobre bases existentes sin auditarlo.

## INT-002 — Paridad completa y ensayo de datos privado
1. Pruebas sistemáticas del inventario `03`: fichas, documentos/PDF, licencias, medical restringida, QR/PIN, terminales, turnos, planificador, historial, perfiles y auditoría.
2. Crear **respaldo consistente privado** de la instalación original mediante el procedimiento oficial y restaurar **en carpeta aislada**.
3. Verificar tablas, integridad, permisos, archivos y referencias; no alterar fuente.
4. Contrastar operación con original en PC/navegador/móvil donde aplique.

**Salida:** propietario confirma funcionamiento equivalente; evidencia sin PII en Git y recuentos reales **solo en informe privado**.

## INT-003 — Conciliar identidades de Propinas
1. Obtener respaldo privado de Propinas, sin publicarlo; exportar listado privado de participantes.
2. Presentar al propietario trabajadores y candidatos del sistema Huella para decisión **uno por uno**: mismo, distinto, nuevo, figura operativa o pendiente.
3. Registrar decisiones/autor/evidencia/contexto temporal en matriz cifrada fuera de Git.
4. No fusionar por nombre ni por ID sin contexto; no crear figuras como trabajadores.

**Salida:** identidades actuales aprobadas, casos históricos ambiguos preservados y pendientes explícitos; ninguna duplicación automática.

## INT-004 — Base maestra única y ensayo PostgreSQL
1. Diseñar/migrar Persona, Empresa, Local, relaciones laborales, área/cargo, equivalencias contextuales, turnos, marcaciones, documentos, historia, permisos y tablas de Propinas.
2. Preservar UUID/IDs de origen mediante mapa trazable; migraciones repetibles e idempotentes, `dry-run` y transacciones.
3. Trabajar sobre **copias aisladas**, medir conteos, FK, hashes de adjuntos, tiempos/zonas horarias y borrado lógico.
4. Mantener fuentes originales sin escritura; comparar contra su comportamiento.

**Salida:** inventario/conciliación sin pérdidas ni duplicados; rollback/restauración demostrada, permiso del propietario para pasar a siguiente fase.

## INT-005 — Integrar Propinas original
1. Incorporar pantallas y lógica original con la misma experiencia de planilla amplia, semanas, cierres, permisos, estados y respaldos.
2. Reemplazar únicamente el padrón duplicado de personas por referencias a Personal y la clasificación configurable aprobada.
3. Mantener figuras (Copero Mañana, Copero Tarde, Refuerzo) como participantes operativos distintos de empleados.
4. Comparar casos representativos, límites y datos históricos con el motor original: diferencias de reparto **0 CLP**; semanas cerradas inmutables.
5. Validar acceso por empresa/local y separación de permisos.

**Salida:** dos módulos funcionales integrados, sin cambio silencioso en cálculos, historial ni interfaz.

## INT-006 — Rescate técnico y aprobación final
1. Auditar legado `sagva-gestion-integral`: seguridad, auditoría, esquemas, pruebas, respaldos y control de actualizaciones.
2. Recuperar **solo** piezas cuya necesidad, licencia, dependencias, costo y paridad se acrediten.
3. Pruebas integrales Windows/Linux y PostgreSQL; prueba de móvil físico; restauración en equipo alternativo privado; revisión de privacidad.
4. Aprobar checklist final y preparar versión oficial `v1.0.0`; documentar despliegue y reversión.

**Salida:** aprobación explícita del dueño y evidencia de pruebas. Sin eso, seguir como INT.

## Transversal a todas las fases
- Cada PR debe indicar qué funciona **ahora**, qué queda **pendiente** y qué pruebas se **ejecutaron realmente**.
- Cualquier cambio de UI/cálculo/regla requiere autorización antes de implementar.
- Preferir GitHub gratuito con ejecutores estándar; Work solo si tarea de PC/navegador lo exige y es autorizado.
- No permitir que el número de PR sea indicador de avance; detenerse si una fase tiene defectos críticos.
