# SAGVA Gestión Laboral — Consolidación de ramas y pendientes (12-11-2026)

**Producto exclusivo:** `ManuelAcostaGuerrero/sagva-gestion-laboral`. **Rama principal:** `main`, utilizada como ambiente de pruebas. **Línea inicial auditada:** `d9b463a57732c78d4f72695d486a90ab4f0f5c06`, tras PR #24. La versión visible en los manifiestos es 1.19.2 y no identifica por sí sola un commit.

## Decisión vigente de alcance

El desarrollo inmediato es **Personal, Gestión Laboral, Empresas/Locales, Contratos/Anexos, Documentos, Asistencia QR/PIN, Dirección del Trabajo, Root/Permisos/Auditoría y respaldo/actualizador**. Los módulos de **Propinas, Repartos/Delivery, caja, ventas, liquidaciones/pagos y migración de datos entre productos quedan fuera**. No se debe considerar `INT-003` (Propinas), `INT-005` (Propinas) ni `INT-004` en su antigua forma de «base maestra con Propinas» como condiciones previas de Gestión Laboral.

Se conserva la arquitectura React/Vite + Express + SQLite y **monolito modular** ya existente; no iniciar reescritura. PostgreSQL es una evaluación futura de infraestructura y persistencia central, no una migración autorizada. El servidor operativo separado no recibe cambios al fusionar un PR a `main`.

## Auditoría de 23 ramas existentes respecto a main (antes de esta consolidación)

- **16 ramas: `ahead_by=0`** frente a `main`, es decir, sus commits están incorporados; mantenerlas solo como referencias históricas. Entre ellas: `feat/p2-*`, `feat/p3-*`, `feat/dt-*`, `feat/labor-*`, `feat/bonos-simplificados-*`, `feature/bl001-bl005-*`, `feature/etapa*-*`, `fix/actualizador-*`, `fix/ficha-*`, `int001-*` y validaciones.
- **`fix/etapas-0-1-integridad-datos-20261110`** conserva commits divergentes, pero sus rutas esenciales de empleados, PDF, diagnóstico y pruebas se comprobaron idénticas a `main`. `server/src/routes/contractTerms.routes.js` y el documento 33 evolucionaron posteriormente en `main`; **no reemplazarlos por versiones antiguas**. PR #17 ya integró P0/P1.
- **`docs/protocolo-work-etapas-0-1-20261110`**: el contenido de su único documento es idéntico al vigente en `main`; no hace falta re-fusionar.
- **`impl/ajustes-laborales-bonos-20261110`**: revisados selector de turnos, ficha bancaria, cargas familiares y funciones por cargo: coinciden literalmente con `main`; la UI de bonos actual fue refinada por PR #23 y PR #24. No volver a introducir el diseño anterior.
- **`feature/bl013-bonos-registro-sin-calculo-20261110`, PR #10**: es un **borrador antiguo**, con migración, editor de bonos y rutas incompatibles con las decisiones posteriores PR #15, #23 y #24. No fusionar ese árbol antiguo ni reintroducir dos sistemas de bonos. Preservar solo su especificación histórica para referencia; cerrar PR como sustituido, no como implementado literalmente.
- **Ramas `evidencia/*`**: solo había informes/archivos de pruebas antiguas no incorporados. Se recuperan **cuatro informes textuales** (actualizador, cifrado bancario, recuperación y revalidación P0/P1) con advertencia de corte histórico. No integrar volcados de logs, capturas reales, hashes/identidad de instalaciones, archivos de respaldo ni piezas de `.local` en el repositorio público. Los artefactos originales permanecen en sus ramas para una auditoría privada posterior.

**Importante:** que una rama figure como `diverged` NO implica que sus funcionalidades falten; se comprobó el contenido efectivo de las rutas relevantes antes de decidir. No borrar ramas ni alterar el servidor a partir de este informe.

## Pendientes operativos y orden recomendado

