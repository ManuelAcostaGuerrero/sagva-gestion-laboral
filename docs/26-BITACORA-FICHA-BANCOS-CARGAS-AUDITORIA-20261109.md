# 26. Bitácora del proyecto: ficha única, banca, cargas, configuración y auditoría

**Fecha de registro:** 09-11-2026.  
**Producto:** SAGVA Gestión Laboral (`ManuelAcostaGuerrero/sagva-gestion-laboral`).  
**Estado:** requisitos y decisiones reunidos en conversación; **planificados, no implementados** salvo donde se indique expresamente.  
**Alcance:** solo `sagva-gestion-laboral`. No confundir con `asistencia-huella-digital`, `sagva-gestion-integral`, el ERP de ventas ni Propinas.

## 1. Propósito de esta bitácora

Mantener en un único documento la decisión, fundamento, estado, dependencia y criterio de aceptación de cada cambio acordado. Es una **bitácora del proyecto**, diferente de la **bitácora automática de movimientos de usuarios dentro de la aplicación**, que se especifica más adelante y aún no cubre de forma integral todas las operaciones.

La regla permanente es: no afirmar que un punto está implementado solo porque ha sido diseñado o redactado. Cada cambio de estado requiere código fusionado, pruebas y aceptación acordada.

## 2. Registro de requisitos consolidados

| ID | Decisión / necesidad | Estado al 09-11-2026 | Dependencia principal |
|---|---|---|---|
| BL-001 | **Ficha única con subdivisiones**: identificación, contacto, domicilio, vínculo con empresa/local, contratos, previsión/beneficios, datos administrativos, datos bancarios y documentos. Evitar mezclar dirección personal con empresa y previsión. | Reestructuración visual pendiente | Mantener datos y validaciones actuales sin pérdida |
| BL-002 | **Datos de pago del trabajador**: banco, tipo de cuenta, número, titular, RUT/titularidad y vigencia, más solicitud/autorización de transferencia. Solo accesibles a usuarios específicos con permiso. | No implementado; backend/ficha por diseñar | Permisos granulares, seguridad y auditoría |
| BL-003 | **Catálogo administrable de bancos de Chile**: precarga referenciada en CMF, agregar banco, renombrar, activar/desactivar y conservar IDs e históricos. No borrar bancos usados. | No implementado | Panel de catálogos, versionado, Root |
| BL-004 | **Cargas familiares**: `No / Sí, pendiente de reconocimiento / Sí, reconocidas`; mostrar detalle solo cuando corresponda; permitir múltiples causantes con estado, vigencia, institución y respaldo. | No implementado | Configuración, permisos, modelos de documento |
| BL-005 | **Asignación familiar**: montos/tramos y vigencias en Contabilidad Laboral, sin fijar en cada ficha ni calcular pago por una declaración no acreditada. | No implementado | Parámetros versionados y validación normativa |
| BL-006 | **Capa de configuración autoadaptable, de edición**: Root o Contabilidad autorizada cambia etiquetas, opciones, bancos, parámetros, visibilidad/obligatoriedad permitida de campos y reglas declarativas **desde interfaz**, sin tocar código o estructura de BD para cada cambio ordinario. | Parcialmente existe para AFP/Isapres y tasas; motor de definiciones de campos pendiente | Diseño metadata/versiones, API segura |
| BL-007 | **Root y permisos individuales**: roles base más concesiones/denegaciones por usuario, módulo, submódulo, campo, acción y local; administrador local NO modifica parámetros globales. | No implementado | Auditoría de accesos y migración de roles |
| BL-008 | **Bitácora operativa integral**: toda operación crítica, incluso de Root, debe dejar evento trazable; incluir cambios de catálogos, datos bancarios, permisos, campos, parámetros, contratos y autorizaciones. Acceso/edición de datos bancarios con trazabilidad y sin exponer números en logs. | Infraestructura básica existente; cobertura integral pendiente | Catálogo de eventos, servidor, permisos, conservación |
| BL-009 | **Enlace de autoregistro para personal nuevo**: trabajador ingresa datos personales, contacto, previsión y datos bancarios opcionales por sí mismo. Revisión/autorización antes de consolidar; no sobrescribir fichas existentes. | No implementado | Token seguro, formularios y control de identidad |
| BL-010 | **Separar documentación de pagos**: registrar ahora información y respaldos necesarios; nómina, liquidaciones y pagos se implementarán después. | Decisión vigente | Datos individuales, catálogos y contratos coherentes |
| BL-011 | **Conservación de históricos**: no borrar registros de trabajadores, datos anteriores, bancos usados, contratos firmados, valores históricos, autorizaciones, logs o asignaciones revocadas. | Criterio transversal aprobado; implementación según recurso | Migraciones aditivas e historiales |
| BL-012 | **Protección parental y subsidios**: mantener en investigación; estudiar permisos, evidencias mínimas, acceso y pagadores sin registrar información clínica innecesaria. | Investigación pendiente; no implementar en este lote | Análisis normativo y privacidad |

