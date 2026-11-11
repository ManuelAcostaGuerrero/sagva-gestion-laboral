# Etapas 0 y 1 — Integridad del modelo de datos actual (10-11-2026)

**Proyecto:** exclusivamente `ManuelAcostaGuerrero/sagva-gestion-laboral`  
**Plan:** [Issue #16](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/issues/16)  
**Fuente inicial de código:** `main` en `c472990408301501f6c3e8b7e4994ec09b94a9ef`  
**Alcance:** diagnóstico técnico de código + correcciones aditivas de comportamiento actual. **Sin Propinas, sin P2/P3, sin migración PostgreSQL, sin datos privados, sin despliegue local.**

## Etapa 0: inventario técnico de tablas/campos (análisis de código completado)

`database/schema.sql` es sólo la estructura base. La estructura real se amplía mediante `server/src/migrations.js` y migraciones JS; revisar solo el SQL base produce conclusiones incompletas.

| Dominio | Autoridad o lectura actual | Duplicación o vínculo a observar | Decisión P1 | Pendiente P2/P3 |
|---|---|---|---|---|
| Identidad | `employees.id`, `document_id`, `legal_full_name`, nombres/apellidos | `full_name`, `employee_files.extra_json.firstName/paternalLastName` | No reconstruir nombre legal ni identificar por nombre o RUT | Normalizar duplicados, conservar referencias originales |
| Ficha | `employee_files.employee_id`, `revision` | JSON y datos heredados | Preservar revisiones, advertencias y edición parcial sin borrados implícitos | Diccionario formal + migración gradual |
| Empresa | `employee_files.company_id` → `company_profiles.id` | `company` como etiqueta antigua; `extra_json.branch` | No permitir desvinculación silenciosa ni texto contradictorio | Catálogo `branches`, asignaciones con vigencia |
| Área y cargo | `employees.work_area_id`, `position_name`; `work_areas`, `work_positions` | Cargo no FK; referencias semánticas distintas | Conservar catálogo y validaciones existentes | Asociar cargo por ID y vigencia sin borrar nombres históricos |
| Estado laboral | `employees.is_active`, `employee_files.employment_status` | Pueden divergir al usar rutas administrativas | Sincronizar ambas en una transacción y auditar | `employment_relationships` por contrato/recontratación |
| Contrato | `employee_contract_terms.terms_json` + `_history`; anexos y PDFs | Sueldo actual y aprobaciones firmadas | Bloquear cambio directo de sueldo aprobado; mantener cambios de otros campos | Condiciones por vigencia, fuente de sueldo a fecha |
| Jornada | `employee_files.work_schedule`, `employee_contract_terms`, planificador, turnos y `attendance_records` | Pacto ≠ turno programado ≠ marcación | No mezclar orígenes ni generar horas extras automáticamente | Consultas de jornada y horas aprobadas por fecha |
| Previsión y beneficios | `labor_entities`, `labor_parameter_versions`, `labor_banks` y cargas | AFP, Isapre y plan en `extra_json` | No recalcular ni reemplazar períodos históricos | Tipificación/vigencia posterior |
| Banca | `employee_bank_accounts`, `employee_bank_authorizations` | Cifrado AES-256-GCM por clave `SAGVA_BANK_DATA_KEY` | Conservar secreto y datos; permisos y auditoría | Segregación por relación laboral cuando se justifique |
| Documentos | `employee_contract_files`, documentos laborales y sus adjuntos | PDFs y sus snapshots | Restringir accesos a PDF al activar Root | Políticas de empresa/local y tiempos de conservación |
| Auditoría | `audit_logs` y tablas históricas por dominio | Algunas rutas antes auditaban fuera de la transacción | Auditar cambios críticos dentro de la transacción | Cobertura por evento, roles y fiscalización |

### Herramienta de diagnóstico instalada en el repositorio

`node tools/auditar-modelo-datos.mjs` desde la raíz del proyecto, **únicamente cuando se autorice en la instalación local**.

- Abre el archivo SQLite según `server/.env` en modo **readOnly** y `PRAGMA query_only=ON`.
- Comprueba `integrity_check` y `foreign_key_check`, cuenta registros y devuelve **totales y señales**, no nombres, RUT, valores bancarios, PDF, secretos ni rutas.
- Detecta posibles discrepancias entre `is_active` y `employment_status`, fichas faltantes, `company_id` y etiqueta, cargos fuera de catálogo, JSON inválido y totales de contratos/marcaciones.
- Una etiqueta histórica distinta de la razón social actual **no demuestra error**. Toda conciliación exige fuente privada y decisión explícita.
- No automatizar el script con `Actualizar.bat` ni usar su resultado para escribir en la BD.

**No ejecutado aquí:** diagnóstico sobre el SQLite real de la PC, inventario de sus migraciones aplicadas, comparativa de identidades reales, respaldo/restauración y conteos reales. Sin acceso autorizado a esa instalación, esos resultados son **pendientes y no se infieren de GitHub**.

## Etapa 1: correcciones de código propuestas en la rama

### P1-A — Identidad y ficha
- `employeeFiles.js`: no permitir reactivar por escritura directa de `employmentStatus='ACTIVO'` cuando `employees.is_active=0`, aunque la ficha ya tenga estado histórico incoherente.
- No borrar ni normalizar todavía `legal_full_name`, `full_name`, los componentes de nombre o `extra_json`.
- Se conserva el comportamiento preexistente de RUT normalizado, ficha provisional, guardado por revisión y advertencias.

### P1-B — Empresa y cargo
- Si una actualización parcial omite `companyId`, conservar el identificador anterior en vez de borrarlo.
- Si existe `companyId`, no permitir limpiar unilateralmente la etiqueta ni cambiar su razón social mediante texto libre; cambio de empresa usa el selector.
- No modificar catálogos o vínculos históricos. El nombre `company` puede ser una etiqueta histórica; divergencias se revisan, no se reescriben automáticamente.

### P1-C — Estado laboral
- `DELETE /api/employees/:id`: establecer `is_active=0` y `employment_status=INACTIVO` en la **misma transacción**, conservando `FINIQUITADO` si ya figura así.
- `POST /api/employees/:id/reactivate`: establecer `is_active=1` y `employment_status=ACTIVO`, de forma atómica, con auditoría y actualización de `employee_files.revision`.
- Bloquear reactivación administrativa de un trabajador `FINIQUITADO`: su nueva contratación requiere relación laboral nueva y fecha/condiciones nuevas (P2).
- No alterar automáticamente fechas contractuales, datos financieros ni marcaciones.

### P1-D — Contratos, sueldos y jornadas
- `PUT /api/contract-terms/workers/:id`: si existe un anexo salarial **aprobado**, no permitir reemplazar `monthlyBaseSalary` escribiendo directamente condiciones; un nuevo ajuste debe tramitarse mediante anexo firmado y aprobado.
- Modificar únicamente lugar de prestación, funciones, etc. sigue permitido si el sueldo aprobado permanece intacto.
- Se mantienen los datos de `employee_contract_terms_history` y `employee_salary_annex_approvals`.
- **No se afirma resuelto:** cálculo legal de sobretiempo, validación de jornada pactada por vigencia o resolver el sueldo histórico `as-of`; necesitan el modelo P2 y revisión laboral.

### P1-E — Acceso a documentos y permisos
- `contract-files`: con Root activado, consultar documentos contractuales y sus PDF, o adjuntarlos, exige permiso `personal.contract.read/write` del servidor. Compatibilidad del operador legado conservada **sólo antes de activar Root**.
- Los permisos individuales de **empresa/sucursal todavía no son delegables por la UI de Root**: `/admin/access/users/:id/permissions` restringe actualmente a `GLOBAL`. No declarar aislamiento completo entre empresas.
- Los datos bancarios y documentos médicos mantienen sus mecanismos independientes. No exponer datos privados mediante el diagnóstico.

## Pruebas y aceptación

**Pruebas automatizadas agregadas:**
- `data-model-diagnostic.test.js`: sólo conteos, casos sintéticos, sin PII, sin escrituras.
- `data-integrity-stage1.test.js`: empresa en edición parcial, estado/baja/reactivación/finiquito, auditoría, claves foráneas.
- `contract-files-permissions-p1.test.js`: acceso anterior sin Root, denegación con Root, concesión y denegación individuales.
- `entrega2-contracts.test.js`: regresión que impide editar un sueldo aprobado desde la ficha.

**Cierre técnico condicionado a:** CI del PR aprobado, revisión de cambios, pruebas negativas y paridad, prueba manual con copias privadas, respaldo/restauración aislada, comprobación de estado de Root/contratos en PC autorizada y confirmación del propietario. No hacer cambios destructivos sobre `main`, no aplicar migraciones P2/P3 ni declarar listo para DT/producción.

## Orden siguiente (NO EJECUTAR en estas etapas)
1. P2: relación laboral histórica, catálogo de sucursales, asignaciones y condiciones por vigencia.
2. P3: normalizar duplicados y JSON mediante `expand → backfill → comparar → cambiar lecturas → retirada opcional`.
3. P4: contrato de APIs de consultas por fecha para módulos futuros; Propinas sigue aplazada.
