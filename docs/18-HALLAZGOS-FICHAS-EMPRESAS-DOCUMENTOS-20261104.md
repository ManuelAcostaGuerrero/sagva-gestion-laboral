# 18. Revisión de Empresa → Trabajador, RUT médico, fechas y direcciones

**Fecha:** 04-11-2026. **Estado:** diagnóstico de código y requisitos pendientes. **No se modificó la aplicación, el servicio ni la SQLite local.** No registrar nombres, RUT ni correo privados de las capturas del propietario.

## Diagnóstico de la captura y el código (hechos)

1. **Empresa recién creada no aparece al seleccionar en ficha (D-028):** `client/src/EmployeeFile.jsx`, líneas 88-102, llama `api('/companies')` solamente en `useEffect(...,[])`. En `client/src/main.jsx`, la pantalla de fichas se mantiene montada dentro de `<div hidden={adminModule !== 'employeeFile'}>`; por otro lado, `Companies.jsx` se monta solo al abrir Empresas, crea con POST y recarga **su propia** lista. No se notifica ni refresca la lista interna de `EmployeeFile` al crear/editar empresas. Por tanto el selector puede mostrar un catálogo obsoleto durante la misma sesión. **Causa probable comprobada en código**, sin afirmar que se haya reproducido en el PC. Verificar además que se pulsó Crear empresa y se recibió confirmación del servidor; la captura del formulario rellenado, por sí sola, no demuestra persistencia.
2. **RUT distinto visualmente en ficha médica (D-029):** `EmployeeFile.jsx` formatea `documentId` con `formatRut` desde `server/src/rut.js`, pero `MedicalProfile.jsx` (cerca de línea 81) imprime `documentId` crudo, sin formato. Un RUT almacenado con separadores incorrectos puede mostrarse corregido visualmente en General y sin corregir en Médica. **Esto no prueba que existan dos RUT o dos trabajadores.** Evitar modificar identidad/RUT o historial al corregir la presentación.
3. **Fecha de entrega e inicio de documento (D-030):** `EmployeeDocuments.jsx` inicializa `newEntry()` con ambas fechas en el día actual, pero `changeEntry('deliveredOn',...)` solo cambia la entrega, no `startOn`. Los documentos con vigencia o condiciones financieras almacenan ambas separadas; el vencimiento automático se calcula sobre `startOn` en `employeeDocuments.routes.js`.
4. **Dirección del trabajador (D-031):** `EmployeeFile.jsx` usa únicamente `address` libre; `employeeFiles.js` y la tabla `employee_files` no disponen de Región/Provincia/Comuna/Ciudad estructuradas en la ficha. La empresa también solo tiene `address` y `commune` de texto. D-024 ya pedía catálogo de Chile para Empresa; hay que extender **los mismos componentes territoriales** a la dirección particular del trabajador, pero **sin copiar la dirección empresarial como residencia**.

## D-028. Selección de empresa siempre actualizada y vinculada

- La ficha personal debe permitir seleccionar **todas las empresas activas autorizadas** creadas en Administración → Empresas, inmediatamente después de guardar la empresa, sin recargar manualmente.
- Elegir Empresa define `companyId`, conserva la razón social correspondiente y puede sugerir Sucursal predeterminada. Área/Cargo/Jornada son sugerencias opcionales **independientes de que la empresa esté disponible**. Un valor sin preselección no bloquea el vínculo de la empresa.
- La opción «Empresa» **no debe ser una caja de texto libre duplicada**. Conservar relaciones históricas sin asignar empresa por coincidencia ambigua. Prohibir la selección de empresas inactivas salvo mostrar vínculo histórico ya existente.
- Implementación por evento de cambio, versión/invalidation de catálogo, o recarga explícita al reingresar a Ficha (y al crear una nueva ficha), sin reiniciar la aplicación. Proteger los borradores de cambios sin guardar durante la recarga. Mostrar error de API claro si no se pudo cargar la lista; no presentar lista vacía como si no existieran empresas.
- Pruebas funcionales y UI: crear empresa → cambiar a ficha sin F5 → seleccionarla → guardar → reapertura confirma `companyId`; edición de nombre, empresa inactiva, empresas sin valores sugeridos, reingreso al módulo y registros históricos.

**Alternativa temporal para la prueba local:** guardar cualquier borrador, comprobar mensaje «Empresa creada» y presencia en el listado, pulsar F5 en `localhost:5183`, reabrir la ficha y buscarla en el selector. Solo para el entorno de prueba y sin descartar cambios pendientes.

## Ejemplo aclaratorio: empresa vinculada frente a valores sugeridos (D-026)

```text
Administración > Empresas
  EMPRESA: Empresa de ejemplo SpA (RUT de empresa independiente)
  Nombre comercial: RESTAURANTE EJEMPLO
  Sucursal predeterminada: LOCAL CENTRO
  Área sugerida: [vacío]
  Cargo sugerido: [vacío]
  Jornada sugerida: [vacío]
                 │
                 └── guardar empresa
                         │
Personal > Ficha de trabajador (datos ficticios)
  Empresa [seleccionar: Empresa de ejemplo SpA]  ← debe aparecer recién creada
  Sucursal [LOCAL CENTRO]                          ← propuesta, editable
  Área [COCINA]                                    ← elección por trabajador
  Cargo [COCINERO]                                 ← elección por trabajador
  Jornada [FULL_TIME]                              ← elección por trabajador
                         │
                      Guardar
```

