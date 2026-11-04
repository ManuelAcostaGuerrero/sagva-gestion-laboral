# 17. Empresas, RUT, territorio chileno y ficha: requisitos de la próxima actualización

**Fecha:** 04-11-2026. **Estado:** requisitos definidos por el propietario, **pendientes de implementar y probar**. Diagnóstico de código verificado en `main`; no se modificaron datos, SQLite, interfaz ni instalación Windows. Este documento no autoriza cambios de producción.

## D-023. RUT de empresa y representante con formato automático

**Problema observado:** `client/src/Companies.jsx` presenta `taxId` y `representativeRut` como texto sin máscara/formato; `server/src/companyProfiles.js` ya valida ambos mediante módulo 11 en `server/src/rut.js`. La validación de dígito verificador **no implica formato automático en pantalla**.

**Comportamiento aprobado:**
- Aceptar ingreso/pegado con y sin puntos y guion, ignorar espacios de separación y normalizar `k` a `K`.
- Aplicar visualización chilena de RUT con miles separados por `.` y guion antes del dígito verificador, sin inventar dígito. Ejemplo **exclusivamente ficticio**: `123456785` -> `12.345.678-5`. Mientras está incompleto, no impedir escribir ni desplazar el cursor de forma inesperada; normalizar al perder foco y antes de enviar, con pruebas de edición/pegado/borrado/teclado móvil.
- Mostrar error específico por formato o dígito verificador incorrecto, además de validación en backend. **No crear, corregir ni consultar identidades externas automáticamente**.
- Evitar RUT duplicado en empresas, comparando normalizados (`.`, `-`, espacios y `k/K`), sin reescribir silenciosamente RUT históricos. La migración ya tiene `company_profiles_rut` y las rutas buscan duplicados; revisar consistencia de ambas y probar casos.
- Reutilizar componente/formateador compartido con fichas de empleados **sin cambiar los RUT guardados por mostrar otro formato**.
- Datos reales de la captura del propietario no deben copiarse a documentación, código, PR, CI o tests.

## D-024. Dirección territorial de empresas en Chile con selectores encadenados

**Código actual:** `company_profiles` almacena `address` y un único `commune` de texto libre, visibles en `client/src/Companies.jsx`. No hay `region` ni `province` en el esquema.

