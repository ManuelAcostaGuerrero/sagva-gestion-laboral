# SAGVA Gestión Laboral — Paso 1: arquitectura modular y ciclo laboral (1A–1E)

**Versión de trabajo:** PR #22 `feat/labor-estructura-integral-1a-1e-20261111` **basado en** PR #21 → PR #20 → PR #19. **Estado: beta en borrador; no integrar a `main` ni desplegar en la instalación real antes de revisar pruebas y autorizar.**

## 1. Objetivo y decisión técnica

Un **monolito modular** en Node.js + Express + React, con SQLite para desarrollo y beta. No introducir microservicios ni una segunda copia de Personas, Empresas o Marcaciones. La estrategia de producción y evaluación de PostgreSQL se define después, según la certificación de asistencia DT y la infraestructura central necesaria.

**Modelo de identidad**: `employees.id` identifica permanentemente a una persona. `employment_relationships` identifica cada contratación de esa persona por empresa y período, incluso recontrataciones. La misma persona puede mantener relaciones simultáneas con empresas **diferentes**, sin mezclar comprobantes ni atribuir marcas por coincidencia de nombre.

**Relaciones, asignaciones y condiciones**: las nuevas tablas P2/P3 de los PR #19/#20 ya existen como modelo; reutilizarlas, no duplicarlas. Una nueva vigencia se registra con motivo/documento, usuario, fecha y auditoría. Nunca reescribir sueldo, cargo, institución previsional ni asistencia de un período pasado.

**Advertencia contractual:** la fecha documental de un PDF se registra por separado de la fecha de ingreso, sin retrofechar automáticamente su firma. Un identificador `evidenceRef` en el formulario no prueba por sí solo que exista un contrato firmado. Los documentos firmados deben cargarse y revisarse de forma independiente. No confundir `confirmed_by` (validación interna) con una firma o autorización DT.

## 2. Arquitectura y ubicación real del código

```text
client/src/
  main.jsx                                  # entrada y navegación
  EmployeeFile.jsx                          # ficha única ya existente; no clonar
  Companies.jsx                             # datos legales empresa ya existente
  modules/labor-structure/LaborStructure.jsx # ciclo laboral desde pantalla Root

server/src/
  app.js                                   # rutas API
  auth.js                                  # sesión y perfil vigentes
  securityPermissions.js                   # Root/permisos preexistentes
  db.js                                    # transacciones/SQLite existentes
  employmentHistory.js                     # P2 relaciones, asignaciones y condiciones
  normalizationExpand.js                   # P3 proyección de identidad y previsión
  dtJornadaNormativa.js                    # límites históricos y avisos DT
  modules/labor-structure/
    laborStructure.migration.js             # migración 035 aditiva, eventos/documentos/turnos
    laborStructure.repository.js            # consultas estructuradas, historial
    laborStructure.service.js               # reglas, validaciones, transacciones y auditoría
    laborStructure.routes.js                # HTTP validado y limitado a Root
    laborStructure.test.js                  # pruebas sintéticas de regresión
```

**Separación de responsabilidades:**
- **UI:** captura datos, muestra las fechas de vigencia, indica origen y resultado; no hace SQL ni decide permisos.
- **Routes:** validación Zod, autenticación Root, estado HTTP 400/403/404/409 y entradas estrictas.
- **Services:** reglas de contratación, término, recontratación, cargo/local, condiciones, turnos y previsión. Cada operación ejecutada en una sola transacción con auditoría.
- **Repository:** consultas de catálogos, historia y evidencia documental. No escribe.
- **Migración:** crea sólo nuevas estructuras; prohibido transformar automáticamente `employee_files.extra_json`, `employee_contract_terms`, marcaciones o archivos anteriores.

## 3. Modelo relacional y fuente oficial

