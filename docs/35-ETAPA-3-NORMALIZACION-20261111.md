# Etapa 3 | Normalización gradual de duplicados y JSON (expand + compare)

## Principio

**No normalizar a ciegas.** Un campo con igual nombre puede representar datos distintos: `work_schedule` (modalidad contractual), el planificador (turnos programados) y `attendance_records` (marcaciones reales). Del mismo modo, una etiqueta histórica de empresa o cargo no debe ser reemplazada por el nombre actual del catálogo sin comprobación.

**Estado de esta PR:** sólo expansión y comparación verificable. No `UPDATE` masivo de fichas, no `DELETE` de campos, no conversión automática de JSON ni duplicación de personas. Esta etapa **no se declarará terminada en producción** hasta revisar las discrepancias privadas y autorizar los lotes de conciliación.

## Fuentes oficiales: V1

| Concepto | Fuente de autoridad | Valores legados a comparar | Regla actual |
|---|---|---|---|
| Identidad y nombres | `employees.legal_full_name`, nombres/apellidos separados | `employees.full_name`, JSON de ficha | Conservar literal legal, no reconstruir por semejanza |
| Empresa | `employee_files.company_id` y `company_profiles.id` | `employee_files.company` | Si hay FK válida, presentar nombre del catálogo; conservar texto antiguo |
| Cargo y área | `work_positions`, `work_areas` | `employees.position_name` | Hasta confirmar las asignaciones, conservar datos actuales |
| Sucursal | `company_branches` y `employment_assignments` confirmadas | `extra_json.branch` | No asociar textos automáticamente |
| Jornada | Contrato pactado + turnos programados + marcas originales | Campos parcialmente similares | **No fusionar categorías semánticamente distintas** |
| Sueldo | Contrato y anexo firmado; vigencias confirmadas | `terms_json.monthlyBaseSalary` | No cambiar montos históricos ni inferir su vigencia |
| AFP y salud | `employee_prevision_versions` una vez confirmado | `extra_json.afp/healthSystem/isapreName/healthPlan...` | No migrar hasta comparar fuentes y vigencias |
| Campos extensibles | `labor_config_fields` y valores configurables | JSON previsto como soporte | Mantener extensibilidad y permisos |

## Implementación de este PR

1. Vista interna `employee_authority_v1`: presenta nombre legal, empresa vinculada y estado de conflicto, conservando simultáneamente etiquetas heredadas. No cambia datos existentes.
2. Tabla vacía `employee_prevision_versions`: referencias a catálogo AFP/Isapre/Fonasa, fecha de inicio/fin, monto/UF-CLP y fuente aprobada. Triggers validan tipos y vigencias, impiden superposición y reescritura.
3. Herramienta `node tools/auditar-normalizacion.mjs`: SQLite `readOnly` y `query_only`, únicamente conteos y señales, sin nombre/RUT/bancos ni contenido del JSON. Detecta etiquetas contradictorias, apellidos, AFP/Isapre sin correspondencia, vínculo empresa y JSON inválido.
4. Matriz de autoridades versionada en `FIELD_AUTHORITY_V1` para futuros consumidores internos, sin exponer un endpoint general inseguro.
5. Regresiones con datos sintéticos de integridad, no reescritura de legado, comparación agregada, tipos previsionales y consulta a fecha.

## Proceso restante (no automático)

**A. Diagnose:** validar P0 y P1 en la instalación Windows con copia/backup restaurable; ejecutar `node tools/auditar-normalizacion.mjs` en lectura y preservar el resultado privado.

**B. Compare:** conciliar por campo y por trabajador: `SIN_DIFERENCIA`, `CONFLICTO`, `SIN_FUENTE`, `CAMPO_HISTORICO`, `APROBADO`. Un informe de conteos no revela qué registro concreto debe corregirse. Una conciliación detallada que sí identifique personas sólo podrá existir en almacenamiento privado autorizado.

**C. Backfill (futuro):** luego de autorización explícita por lote, migrar valores aprobados a tablas tipadas/versionadas, con `dry-run`, conteos previos/posteriores, verificación de reversión y bitácora de decisiones. No sobrescribir importaciones ni reabrir períodos anteriores.

**D. Read switch (futuro):** cambiar consumidores de lecturas una a una, con pruebas de equivalencia y funciones por fecha, sin conceder acceso general a datos sensibles.

**E. Retirada (futuro y opcional):** sólo después de equivalencia probada y preservación del historial, decidir si se ocultan campos redundantes de interfaces. Eliminar columnas o JSON de la base de datos NO forma parte de esta etapa inicial.

## Bloqueos previos a fusionar

- Dependencia de PR P2 y de `migrateEmploymentHistory`; no fusionar antes.
- CI íntegro y pruebas físicas Windows con backup/restauración aislada.
- Verificar que la PC esté en la versión esperada y que no existan correcciones pendientes de P0.
- Autorizar explícitamente cualquier introducción de datos normalizados de personas reales.
- No Propinas, pagos ni migración PostgreSQL aquí.

**No dar por terminada la normalización integral por la sola creación de la vista o la tabla vacía.**