**Propuesta funcional:**
- Mantener `Dirección` (calle/número y complementos según sea necesario).
- Selección encadenada **Región → Provincia → Comuna** utilizando catálogo **completo y versionado** de Chile con códigos oficiales; al cambiar región se restablecen provincia y comuna incompatibles; al cambiar provincia se restablece comuna incompatible.
- **Ciudad/localidad**, si se necesita para dirección postal, es un campo complementario distinto de comuna. No asignar ciudad=nombre de comuna automáticamente. Mostrar selector dependiente **solo con fuente oficial completa verificable**; si no existe catálogo adecuado para localidades, dejarla explícitamente opcional sin afirmar cobertura inexistente. Evitar imponer un dato geográfico que no siempre corresponda.
- Guardar códigos y denominaciones compatibles con `company_profiles` mediante migración SQLite aditiva e idempotente, API con validación de pertenencia territorial, trazabilidad. Para empresas antiguas con `commune` en texto libre, **conservar valor histórico**, permitir correspondencia asistida y revisar manualmente ambigüedades, sin hacer reasignaciones masivas ni inferir región sin evidencia.
- Pruebas con ejemplos ficticios de Biobío/Concepción/Hualpén y Ñuble, cobertura de otras regiones, cambios en cascada, entradas maliciosas, migración repetida y preservación de empresas antiguas.
- Fuentes para diseñar catálogo: Dirección de Presupuestos, «Configuración Global SIGFE 2026», catálogo localización geográfica Región/Provincia/Comuna (https://www.dipres.gov.cl/590/articles-393849_doc_pdf.pdf); Biblioteca del Congreso Nacional, Mapoteca Comunas (https://www.bcn.cl/siit/mapoteca/comunas). **No** basarse en documentos antiguos con 13 regiones. Antes de codificar, contrastar catálogo actual y su licencia/condiciones de reutilización; no inventar claves ni localidades.

## D-025. Sucursal predeterminada a partir de Nombre comercial

**Código actual:** `tradeName` y `defaultBranch` son campos de entrada independientes en `Companies.jsx`; `companyPayload` guarda ambos por separado. `EmployeeFile.jsx` usa `defaultBranch` al asignar la empresa al trabajador.

**Comportamiento aprobado:**
- En **empresa nueva**, rellenar Sucursal predeterminada con Nombre comercial mientras el usuario no haya modificado manualmente la sucursal. Si cambia Nombre comercial antes de tocar sucursal, actualizar la sugerencia.
- Si la persona escribe una sucursal distinta, respetarla incluso si luego edita Nombre comercial. No sobrescribir datos al cargar o guardar una empresa existente; para cambiar sucursal histórica o preconfigurada debe existir intención explícita.
- Si Nombre comercial está vacío, no inventar una sucursal ni copiar automáticamente datos de la Razón social.
- No confundir el valor predeterminado de Empresa con el valor individual de `extra.branch` en fichas ya guardadas. No reescribir fichas al cambiar empresa.
- Pruebas: empresa nueva; edición manual; edición de nombre comercial tras sobrescritura; carga de empresa antigua; sucursal histórica; actualización con revisión concurrente.

## D-026. Explicar y simplificar Valores sugeridos para nuevas fichas

**Código actual:** la sección opcional en `Companies.jsx` almacena `defaultAreaId`, `defaultPositionName` y `defaultSchedule`. `EmployeeFile.jsx` los utiliza solo para completar campos de Área, Cargo y Jornada vacíos al seleccionar una empresa. **No son datos obligatorios de la empresa ni sustituyen condiciones individuales**.

**Comportamiento propuesto:**
- Renombrar a **Configuración opcional para fichas nuevas** y mostrar descripción: «Estos campos son sugerencias iniciales al registrar trabajadores de esta empresa; pueden dejarse vacíos y modificarse en cada ficha».
- Plegar por defecto; no establecer un cargo o jornada único para empresas con puestos diversos.
- Conservar campos y valores existentes sin borrar ni alterar fichas; las sugerencias no deben cambiar trabajadores creados previamente.
- Evaluar si es preferible precargar solo Empresa y Sucursal y seleccionar explícitamente Área/Cargo/Jornada en cada nueva ficha. No forzar automatización de puestos sin acuerdo posterior.
- Probar la ausencia de sugerencias, preselecciones parciales, edición manual y conservación de fichas existentes.

## D-027. Nombre completo de ficha como referencia no editable

**Código actual:** `EmployeeFile.jsx` permite escribir en el campo `fullName` cuando `assembledWorkerName(draft)` está vacío; el `readOnly` es condicional. Los nombres individuales se usan para generar `fullName` y el nombre legal histórico se conserva por separado.

**Comportamiento aprobado:**
- Mostrar **Nombre completo** como referencia visual con fondo gris y estado no interactivo: sin cursor de edición, foco de texto o escritura; preferir salida semántica accesible (texto/`output`) estilizada para que lector de pantalla pueda leerla.
- Generarlo a partir de Primer/Segundo/Otros nombres y apellidos, en el orden vigente. No actualizar indebidamente `legalFullName` histórico.
- No permitir manipulación manual de `fullName` en la UI. Para fichas antiguas incompletas que solo tienen nombre completo histórico, conservar su valor como **referencia**, sin vaciarlo automáticamente y sin bloquear operaciones legítimas.
- Asegurar que el servidor siga conservando identidad correctamente ante peticiones de guardado. Probar escritura en cada campo parcial, cierre/reapertura, fichas históricas, accesibilidad y revisión concurrente.

## Dependencias y secuencia de entrega

1. Antes de todo: respaldo consistente de la **base aislada de SAGVA Gestión Laboral**; corroborar rama/commit local, separación `5183/4010` de Huella `5173/4000`, y plan de reversión probado. **No ejecutar `Actualizar.bat` durante INT-001.**
2. Estabilizar formulario de trabajadores: D-018 (búsqueda por RUT sin puntuación), D-019 (cerrar tras guardar sin perder cambios), D-020 (indefinido sin vencimiento hasta finiquito), D-021 (auditoría/limpieza visual de Sucursal), D-022 (ensayos temporales y RUT único).
3. D-023 (máscara de RUT en Empresas), compartiendo normalizador validado con fichas; D-025 (sucursal autocompletada de forma controlada) y D-026 (valores sugeridos opcionales).
4. D-027 (nombre completo informativo), con regresiones de identidades antiguas.
5. D-024 (catálogo territorial oficial de Chile), que requiere **datos oficiales exhaustivos, migración aditiva, validación backend y revisión de empresas históricas**; realizarlo como cambio separado para evitar mezclarlo con ajustes visuales.
6. Para cada PR: pruebas automáticas, compilación web, pruebas con datos sintéticos de navegador, integridad de datos, casos negativos, diferencias visuales y aprobación del propietario. No declarar un hito completado solo por merge o CI.
7. La actualización de la PC será **posterior**, con la rama local `int001-huella-codigo` revisada y procedimiento seguro; ningún archivo privado o dato personal en GitHub.

## Criterios de aceptación mínimos

- RUT empresa y representante: misma identidad al escribir con/sin puntuación; formato visible, dígito verificador validado y duplicado rechazado.
- Región, provincia, comuna y localidad: relaciones territoriales válidas; catálogo de Chile íntegro o ausencia explícita de catálogo para localidad, sin opciones inventadas; migración no destructiva de registros históricos.
- Sucursal predeterminada: coincide inicialmente con Nombre comercial, salvo edición manual que se respeta.
- Valores sugeridos: claramente opcionales; nunca aplicados por sorpresa a trabajadores existentes.
- Nombre completo: referencia gris no editable, generado desde componentes y preservado en fichas históricas.