| Entidad | Tabla existente o nueva | Fuente de verdad | Regla |
|---|---|---|---|
| Persona | `employees` | Identidad única y RUT, no su empleo actual | No duplicar por cambio de empresa |
| Ficha legado | `employee_files` | Datos vigentes todavía usados por pantallas anteriores | Mantener lectura/consumidores, sin borrar JSON |
| Empresa | `company_profiles` | RUT, razón social, dirección y datos legales actuales | Reutilizar módulo Empresas existente |
| Local | `company_branches` (P2 + campos dirección/revisión 035) | Pertenencia a una empresa | Código único por empresa, estado y revisión |
| Contratación | `employment_relationships` (P2) | Períodos y empresa de cada contrato laboral | Rechazar solapamientos misma empresa |
| Cargo/área/local | `employment_assignments` (P2) | Asignación efectiva en fecha | Solo cerrar vigencia anterior, nunca modificar cargo previo |
| Sueldo/condiciones | `employment_terms_versions` (P2) | Estado económico/contractual a fecha | Valor anterior intacto, fuente documental |
| Horario vinculado | `employment_shift_versions` (035) | Biblioteca de turno elegida por empleo y fecha | No modifica `work_shifts` ni calendario pasado |
| Previsión | `employee_prevision_versions` (P3) | AFP/salud/plan a fecha | Cambios por nueva vigencia, no copiar JSON sin revisión |
| Documentos | `employee_contract_files` + `employment_documents` (035) | BLOB PDF original; vínculo a relación, fecha documental explícita | Mismo trabajador, fecha aportada por usuario y documento inmutable |
| Marcaciones | `attendance_records` | Marca original, no actualizar desde esta fase | Enlace explícito sólo con evidencia, no inferir |
| Evento laboral | `labor_lifecycle_events` (035) | Bitácora append-only HIRE/END/ASSIGNMENT/CONDITIONS/SHIFT/DOCUMENT | No UPDATE/DELETE |
| Auditoría | `audit_logs` | Acción, autor y referencia | Obligatoria dentro de la transacción |

**Parámetros legales:** en condiciones se requiere elegir explícitamente régimen GENERAL/SPECIAL/EXEMPT. La consulta versionada de jornada del PR #21 devuelve una advertencia no bloqueante si se supera el máximo del régimen general; un régimen especial/exento se marca como **no evaluado**, nunca se aprueba automáticamente.

**Vigencias**: contratos terminados usan `ended_on` **inclusivo** (ej. termina el 30 y reingresa el 1). Asignaciones, sueldo, turnos y previsión utilizan `valid_until`/`effective_until` **exclusivo**. Al cambiar se cierra sólo la columna de fin de la fila anterior; el resto de su contenido permanece intacto. Triggers SQL rechazan otras modificaciones y eliminaciones. Para cambios retroactivos/correcciones de períodos ya cerrados sigue faltando el procedimiento formal con fuente y aprobación; no se puede reescribir la evidencia silenciosamente.

## 4. Entregables y comprobación de cada fase

| Fase | Operaciones disponibles | Criterios de aceptación |
|---|---|---|
| **1A Empresas/locales** | Empresas preexistentes + crear/editar/desactivar locales por empresa | Código único, revisión optimista, rechazo de baja con asignación activa, no alterar otra empresa |
| **1B Persona/relación** | Ficha única preexistente + contratar, terminar, recontratar y consultar cada relación | No duplicar persona; solapamientos misma empresa bloqueados, varios empleos distintos permitidos |
| **1C Cargo/contrato/anexo** | Traslado de local/área/cargo, versión de sueldo/condiciones y vínculo a PDF contractual ya cargado | Una versión no sobrescribe otra; archivo corresponde al mismo trabajador; ninguna firma inventada |
| **1D Jornada/previsión** | Turno por vigencia, horas pactadas y versión AFP/Fonasa/Isapre | Calendario contractual separado de marcas reales; límites legales por fecha desde PR #21; históricos inmutables |
| **1E Integración** | Nueva sección React, API, lectura a fecha, eventos, audit trail y pruebas | Flujo desde interfaz y API, operaciones atómicas, FK=0, sin SQL manual en flujo de usuario |

**Endpoints Root (ejemplo):** `GET /api/labor-structure/catalog`, `GET /workers/:id`, `GET /workers/:id/as-of?on=AAAA-MM-DD`, `POST /branches`, `PUT /branches/:id`, `POST /employments`, `POST /employments/:id/finish`, `POST /employments/:id/assignments`, `POST /employments/:id/conditions`, `POST /employments/:id/shifts`, `POST /workers/:id/prevision`, `POST /employments/:id/documents`.

La interfaz utiliza la pantalla antigua de ficha para crear personas y la pantalla antigua Empresas para datos legales. **No reemplazar componentes ya operativos**; el módulo nuevo agrega los flujos de relación e historial.

## 5. Seguridad obligatoria

1. **Acceso a nuevas APIs restringido a perfil `root` comprobado en backend** en cada solicitud. Los JWT antiguos que dicen solamente `role=admin` no bastan para consultar/mutar datos del módulo.
2. Esta restricción no constituye aislamiento global multiempresa; las rutas heredadas `/api/companies`, `/api/employee-files`, `/api/attendance`, `/api/contract-files`, etc., deben auditarse antes de habilitar administradores locales. El proyecto NO se considera seguro para multiempresa delegada mientras exista una ruta que permita acceder a otra empresa.
3. Cualquier cambio de permisos posterior debe ser **scope-aware** y probar el acceso cruzado negativo por empresa y local, incluyendo PDFs, reportes, descargas y filtros de búsqueda.
4. Root, `.env`, JWT, claves bancarias, tokens QR, credenciales de prueba y datos personales nunca van a Git. Guardar solo evidencia sintética y totales.
5. No borrar ni modificar historia de asistencia ni documentos contractuales; conservar `audit_logs` completos.

