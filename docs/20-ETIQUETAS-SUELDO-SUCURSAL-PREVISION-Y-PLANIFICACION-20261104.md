# 20. Claridad del aumento, lugar de trabajo, datos previsionales y temas solo de planificación

**Fecha:** 04-11-2026. **Estado:** requisitos documentados, **NO implementados ni desplegados**. Se separan expresamente dos mejoras de esta tanda de los dos temas aplazados por petición del propietario. No contener nombres, RUT, sueldos reales, diagnósticos ni afiliaciones individuales en GitHub.

## D-034 — Ayuda visible al registrar anexo de aumento salarial (complementa D-032)

**Problema:** las opciones actuales de `EmployeeDocuments.jsx`, `NEW_BASE` y `INCREASE`, se denominan «Nuevo sueldo base» y «Monto del aumento» sin explicación de su efecto sobre `monthlyBaseSalary`.

**Diseño requerido:**
- Mostrar **dos opciones inequívocas**, con una nota informativa permanente junto a cada una:
  - **Nuevo sueldo base (reemplaza el actual)**. Etiqueta: «El monto ingresado reemplaza el sueldo base vigente, NO se suma». Por ejemplo ficticio: base anterior 600.000; nuevo sueldo 700.000; resultado **700.000 CLP**.
  - **Aumento del sueldo base (se suma al actual)**. Etiqueta: «El monto ingresado se suma al sueldo base anterior». Ejemplo ficticio: base anterior 600.000; aumento 50.000; resultado **650.000 CLP**.
- Vista previa antes de confirmar: sueldo anterior, operación seleccionada, monto ingresado, **sueldo resultante** y **fecha efectiva**. Si no existe sueldo anterior verificable, bloquear la operación incremental mostrando «Falta sueldo base anterior»; no inventarlo.
- **No aplicar cambios al sueldo al seleccionar opción o teclear**. Confirmación administrativa explícita de anexo válido conforme D-032. Conservación de historial, retroactivos/futuros, idempotencia y bloqueo de doble aplicación.
- Pruebas sintéticas: cambio entre las dos modalidades, cálculo vista previa/confirmación, vacío, cero o inválido, retroactivo, vigencia futura, edición concurrente, accesibilidad, conservación de historial.

## D-035 — Lugar habitual de prestación sugerido desde Sucursal (complementa D-021 y D-025)

**Código actual:** `EmployeeFile.jsx` maneja `draft.extra.branch` y `ContractTerms.jsx` guarda `draft.workplace` en `employee_contract_terms` por separado; hoy no hay autocompletado entre ambos.

