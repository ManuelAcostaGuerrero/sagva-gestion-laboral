# 16. Auditoría previa de los tres campos inferiores y plan de correcciones de ficha

**Fecha:** 04-11-2026. **Estado:** diagnóstico de código VERIFICADO; contenido de la SQLite real PENDIENTE DE AUDITORÍA LOCAL. **No es una orden de despliegue ni una fase INT aceptada.**

## Diagnóstico comprobado en `main`

| Campo | Hecho verificado en el código | Tratamiento propuesto |
|---|---|---|
| Sucursal inferior | `client/src/EmployeeFile.jsx` muestra arriba un selector **Sucursal** y abajo un campo libre **Sucursal**. Ambos leen y escriben `draft.extra.branch`. **Es una duplicación visual del mismo valor**, no dos columnas independientes. | Mantener solo el selector superior una vez verificado que permite revisar y corregir los valores históricos necesarios. No vaciar `extra.branch`. |
| Unidad jerárquica | Es `extra.hierarchyUnit`, separado de `work_area_id` y `position_name` (Área y Cargo). `server/src/importWorkerInfo.js` puede cargarlo de `CODIGO JERARQUIA`. | No declararlo duplicado de Área/Cargo ni borrar datos. Considerar moverlo a «Datos administrativos adicionales», inicialmente no obligatorio. |
| Centro de costo | Es `extra.costCenter`, distinto de Empresa, Sucursal, Área y Cargo. Puede importarse de `CENTRO COSTO`. | Conservarlo para contabilidad/remuneraciones. Moverlo a información administrativa opcional si la auditoría lo permite. |

**Relación con Empresa:** `company_profiles.default_branch` es una sucursal *predeterminada* por empresa, mientras `employee_files.extra_json.branch` guarda la sucursal de cada ficha, incluso una histórica. Todavía no hay catálogo normalizado de múltiples locales en esta ficha. La diferencia de valores puede ser legítima: **nunca reasignar la sucursal del trabajador solo por coincidir o diferir del valor predeterminado**.

**Persistencia:** `employee_files.extra_json` conserva los tres atributos en JSON; su API los recibe y los vuelve a guardar. Ocultar controles no es permiso para eliminar claves, importar nuevos valores, cambiar empresa/local ni reconstruir fichas históricas.

## Puerta previa: comprobar la base local sin cambiarla

El código público no contiene las fichas reales. La base utilizada en el PC se resuelve desde `server/.env` y permanece en la instalación privada de **Gestión Laboral**, no en Huella original. Para determinar cuántos trabajadores tienen esos campos informados hace falta **ejecutar una auditoría local de solo lectura** y revisar únicamente resultados agregados; jamás publicar datos individuales en GitHub, PR, capturas, logs ni CI.

**No ejecutar `Actualizar.bat` en INT-001, no cambiar la rama local `int001-huella-codigo`, no detener procesos ajenos, no importar, no migrar ni copiar bases entre proyectos para esta inspección.**

### Consulta reproducible y de solo lectura (Windows PowerShell)

Ejecutar **solo en la carpeta** `C:\Users\Admin\Documents\Codex\sagva-gestion-laboral` con Node 24+ y las dependencias existentes. Comprueba explícitamente que el archivo SQLite ya existe y lo abre con `readOnly:true`; no lo crea ni escribe. Imprime **solo cantidades**, no nombres, RUT, claves, empresas ni rutas.

```powershell
cd 'C:\Users\Admin\Documents\Codex\sagva-gestion-laboral'
@'
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';
import { resolveDatabasePath } from './server/src/databasePath.js';

const config = dotenv.parse(readFileSync('server/.env'));
const file = resolveDatabasePath(config);
if (file === ':memory:' || !existsSync(file)) throw new Error('No existe una base SQLite persistente de SAGVA para auditar.');
const db = new DatabaseSync(file,{readOnly:true,timeout:5000});
try {
  db.exec('PRAGMA query_only=ON');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('employee_files','company_profiles')").all();
  if (tables.length !== 2) throw new Error('Faltan tablas esperadas; revisar migraciones sin modificarlas.');
  const q = `
  WITH fichas AS (
    SELECT f.company_id, cp.default_branch,
      CASE WHEN json_valid(f.extra_json) THEN f.extra_json ELSE '{}' END AS j,
      CASE WHEN f.extra_json IS NOT NULL AND NOT json_valid(f.extra_json) THEN 1 ELSE 0 END AS json_invalido
    FROM employee_files AS f
    LEFT JOIN company_profiles AS cp ON cp.id = f.company_id
  ), datos AS (
    SELECT company_id, default_branch, json_invalido,
      TRIM(COALESCE(CAST(json_extract(j,'$.branch') AS TEXT),'')) AS sucursal,
      TRIM(COALESCE(CAST(json_extract(j,'$.hierarchyUnit') AS TEXT),'')) AS unidad,
      TRIM(COALESCE(CAST(json_extract(j,'$.costCenter') AS TEXT),'')) AS centro
    FROM fichas
  )
  SELECT
    COUNT(*) AS fichas_total,
    COALESCE(SUM(unidad <> ''),0) AS unidad_jerarquica_con_dato,
    COALESCE(SUM(centro <> ''),0) AS centro_costo_con_dato,
    COALESCE(SUM(sucursal <> ''),0) AS sucursal_con_dato,
    COALESCE(SUM(sucursal <> '' AND company_id IS NULL),0) AS sucursal_sin_empresa_vinculada,
    COALESCE(SUM(sucursal <> '' AND company_id IS NOT NULL AND
      TRIM(COALESCE(default_branch,'')) <> '' AND
      UPPER(sucursal) <> UPPER(TRIM(default_branch))),0) AS sucursal_diferente_predeterminada,
    COALESCE(SUM(json_invalido),0) AS json_invalido
  FROM datos`;
  console.log('AUDITORIA SOLO LECTURA (cantidad de fichas, sin datos personales)');
  console.log(JSON.stringify(db.prepare(q).get(),null,2));
} finally {
  db.close();
}
'@ | node --input-type=module
```