### A — Validar código integrado en la PC y en Android físico (inmediato)
- Comparar SHA del checkout Windows con `main`; si difieren, ejecutar **solo** el actualizador manual aprobado tras respaldo/restauración ensayada, respetando RecoveryRequired y datos históricos.
- Probar trabajadores, búsqueda RUT, guardado/cierre seguro de fichas, empresas/local, turnos, contratos/anexos, banco cifrado autorizado, bonos simplificados, QR/PIN y PDFs.
- Comprobar acceso móvil con HTTPS y cámara física; emulación de Chromium o CI no acredita Android físico. No tocar otros servidores.

### B — Conciliación del modelo laboral (issue #16, todavía abierto)
- P0 inventario y diagnóstico **solo lectura** de la instalación real con respaldo probado.
- P1 corregir únicamente discrepancias demostradas de identidad, empresa/local, estado, cargo y condiciones; decisiones caso por caso.
- P2/P3 ya incorporaron **esquemas aditivos** pero no hicieron conciliación general de valores `extra_json`, vínculos ni backfill. Preservar `employee_files`, documentos, contratos y asistencia.
- P4 migrar lecturas heredadas por etapas, con pruebas de equivalencia, seguridad por empresa y consulta histórica `as-of`; no construir otra ficha ni duplicar trabajador.

### C — Dirección del Trabajo, trabajo principal posterior
Usar `docs/36-MATRIZ-DT-ARQUITECTURA-INTEGRACION-20261111.md`: comprobante legal y entrega, verificación de integridad independiente, contingencia/sincronización central, rectificaciones/oposiciones, reportes HH:MM:SS, portal fiscalizador, seguridad, conservación y auditoría. **Pendientes de certificación externa y autorización DT.** No sustituir legalmente el método de control vigente.

### D — Contratos/anexos para bonos y condiciones
PR #24 simplificó bonos: **Nombre, Monto de referencia, ¿Imponible? y Condiciones/métricas**. No hay evaluación ni pagos automáticos. La modificación de bono ya asignado (monto, vigencia, clasificación, condiciones) está bloqueada hasta un **anexo acreditado y aprobado**; notas administrativas continúan auditadas. Desarrollar ese flujo sin reescribir el catálogo actual. Revisar cláusulas y condiciones conforme a normativa aplicable.

### E — Seguridad Root/administradores locales
Root y permisos individuales básicos existen; faltarían pruebas negativas en **todas las rutas heredadas**, descargas PDF, marcaciones, listados y exportaciones entre empresa A y empresa B, además de permisos por sucursal/campo. No activar delegación local completa antes del aislamiento extremo a extremo.

### F — Limpieza y cierre verificable del backlog
- Issue #2: búsqueda RUT normalizada existente (`client/src/employeeSearch.js`); comprobar casos y cerrar solo tras evidencia de regresión.
- Issue #3: cierre/limpieza al guardar existente (`client/src/EmployeeFile.jsx`, `employeeFileReview.js`); confirmar guardado exitoso y preservación de borradores/errores.
- Issue #14: muchos ajustes integrados por PR #15/#23/#24, pero aceptación física y revisión laboral siguen pendientes; no cerrar por el solo merge.
- Issue #16: conciliación de datos/lecturas heredadas y seguridad integral pendientes; mantener abierto.
- PR #10: cerrar como **superado** por diseño actualizado PR #24, sin merge ni eliminación de la rama.

## Puertas comunes
1. Cualquier PR nuevo debe conservar funcionalidades y la base, con pruebas automatizadas CI en su commit y evidencia de no duplicación.
2. Cambios de esquemas con migración aditiva, idempotente y respaldo/restauración comprobados en copia.
3. Datos reales, secretos, RUT, bancos, fotos, PDF, logs y SQLite privados no se incorporan a GitHub público.
4. Actualización de Windows **manual**, no automática; `main` no significa producción.
5. Solo cerrar tareas marcadas como implementadas y probadas. Pendientes físicos/normativos se mantienen abiertos.
