# Ajuste de ficha contractual: campos auxiliares DT y resumen de turnos (12-11-2026)

**Repositorio:** `ManuelAcostaGuerrero/sagva-gestion-laboral`. Alcance: interfaz y texto de revisión del trabajador; sin migraciones ni modificaciones automáticas de registros existentes.

## 1. Campos retirados

Se retiran solamente de la ficha **«Fecha para evaluar la jornada (no se guarda)»** y **«Régimen de jornada a evaluar (no se guarda)»**. Eran parámetros *efímeros* para una consulta informativa, no datos contractuales persistidos ni exigencias autónomas de la DT.

Se conserva el servicio de evaluación normativa por vigencias y, cuando existen horas semanales, se consulta en pantalla el **límite referencial ordinario GENERAL vigente a la fecha actual en Chile**. Esa referencia **no clasifica** al trabajador ni su régimen, **no autoriza jornadas excepcionales** ni modifica el contrato. La vigencia jurídica para un contrato, y los regímenes especiales, deben revisarse formalmente por separado.

Fuentes:
- Artículo 10 N°5 del Código del Trabajo: duración y distribución de jornada; excepción relativa a turnos regulados por reglamento interno. https://www.suseso.gob.cl/612/w3-propertyvalue-69266.html
- Dirección del Trabajo, ORD. N°4523 y ORD. N°850 sobre claridad de distribución y turnos: https://dt.gob.cl/legislacion/1624/w3-article-107282.html y https://dt.gob.cl/legislacion/1624/w3-article-127180.html
- Resolución exenta DT N°38/2024 sobre registros electrónicos: https://www.bcn.cl/leychile/navegar?idNorma=1203415

## 2. Resumen automático de jornada

**Antes:** se listaba cada horario repetido cada día, para terminar cortando el texto arbitrariamente a **2.000 caracteres**. Esto podía ocultar turnos sin avisar.

**Ahora:**
1. Se agrupan únicamente **los días cuya selección completa de turnos es idéntica**.
2. Para cuatro alternativas o menos, el resumen presenta sus horas. Para más alternativas, muestra la cantidad, tres ejemplos y acceso desplegable al detalle íntegro.
3. El componente de selección permite ver al principio seis horarios por día, con botón para expandir el resto. También muestra el **detalle agrupado sin perder turnos**.
4. El resumen indica de forma expresa que las alternativas no equivalen a turnos simultáneos, y que la distribución del contrato debe quedar definida y ser revisada.
5. `shiftPlan` conserva la selección **completa**, con ID, nombre, inicio, fin y días. **Ningún turno se elimina ni se reescribe en los registros históricos**.
6. `shiftDistribution` sigue siendo **editable**. Si contenía un resumen autogenerado antiguo, al cambiar selección pasa al nuevo formato; si contiene texto manual distinto, se conserva y se ofrece el botón **«Usar este resumen en el texto guardado»** sin sobrescribirlo automáticamente.

### Ejemplo sintético

**Antes:** `LUNES: 35 turnos / ...; MARTES: mismos 35 / ...` repetido siete veces y truncado.

**Ahora:** `LUNES A DOMINGO: 35 alternativas de turno (ej.: 08:00–17:00, 08:01–17:01, 08:02–17:02; y 32 más). Ver detalle de horarios.`

**Advertencia:** eso es una vista de revisión de *opciones* y no establece una cláusula contractual válida sobre una jornada efectiva de 245 turnos. La combinación definitiva de días, horario, descansos y régimen exige validación humana.

## 3. Pruebas y alcance

- Test unitario `server/src/__tests__/contract-shift-summary.test.js`: 7 días × 35 alternativas, grupos diferentes, vacíos, cambios manuales, compatibilidad con texto antiguo y no truncamiento.
- Validaciones generales del proyecto: `npm test --workspace server`, `npm run build --workspace client` y CI GitHub.
- Aún requiere observación de UX en instalación local Windows y revisión jurídica de cada distribución efectiva antes de elaborar un contrato.
- Sin cambios de base de datos, parámetros DT persistentes, contratos firmados ni registros de asistencia.

**Política:** integrar a `main` del producto de **pruebas** tras aprobar CI; actualizar el PC únicamente mediante el flujo manual autorizado.