### Referencias de la conversación

- Un trabajador tendrá **una ficha**, subdividida visualmente por origen de información y finalidad.
- **Contabilidad Laboral** configura catálogos y parámetros; la ficha refleja el esquema publicado y guarda los valores individuales. **Root** administra políticas y permisos de cada usuario.
- El usuario Root podrá hacer **ediciones configurables**, no ejecutar código arbitrario: cambiar `FONASA` por otra etiqueta de presentación, o un banco por otro nombre, nunca cambiar el identificador técnico ni reinterpretar datos históricos silenciosamente.
- No limitarse a números de cargas: una carga tiene reconocimiento y vigencia propios.
- La gestión de bancos equivale a **altas, renombres y desactivaciones** de instituciones, no a eliminar registros asociados.
- Los registros de auditoría abarcan **también Root**, sin excepción privilegiada.

## 3. Diagnóstico de auditoría real del código revisado

**Corrección a una afirmación anterior:** SAGVA **sí tiene una base formal de auditoría**. Es incorrecto decir que no existe ninguna.

- `server/src/auditLog.js` define `recordAudit(admin, action, entityType, entityId, details, executor)` que inserta eventos en `audit_logs`, con identificador/usuario del administrador, acción, tipo e ID de entidad y detalles JSON.
- `server/src/routes/admin.routes.js` expone un listado de los últimos **80 eventos** a `admin` y registra, entre otras cosas, creación/cambio de rol de usuarios y regeneración de códigos de respaldo.
- `server/src/routes/laborAccounting.routes.js` registra creación/edición de instituciones y nuevas versiones de parámetros; adicionalmente `labor_entity_history` y `labor_parameter_versions` mantienen historial.
- Existen registros de cambios de documentos y anexos en rutas específicas.

**Lo que NO está acreditado:** captura uniforme de *todas* las operaciones críticas, lectura/exportación de datos bancarios (no existen esos campos), bitácora inalterable para Root, consulta avanzada de eventos, políticas de conservación y pruebas de cobertura exhaustiva. La bitácora requiere un proyecto de ampliación, **no un segundo sistema paralelo inventado**.

## 4. Especificación funcional de la bitácora operativa

Para cada evento crítico se deben registrar como mínimo:

- **ID irreversible del evento**, instante UTC, tipo de evento, versión de la aplicación.
- **Actor**: usuario técnico estable y rol/permisos efectivos; incluso `root` y acciones automáticas del sistema identificadas separadamente.
- **Objetivo**: ID técnico del trabajador, banco, permiso, catálogo, definición, contrato, documento o parámetro; empresa/local de contexto cuando exista.
- **Operación**: crear, editar, activar, desactivar, aprobar, revocar, consultar/exportar recurso sensible, fallo de autorización, iniciar sesión privilegiada.
- **Antes/después**: solo cambios no sensibles (ej. etiqueta del banco o fecha de vigencia); en datos bancarios, médicos y documentos registrar **nombres de campos, IDs, versión y resultado**, nunca número completo de cuenta, token, clave, PDF, diagnóstico o RUT en claro.
- **Motivo**, resultado (éxito, denegado, error), identificador de solicitud/correlación, sesión/control de origen según política de privacidad.
- **Integridad:** registro append-only, sin edición ni borrado desde interfaz de Root; definir mecanismo de evidencia de integridad/retención y resguardo independiente. No prometer inmutabilidad absoluta solo por agregar una tabla SQL.
- **Permisos:** vista con filtros por usuario, recurso, intervalo, acción y local, solo para auditores específicamente autorizados. El actor puede ser Root, pero sus propios eventos siguen siendo visibles en auditoría.
- **Transacciones:** mutación importante + bitácora coherentes; si falla el registro obligatorio, la operación sensible debe fallar o dejarse pendiente, no completarse silenciosamente.

