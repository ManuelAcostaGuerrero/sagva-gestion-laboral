# Etapa 2 | Estructura histórica y migración aditiva (propuesta)

## Estado y límite de seguridad

Esta implementación crea **tablas vacías** mediante una migración SQLite versionada; no realiza importaciones, no reconstruye contratos pasados, no crea sucursales a partir de `extra_json.branch` y no enlaza marcaciones antiguas de forma automática.

**No desplegar ni fusionar hasta:** validación de P0/P1 en la PC, respaldo/restauración aislada, comprobación de Root y claves bancarias, CI y aprobación del propietario.

## Relaciones nuevas

- `employment_relationships`: un `employees.id` estable puede tener múltiples relaciones contractuales con una o distintas empresas, en periodos distintos. Se exige revisión y responsable para confirmar.
- `company_branches`: sucursal real con FK a `company_profiles`, código único por empresa; no se equipara con área, cargo ni unidad organizativa.
- `employment_assignments`: empresa/relación → sucursal, área y cargo, con intervalos `[valid_from,valid_until)`. FK y triggers evitan sucursales de otra empresa y superposiciones.
- `employment_terms_versions`: sueldo base CLP, horas semanales, colación, snapshot y referencia documental por intervalo `[effective_from,effective_until)`. No permite superposiciones ni modificaciones/destrucciones silenciosas.
- `attendance_employment_links`: vínculo **opcional y confirmado** de una marcación original a una relación laboral, verificando persona y fecha. La tabla no altera `attendance_records`; un registro ambiguo queda sin vínculo.

## Semántica temporal

- `employment_relationships.started_on/ended_on`: extremos **inclusivos** de la relación. Un contrato terminado el 30 de junio admite otra relación desde el 1 de julio.
- Asignaciones y condiciones: comienzo **inclusivo** y fin **exclusivo**; para una relación terminada, el último intervalo debe cerrar como máximo el día siguiente al término.
- No se considera un contrato o un sueldo vigentes por el mero hecho de existir una ficha antigua. La consulta `employmentContextAsOf` devuelve únicamente relaciones revisadas y confirmadas.
- Varias relaciones con distintas empresas pueden estar vigentes simultáneamente. No se fusionan por RUT ni por nombre.

## Datos anteriores: qué NO se toca

`employees`, `employee_files`, `company_profiles`, `employee_contract_terms`, `employee_contract_terms_history`, `employee_contract_annexes`, `attendance_records`, `audit_logs`, documentos, perfiles, claves y bases existentes. **Ningún `UPDATE` ni `DELETE` de registros previos** en la migración. El catálogo de sucursales y los vínculos históricos comienzan vacíos, a la espera de conciliación humana.

## Limitaciones conocidas

- No hay aún UI o endpoint administrativo para registrar relaciones confirmadas: el esquema se prepara, pero **no se propone cargar registros reales por SQL manual**.
- Los permisos de empresa/sucursal continúan restringidos según el estado actual del sistema. La función de consulta es interna; no publica salario o información sensible en HTTP.
- La autoridad del contrato vigente sigue siendo la ruta preexistente mientras los contratos históricos no se hayan conciliado.
- Las fechas deben validarse también con calendario estricto en los futuros endpoints de escritura; el esquema verifica forma ISO, rango y superposición.
- Las correcciones de una vigencia ya confirmada deberán incorporarse como operaciones de rectificación auditada; el diseño inicial bloquea las ediciones y eliminaciones directas.
- PostgreSQL queda pendiente hasta aprobar un ensayo de migración completo.

## Pruebas

`server/src/__tests__/employment-history-p2.test.js` valida migración idempotente, relaciones vacías, fechas históricas, recontratación, multiempresa, ámbitos de sucursal, solapamientos, sueldo según fecha, vinculación de marcaciones por persona/fecha, integridad de FK y rollback. Sólo registros sintéticos.

**Puerta de aceptación:** no cerrar Etapa 2 ni anunciar lista la migración real sin tener resultados de P0 en la instalación local, restauración ensayada y autorización de asignaciones históricas.