## 6. Guía de ejecución beta, sin tocar producción

**Repositorio único:** `ManuelAcostaGuerrero/sagva-gestion-laboral`. **Rama:** `feat/labor-estructura-integral-1a-1e-20261111`. Trabajar en una copia independiente fuera de la carpeta `C:\\Users\\Admin\\Documents\\Codex\\sagva-gestion-laboral` de producción. No sustituir `server/.env` del principal ni correr allí `Actualizar.bat`. No fusionar a `main`.

1. Crear entorno beta desde la rama; `npm ci`.
2. `npm run test:server`. Debe incluir `laborStructure.test.js`, P2/P3, DT y pruebas preexistentes. Rechazar cualquier regresión.
3. `npm run build --workspace client` y `node tools/validate-update.mjs`.
4. En una copia beta vacía ejecutar `node tools/crear-base-ensayo-dt.mjs > .local/clean-database.json` y `node tools/configurar-beta-dt.mjs`, respetando la guardia que impide rotar una beta ya configurada.
5. Iniciar `node tools/iniciar-beta-dt.mjs` desde la beta; sólo `127.0.0.1:5195` y API `4022`, verificando que están libres y que `4010/5183` del principal continúan intactos.
6. Navegar el nuevo módulo Root y crear solo datos sintéticos: Empresa A + locales; Persona A; contratar, asignar local/área/cargo/turno/sueldo, cambiar sueldo y área con fecha futura; vincular un PDF ficticio; finalizar y recontratar después del término; consultar as-of.
7. Intentos negativos: fecha inválida, contrato superpuesto, local de otra empresa, permiso sin Root, dos guardados de vigencia en igual fecha, alteración directa de históricos, PDF de otra persona, anulación/borrado de hechos pasados, acceso cross-company en rutas heredadas.
8. Validar integridad de SQLite (`PRAGMA integrity_check`, `foreign_key_check`) y restauración de **beta** en copia aislada. Comprobar que el principal conserva sus PID, commit, SQLite, Root y configuración sin cambios.
9. Revisar navegador PC y teléfono físico, guardar evidencia sin datos personales y emitir informe APROBADO/FALLIDO/PENDIENTE por 1A–1E.
10. Después, revisar PR #19 → #20 → #21 → #22 en ese orden. Integración, migración real y reemplazo del método de asistencia requieren **aprobación separada**.

## 7. Brechas y tareas futuras; no confundir con trabajo cerrado

- **Aislamiento de todas las rutas heredadas:** los endpoints Root de esta fase están protegidos, pero permisos detallados por usuario/empresa/local siguen pendientes. No activar delegación.
- **Integración completa de consumidores:** fichas antiguas, reportes, turnos y marcaciones siguen leyendo partes del modelo legado; hacen falta migraciones de lectura controladas, adaptadores y conciliación de datos históricos individualizados con documentación real.
- **Transiciones con retroactividad:** el flujo normal admite nuevas vigencias posteriores; no implementa correcciones arbitrarias de versiones cerradas ni recuperaciones sin documento.
- **Documentos/firma:** vincular un PDF existente NO significa contrato firmado ni comprobación de validez jurídica. Generación/firma legal y aprobación de anexos requieren procesos separados.
- **Jornadas:** no equivalen a horas extraordinarias autorizadas. Horarios laborales, calendario y relación contractual deben reconciliarse antes de reportar remuneraciones.
- **DT:** el PR #21 es parcial. Faltan comprobantes completos, verificación pública segura, portal fiscalizador, auditoría con rectificación/oposición, alta disponibilidad y retención, certificación de tercero y autorización DT. No sustituir método legal vigente.
- **Motor de BD:** SQLite es válido para la beta aislada, pero PostgreSQL/plataforma central requiere decisión y pruebas de migración independientes. No cambiar base real por simple refactorización.
- **Evidencia física:** pruebas GitHub/Linux no validan en Windows físico ni teléfono de usuario; hacer esas pruebas antes de aceptar despliegue.

## 8. Criterio de cierre del PR

Un PR no se aprueba solo por existir una vista o tabla. Exigir: CI verde, flujo UI+API comprobado en beta, historial por fecha, rollback correcto, pruebas negativas de permisos y alcance de PR documentado; además respaldo/restauración y aceptación de la persona propietaria antes de cualquier instalación real.

**Registro de cambios de esta rama:** no se han migrado, importado, eliminado ni modificado fichas, contratos, marcaciones, empresas o documentos de producción. Las pruebas son enteramente sintéticas.