Ejemplo **sintético**, sin datos personales:

```json
{
  "action": "bank_catalog.rename",
  "actor_user_id": 7,
  "actor_role": "root",
  "entity_type": "bank",
  "entity_id": "BANK_001",
  "changed_fields": ["display_name"],
  "before": {"display_name": "BANCO EJEMPLO"},
  "after": {"display_name": "BANCO EJEMPLO NUEVO"},
  "reason": "Actualización de denominación oficial",
  "result": "success"
}
```

**No es un registro real; muestra el formato objetivo.** Añadir pruebas automáticas de registro y acceso, incluyendo las operaciones de `root` y usuarios `contabilidad` autorizados.

## 5. Datos bancarios y fuentes

La cuenta bancaria es **dato personal financiero de exposición restringida**. No equipararlo automáticamente a un dato legalmente "sensible" en todos los regímenes, pero aplicar **protección elevada**: canal TLS seguro, cifrado de valores en reposo con gestión de claves fuera de SQLite y de Git, enmascarado al presentar, autorización por campo, mínimos privilegios, control de exportaciones, notificación de uso y auditoría de lectura/modificación.

**Solicitud del trabajador:** el artículo 54 del Código del Trabajo chileno contempla transferencia electrónica a solicitud del trabajador, a su cuenta, sin costo para él. El formulario debe registrar la solicitud de esa modalidad, su fecha y respaldo; no convertir el dato bancario en requisito absoluto de contratación si existen otras modalidades válidas. Referencia: https://www.bcn.cl/leychile/navegar?idNorma=207436 .

**Catálogo oficial de referencia:** Comisión para el Mercado Financiero, bancos establecidos en Chile: https://www.cmfchile.cl/portal/principal/623/w4-propertyvalue-29280.html . Antes de precargar, revisar nombres, códigos, fusiones, fechas y entidades bancarias efectivamente admisibles; no confundir marcas comerciales o billeteras con bancos. Root puede agregar una institución nueva con estado **pendiente de validación**, sin asumir que es un banco chileno reconocido por solo escribir un nombre.

## 6. Control de estados de implementación

Actualizar esta tabla únicamente con evidencia real:

| Paquete | Fecha propuesta | Rama/PR | CI | Windows / móvil | Aprobación propietario |
|---|---|---|---|---|---|
| Seguridad Root y permisos | Por definir | Pendiente | No ejecutado | No probado | Diseño aprobado, implementación pendiente |
| Auditoría transversal | Por definir | Pendiente | No ejecutado | No probado | Requisito aprobado, implementación pendiente |
| Subdivisión de ficha | Por definir | Pendiente | No ejecutado | No probado | Diseño solicitado, implementación pendiente |
| Catálogo de bancos + cuenta | Por definir | Pendiente | No ejecutado | No probado | Diseño solicitado, implementación pendiente |
| Cargas familiares y parámetros | Por definir | Pendiente | No ejecutado | No probado | Diseño solicitado, implementación pendiente |
| Autoregistro con enlace | Por definir | Pendiente | No ejecutado | No probado | Diseño solicitado, implementación pendiente |

Cada PR debe actualizar evidencia, incidencias, cambios de permisos y plan de reversión. No subir identidades, bancos, RUT, documentos ni logs reales al repositorio público.

**Plan técnico y secuencia:** [documento 27](27-PLAN-ACCION-FICHA-CAMPOS-BANCOS-CARGAS-AUDITORIA-20261109.md).

## Actualización técnica de BL-001 a BL-005 (09-11-2026)

Los bloques BL-001 a BL-005 pasaron de requisitos a **código integrado en la rama del PR #9 con CI verde** (último SHA funcional `d323d6db95e5ff2a3ea4469ecec20e9fa945e1e8`). Datos bancarios cifrados con permisos individuales por ID configurados fuera del repositorio, carga familiar por causante con historial, catálogo CMF y tramos SUSESO en Contabilidad Laboral. Permanecen pendientes uso local, verificación móvil y autorización de despliegue. No confundir con BL-006/007/008: aún no hay configurador general de campos, Root ni auditoría transversal completa. [Detalle](28-BL001-BL005-IMPLEMENTACION-EN-REVISION-20261109.md).