La Empresa es el empleador legal; Nombre comercial identifica al negocio; Sucursal es el establecimiento asignado; Área, Cargo y Jornada se asignan **individualmente**. No imponer puestos a todos los trabajadores de una empresa con múltiples funciones. Si se configuran sugerencias, solo precargan campos vacíos y deben poder corregirse.

## D-029. Formato coherente de RUT en ficha médica

- Aplicar `formatRut(documentId)` para **solo presentación** en Médica, documentos y otras vistas, igual que en General; preservar valor normalizado e identidad maestra. No crear/alterar ficha, no copiar datos médicos ni mostrar RUT de otra persona.
- Comprobar variantes con/sin puntos/guion y `K/k`, incluido un valor histórico con puntuación mal ubicada, para el que General y Médica muestren exactamente el mismo RUT.
- No duplicar lógicas de formato. Probar con datos sintéticos; verificar que el contenido clínico permanezca separado y restringido.

## D-030. Fecha de inicio sugerida desde la fecha de entrega

- Si un documento tiene campos «Fecha de entrega» y «Fecha de inicio», **inicialmente deben coincidir**.
- Cuando el usuario cambie Fecha de entrega, copiar esa fecha a Inicio **mientras no haya modificado manualmente Inicio**. Desde que edite Inicio, respetarlo incluso si vuelve a cambiar Entrega; permitir acción clara para «usar fecha de entrega» si hace falta restablecer la relación.
- Cuando comience una entrega nueva/renovación, reiniciar el indicador de cambio manual. Nunca reescribir fechas de entregas históricas guardadas ni cambiar Fecha de firma automáticamente.
- Vencimientos automáticos siguen calculándose desde **Fecha de inicio**, no desde Entrega, cuando son diferentes. Exigir fechas válidas; no asumir que todos los documentos tienen fecha de inicio ni imponerla en modalidades que no la muestran.
- Pruebas: entrada nueva, cambio de Entrega antes y después de editar Inicio, fecha vacía, renovaciones, cambio de modalidad, cálculo de vencimiento manual/automático y persistencia del valor editado.

## D-024 ampliado y D-031. Dirección de empresas y trabajadores en Chile

- Catálogos territoriales compartidos, versionados y validados, de **16 regiones → provincias → comunas**; al cambiar un nivel se actualizan las opciones del siguiente. **Ciudad/localidad debe aparecer expresamente**, dependiente de la comuna cuando exista relación en un catálogo oficial verificable (por ejemplo INE). Si una comuna tiene múltiples localidades o no hay catálogo completo y vigente, permitir indicarlo de forma controlada y no inventar ciudades. No hacer equivalencias automáticas de comuna=ciudad.
- Para **Empresa**: dirección del establecimiento principal o domicilio registrado, con Región, Provincia, Comuna, Ciudad/Localidad y calle/número/complementos.
- Para **Trabajador**: **domicilio particular** con los mismos selectores territoriales. **Nunca copiar automáticamente dirección de empresa como domicilio personal.** La empresa seleccionada puede preseleccionar datos del *lugar de trabajo* mediante Sucursal, un ámbito distinto del domicilio particular.
- Preservar `company_profiles.address/commune` y `employee_files.address` existentes. Usar migraciones aditivas e idempotentes, sin completar regiones, comunas o ciudades inferidas de texto libre; ofrecer migración/revisión privada asistida para datos antiguos.
- No mezclar cambios de domicilio personal con `companyId`, centro de costo, ficha médica ni documentos.
- Pruebas de cascada territorial, guardar/reabrir, domicilios distintos empresa/trabajador, valores históricos, catálogos faltantes, permisos, sin datos reales en GitHub.

**Fuentes de referencia para desarrollo**: INE (División Político Administrativa, 16 regiones, 56 provincias y 346 comunas; catálogo propio de localidades/entidades), Gobierno Digital API de DPA y Códigos Únicos Territoriales de Chile. Validar exhaustividad/actualidad/licencias antes de empaquetar el catálogo. No reutilizar una tabla antigua con 13/15 regiones.

## Orden propuesto de trabajo y límites

1. Registrar esta auditoría como **diagnóstico de código y requisito**, no como fallo confirmado local en cada caso.
2. Priorizar **D-028** para permitir vincular trabajadores a empresas que ya se crearon; no obliga a decidir Área/Cargo/Jornada predeterminados.
3. Aplicar **D-029** como corrección visual no destructiva en todas las pestañas.
4. Implementar **D-030** preservando la edición manual y la semántica de vencimiento.
5. Desarrollar **D-024+D-031** como proyecto de catálogo de direcciones con migración y pruebas separadas, además de D-023/025/026/027 ya aprobadas.
6. Conservar pasos de D-018 a D-022; no modificar la SQLite del propietario ni Asistencia original; ensayos con identidades ficticias y respaldo local.
7. Antes de distribuir: pruebas CI servidor, build, navegador, casos negativos, restauración de respaldo, revisión de permisos, aceptación y un **procedimiento de actualización seguro de Windows**. `Actualizar.bat` de SAGVA no está habilitado para uso INT-001 en este momento.