**Comportamiento aprobado:**
- En ficha de trabajador, al **seleccionar Sucursal**, precargar «Lugar habitual de prestación» con el **nombre de la Sucursal**. Cuando haya catálogo confirmado de locales con dirección asociada, sugerir descripción de local + dirección real.
- Se trata de una **sugerencia editable**. Si el usuario modificó expresamente `workplace` o existe un lugar contractual ya guardado, **no sobrescribirlo** al cambiar Sucursal, Empresa, Área o turno. Para restablecer, ofrecer acción explícita «Usar sucursal asignada».
- Si no hay Sucursal válida o dirección confirmada, no inventar lugar ni dirección; no tomar domicilio particular del trabajador ni domicilio tributario de empresa como prestación sin vínculo comprobado.
- Guardar como término contractual del trabajador, con revisión/historial; no inferir por turnos ocasionales ni modificar contratos anteriores.
- Pruebas con catálogo vacío, sucursal predeterminada, selección manual, término contractual previo, lugar diferente y sucursal histórica.
- Referencia jurídica general: Código del Trabajo art. 10; Dirección del Trabajo, lugar de prestación (https://www.dt.gob.cl/portal/1628/w3-article-60800.html).

## D-036 — Datos previsionales de trabajador en ficha laboral

**Diagnóstico:** `server/src/employeeFiles.js` permite hoy `extra.afp` y `extra.healthSystem` y los preserva con `extra_json`. Sin embargo, `client/src/EmployeeFile.jsx` no tiene controles visibles de afiliación AFP y salud. No se implementó un módulo de cálculo de nómina ni descuentos automáticos.

**Alcance de esta tanda: capturar y presentar datos de afiliación, sin liquidar remuneraciones.**
- Incorporar apartado **Datos previsionales** dentro de la ficha laboral del trabajador, no en Ficha médica. Mostrar lista de AFP vigentes con opción pendiente/no informado (no asignar automáticamente). La afiliación debe reflejar datos que entregue/confirme el trabajador o comprobantes pertinentes.
- Sistema de salud: **FONASA**, **ISAPRE** (con institución/plan cuando corresponda), otra situación respaldada, o **Pendiente**. No asumir que toda persona es Fonasa; nunca permitir simultáneamente Fonasa e Isapre como afiliación principal del mismo período.
- Información de referencia (sin ejecutar descuento): cotización obligatoria de ahorro previsional **10% de renta imponible** del trabajador AFP **más la comisión variable** por administradora; salud legal **7% de renta imponible** para Fonasa, sujetos a topes y reglas legales vigentes. La base imponible **no equivale necesariamente al sueldo base mensual** porque puede incorporar otras partidas imponibles.
- No hardcodear comisiones actuales ni topes UF como constantes permanentes; mantener valores de cálculo con **fuente oficial, fecha de vigencia, historial y cambios** cuando se diseñe remuneraciones. Reforma previsional aporta obligaciones adicionales del empleador que deben estudiarse por separado; no descontarlas de trabajador por error.
- Persistencia: usar `extra.afp` y `extra.healthSystem` existentes o migrar cuidadosamente a tablas/catálogos propios tras auditoría, sin perder valores existentes. Si se produce cambio de AFP o salud, conservar vigencia e historial para futuros cálculos.
- No pedir ni mostrar diagnósticos o antecedentes médicos para afiliar a Fonasa.
- Pruebas: selección desde lista, opción pendiente, migración de texto antiguo, permisos, archivo/reapertura, independencia de cálculos y no duplicación.
- Fuentes oficiales consultadas el 04-11-2026: Superintendencia de Pensiones cotización AFP y comisiones (https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9897.html), Fonasa/ChileAtiende afiliación y 7% (https://portal.chileatiende.gob.cl/fichas/9715-afiliacion-a-fonasa).

## FUTURO EXCLUSIVO — D-037: Cargas familiares (no entra en estas actualizaciones)

- **Solo planificación legal/funcional**: estudiar reconocimiento de causantes/cargas, beneficios y asignación familiar, tramos vigentes, entidad pagadora, verificaciones, fecha de vigencia, relación con remuneraciones y protección de datos.
- La asignación familiar **no debe inferirse** solo de tener hijos u otros parientes y **no se debe calcular un importe automático** sin documentación y situación de reconocimiento acreditada; revisar excepciones y montos vigentes.
- No crear por ahora campos de cargas, automatismos, tablas, beneficios, pagos, descuentos, APIs ni nueva recolección de datos personales de familiares.
- No exigir información de menores en pruebas. Utilizar exclusivamente datos sintéticos al investigar.
- Evaluación jurídica previa con fuentes oficiales: ChileAtiende Asignación Familiar (https://www.chileatiende.gob.cl/tramites/25878).

## FUTURO EXCLUSIVO — D-038: Maternidad, licencias y subsidios (no entra en estas actualizaciones)

- **Solo planificación legal/funcional**, sin implementar en esta etapa: evaluar fuero maternal, prenatal/postnatal y posnatal parental, subsidio por incapacidad laboral maternal, pagador responsable según régimen, empleador, cotizaciones, plazos, requisitos, cálculo y compatibilidad con asistencia/remuneraciones.
- No asumir que hay un único «seguro de embarazo» ni que el empleador siempre deba pagar directamente el sueldo o subsidio durante cada licencia; son conceptos jurídicos separados y pueden intervenir entidades diferentes.
- Evitar **recoger estado de embarazo**, diagnósticos, datos de salud reproductiva o licencias sensibles en la ficha laboral general para esta idea. El módulo existente de licencias médicas tiene sus controles de acceso y no autoriza ampliar información clínica sin evaluación de necesidad y base legal.
- No construir cálculos, alertas por embarazo ni pagos automáticamente hasta análisis jurídico, de privacidad y aprobación específica del propietario.
- Fuentes para futura evaluación: Dirección del Trabajo descanso y subsidios maternales (https://www.dt.gob.cl/portal/1628/w3-article-60117.html), SUSESO (https://www.suseso.cl).

## Orden de entrega

1. Próximas correcciones: D-034 aclaraciones salariales (dependen de D-032), D-035 precarga de lugar con opción manual, D-036 ficha previsional informativa.
2. Seguir secuencia ya documentada D-018 a D-033 y sus requisitos; probar UI, backend, SQLite aislado, historial, permisos y regresión.
3. D-037 y D-038 **FUERA DEL ALCANCE de esta actualización**: permanencia exclusiva en cartera de planificación jurídica.
4. No modificar ni desplegar cambios en Windows `5183/4010` o Huella original sin validación, copia consistente y procedimiento de actualización autorizado.