**Alcance del resultado:** una cantidad mayor a cero demuestra que hay valores almacenados; **cero no demuestra que el atributo no tenga valor comercial futuro**. `sucursal_diferente_predeterminada` significa revisar diferencias; **no autoriza corregirlas automáticamente**. Si `json_invalido` es mayor que cero, detener el cambio de interfaz y diagnosticar la integridad del JSON de forma privada. Si no hay fichas, documentar explícitamente que la instalación de prueba carece de datos y no extrapolarlo a Huella original ni a producción.

El comando no se ha ejecutado desde ChatGPT en el PC. No afirmar «campos vacíos» ni «migración segura» hasta tener resultado local verificable.

## Orden de las próximas correcciones (sin ejecutar todavía)

1. **Diagnóstico y respaldo:** auditar las cantidades de esos campos en SQLite de Gestión Laboral, conservar respaldo consistente comprobado y verificar que el entorno independiente usa web `5183` / API `4010`. No tocar Huella original (`5173`/`4000`).
2. **D-018, RUT:** en buscadores de fichas, comparar texto de RUT sin puntos/guion y sin distinción de `K/k` (ambos lados). Conservar búsqueda por nombre/empresa y filtros. Pruebas con variantes y registros ficticios.
3. **D-019, guardado seguro:** cerrar ficha tras **guardado exitoso de todas las secciones involucradas**; mostrar confirmación y volver a lista. Si falla algo o queda borrador pendiente, no cerrar ni perder cambios. Pruebas de varios módulos.
4. **D-020, indefinido:** contrato `INDEFINIDO` vigente sin fecha de término programada; fecha efectiva solo cuando se finaliza expresamente la relación, con motivo y auditoría. No inferir finiquito por estado inactivo. No eliminar silenciosamente fechas históricas. Plazo fijo conserva fecha y anexos.
5. **D-021, limpieza de tres campos:** después de evaluar la auditoría local, eliminar únicamente la duplicación visual inferior de **Sucursal**, asegurando que se pueda acceder a una sucursal histórica y corregirla con permisos; ocultar o reagrupar **Unidad jerárquica** y **Centro de costo** como administrativos opcionales **sin borrar sus valores ni equipararlos a Área/Cargo**. Si la sucursal real de un trabajador difiere de la predeterminada, preservar ambas y resolver el catálogo de locales antes de migrar/normalizar.
6. **Pruebas y revisión:** pruebas servidor + compilación, pruebas de navegador con datos sintéticos, respaldos, valor de cada campo antes/después, validación con propietario, protección de ediciones concurrentes; registrar cambios, regresiones y plan de reversión.
7. **Publicación y PC:** una vez aprobado el código y GitHub CI, planificar instalación segura en la rama local correspondiente. El actualizador manual `Actualizar.bat` sigue **no habilitado** para INT-001; no recomendar `git reset`, cambiar de rama, importar datos reales o actualizar sobre procesos en servicio sin procedimiento verificado.

## Criterios de aceptación de D-021

- La ficha muestra una única **Sucursal** visible/editable de forma segura; la persistencia de `extra.branch` no cambia al guardar otros campos.
- Se conservan íntegramente `extra.hierarchyUnit`, `extra.costCenter`, `extra.branch`, `company_profiles.default_branch` y los históricos. Campos opcionales existentes pueden consultarse por rol autorizado y recuperarse si fueran necesarios.
- No se asigna un local, área, cargo ni centro de costo basándose en texto parecido.
- No se modifican horarios, contratos, marcaciones, huellas, permisos o información médica al simplificar la ficha.
- Hay prueba de paridad visual/funcional e informe de datos **agregados** de la auditoría local.
