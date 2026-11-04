# 19. Anexo de aumento de sueldo, lugar habitual de prestación y RUT en Áreas

**Fecha:** 04-11-2026. **Estado:** diagnóstico verificado del código de `main`; cambios **pendientes de implementación, pruebas y aceptación**. No contiene datos personales ni salarios reales. No cambia la instalación Windows ni SQLite.

## D-032 — Anexo de aumento de sueldo debe reflejarse en sueldo base mensual

### Diagnóstico
- `server/src/financialDocuments.js` reconoce `ANEXO AL CONTRATO AUMENTO SUELDO` como `SALARY_INCREASE`.
- `client/src/EmployeeDocuments.jsx` permite especificar si el importe significa **`NEW_BASE`** (sueldo base nuevo) o **`INCREASE`** (aumento por sumar). `server/src/routes/employeeDocuments.routes.js` guarda `agreed_amount`, `amount_meaning`, `start_on`, fechas de entrega y posible retroactivo en `employee_document_entries`.
- El «Sueldo base mensual (CLP)» está en `client/src/ContractTerms.jsx` y se guarda por separado en `employee_contract_terms.terms_json.monthlyBaseSalary` mediante `server/src/routes/contractTerms.routes.js`, con revisiones e historial.
- La creación de una entrega de anexo **no enlaza todavía esos registros**: no actualiza el sueldo base en la ficha. **No declarar implementada la sincronización.**

### Regla funcional
Cuando se **registre y confirme un anexo de aumento** válido para un trabajador, el sistema debe actualizar el sueldo base vigente en «Condiciones para un futuro contrato» de la ficha principal **desde la fecha efectiva del anexo**, sin borrar versiones anteriores ni modificar documentos históricos.

- `NEW_BASE`: sueldo nuevo = monto acordado. Ejemplo ficticio sueldo actual $600.000, nuevo base $700.000 → nuevo sueldo $700.000.
- `INCREASE`: sueldo nuevo = sueldo base anterior al inicio de la vigencia + monto de aumento. Ejemplo ficticio $600.000 + $50.000 = $650.000.
- Si el sueldo anterior está ausente para `INCREASE`, **no inventarlo**: solicitar completar/verificar el monto previo antes de actualizar, con aviso y sin estados parcialmente aplicados.
- El campo `start_on` del anexo determina la vigencia; fecha de entrega y de firma son fechas distintas. Un aumento **futuro** no debe mostrarse falsamente como sueldo vigente hoy; debe quedar programado hasta su fecha de efecto. Si el cambio es **retroactivo**, conservar vigencias, meses y montos retroactivos sin sumarlos otra vez al sueldo base mensual.
- Registrar el anexo no equivale a documento firmado: definir de forma visible una **confirmación administrativa** de que el aumento acordado se puede aplicar. No realizar cambios irreversibles de remuneración por abrir el formulario o anotar un borrador sin aprobación; un registro incompleto/sin validación debe indicar «Pendiente de confirmar» en vez de alterar el sueldo.
- La operación de aplicar aumento debe ser **transaccional e idempotente**: identificar cada anexo por `entry_id` y vigencia; reintentos, recargas y PDF adjuntos posteriores no pueden duplicarlo. Si la ficha contractual fue editada concurrentemente, bloquear con aviso para resolver la discrepancia, no sobrescribir el salario.
- Guardar auditoría: usuario que confirmó, monto anterior, modalidad, importe, sueldo resultante, fecha efectiva, ID del anexo, fecha de aplicación, y motivo/corrección si aplica. Historial salarial consultable por persona. No borrar revisiones antiguas.
- Un bono del documento `ANEXO CONTRATO BONO` no debe cambiar sueldo base. Gratificación tampoco debe convertirse en aumento de sueldo base.
- No alterar automáticamente meses ya cerrados, liquidaciones, propinas, informes, sistemas originales ni sueldos de otros empleados.
- Pruebas de `NEW_BASE`/`INCREASE`, retroactivos, futuros, ausencia del sueldo previo, aplicación repetida, documentos sin aprobación, errores/rollback, concurrencia, cálculo de historial y bonos.

## D-033 — Formatear RUT en Administración → Áreas → Personal por área

### Diagnóstico
- `client/src/main.jsx`, tabla «Personal por area», muestra `{employee.documentId}` sin `formatRut`. Lo mismo sucede en otras vistas.
- `client/src/EmployeeFile.jsx` ya utiliza `formatRut` para el RUT de Ficha general.
- La ficha médica tiene el mismo problema de presentación, documentado como D-029.
- Un RUT almacenado con puntos y guion en posiciones antiguas erróneas puede verse **mal puntuado** en «Personal por área», mientras que la Ficha general presenta la forma corregida. **No asumir duplicados por una diferencia visual.**

### Regla funcional
- Usar el formateador compartido `formatRut` en **todas las vistas de identidad**: General, Médica, Personal por área y, después de inventariarlas, Usuarios, listados y auditoría donde se muestre el documento.
- Datos de ejemplo completamente ficticios: `123456785`, `12.345.678-5` y `12345678-5` se presentan como `12.345.678-5`. `K/k` equivalentes; no inventar o modificar dígito verificador.
- No ejecutar migraciones de corrección de RUT por un mero defecto visual; respetar ID, huellas, historial de cambios y bloqueo de duplicados.
- Verificar que exportaciones de datos con formato acordado no cambien silenciosamente su valor contractual; pruebas con texto histórico mal puntuado, RUT ausente y documento no RUT.

## «Lugar habitual de prestación» — definición y propuesta para evitar escritura duplicada

- `client/src/ContractTerms.jsx` lo guarda como `workplace` dentro de `employee_contract_terms` con historial. Actualmente es campo de texto independiente de `Empresa`, `Sucursal` y `Área`.
- Es el **lugar o establecimiento donde se realizan habitualmente las labores**, que debe constar de forma suficientemente clara en las condiciones contractuales. No es el domicilio particular del trabajador ni equivale necesariamente al domicilio tributario de la empresa.
- En una próxima mejora del catálogo de locales, **sugerir** lugar/dirección del local habitual asignado (si está confirmado), permitiendo establecer expresamente un lugar contractual distinto. No sobrescribir `workplace` existente por cambios de Empresa/Sucursal o asignaciones ocasionales de turnos. Si el puesto implica movilidad o varios lugares, documentar los términos aplicables y revisar jurídicamente antes de imponer valores.
- Referencia de Dirección del Trabajo: [cláusulas esenciales del contrato](https://www.dt.gob.cl/portal/1628/w3-article-60800.html), [precisión del lugar de prestación](https://www.dt.gob.cl/portal/1628/w3-article-60806.html); Código del Trabajo art. 10.

## Orden de entrega y seguridad

1. D-033 y D-029: corregir solamente formateo visual de RUT sin tocar SQLite.
2. D-032: diseñar explícitamente aprobación, vigencia y movimiento auditable de sueldo; pruebas numéricas y de integración antes de publicar. Mantener separado del plan de remuneraciones definitivo.
3. No introducir automáticamente nueva dirección de lugar de trabajo hasta existir catálogo/local confirmado; conservar `workplace` actual.
4. CI, pruebas en navegador con datos sintéticos y revisión de exportaciones, reversión y respaldo verificable de copia aislada antes de habilitar actualización local. No tocar la base original ni modificar `propinas-local` para estos requisitos.
