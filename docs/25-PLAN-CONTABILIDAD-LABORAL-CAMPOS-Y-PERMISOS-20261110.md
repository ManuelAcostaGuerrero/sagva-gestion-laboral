# 25. Plan para la próxima sesión: Contabilidad Laboral, campos y permisos

**Plan original previsto para el martes 10-11-2026; ampliado con acuerdos del 09-11.**  
**Producto:** SAGVA Gestión Laboral, repositorio `ManuelAcostaGuerrero/sagva-gestion-laboral`.  
**Estado:** planificación autorizada para preparar trabajo posterior; **no se implementan aún cambios de usuarios, tablas, roles, contratos ni parámetros** con este documento.  
**Base verificada al redactar:** `main` commit `0caa8607e1389d0325301d9d098dd64a18e8af3e`.  
**Continuación vigente:** [bitácora completa](26-BITACORA-FICHA-BANCOS-CARGAS-AUDITORIA-20261109.md) y [plan de acción por entregas](27-PLAN-ACCION-FICHA-CAMPOS-BANCOS-CARGAS-AUDITORIA-20261109.md), que incorporan bancos, ficha subdividida, cargas, autoregistro y ampliación de auditoría.  
**Relación:** [cierre funcional reciente](24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md), [Contabilidad Laboral actual](23-CONTABILIDAD-LABORAL-20261109.md), [fases INT](02-PLAN-DE-INTEGRACION.md).

## 1. Decisión de producto y alcance

SAGVA debe reunir desde ahora los **datos laborales, contractuales, previsionales y de beneficios que sean necesarios y legítimos** para futuros cálculos de remuneraciones, pero **sin construir todavía el motor de liquidaciones, nómina ni pagos**.

**Centro de configuración:** `Gestión → Contabilidad Laboral` concentra:
- los **catálogos** (AFP, Isapres, asignaciones, conceptos de descuentos y beneficios);
- los **parámetros legales o económicos**, tablas y tramos con valor, fuente y vigencia;
- la **definición administrable de campos** que corresponda mostrar en las secciones laborales y contractuales, con tipo, regla y permisos;
- el **historial y la auditoría** de toda modificación de estructura o parámetros.

**Pantallas consumidoras:** `Personal → Ficha del trabajador` y `Contratos y anexos` muestran y permiten completar **los valores individuales del trabajador o las condiciones pactadas**, de acuerdo con los campos configurados. **No editan las definiciones globales, las tasas legales, las tablas ni los tramos.** La fuente de configuración es única: no duplicar definiciones.

**Regla de cautela:** una pantalla dinámica NO podrá alterar libremente campos legalmente esenciales o estructuras críticas que requieren validación, migración y control de contratos firmados. Los datos sensibles se minimizan y se muestran por autorización específica.

## 2. Diagnóstico del estado actual, verificado en código

- `server/src/auth.js` firma JWT con `role` y `requireRoles` se basa en esa cadena; roles existentes: `admin`, `supervisor`, `operator`.
- `server/src/routes/admin.routes.js` permite crear/cambiar usuarios **solo a `admin`**; no existe `root` ni `contabilidad` en el catálogo de roles.
- `server/src/routes/laborAccounting.routes.js` permite **escritura de parámetros e instituciones a `admin`**; `admin` y `supervisor` ven la información completa; los demás roles solo reciben el catálogo de consulta.
- `client/src/LaborAccounting.jsx` usa `role==='admin'` para mostrar controles de edición; necesita adecuarse a permisos y no solo cadenas de rol.
- `server/src/routes/employeeFiles.routes.js` permite guardar fichas a `admin`, `supervisor` y `operator`; `contractTerms.routes.js` permite guardar condiciones contractuales a `admin` y `supervisor`. Hay que preservar la operación autorizada.
- La información de empresa/local existe, pero **no hay todavía una política integral demostrada de aislamiento por local para todos los endpoints**. Renombrar `admin` a `admin_local` sin revisar consultas y escrituras dejaría accesos cruzados.
- El módulo actual guarda versiones de parámetros e historiales. No existe un **catálogo dinámico general de definiciones de campos**, ni motor de liquidaciones. Estas capacidades deben diseñarse como evolución compatible, no reescritura.

**Riesgo detectado:** si se conserva `admin` como editor global y simplemente se agrega `root`, los administradores de local seguirían modificando parámetros. **Primero se corrige la autorización del servidor**; el menú solo refleja permisos, no es la barrera de seguridad.

## 3. Modelo propuesto de roles

| Rol | Alcance | Facultades principales | Prohibiciones importantes |
|---|---|---|---|
| `root` | Global, bajo control del propietario | Administrar identidades, roles, asignaciones de locales, políticas y todos los parámetros; autorizar modificaciones estructurales | No saltarse auditoría ni destruir historiales |
| `contabilidad` | Global o empresas asignadas, según permiso | Consultar/configurar catálogos, tramos, tasas, vigencias; editar definiciones de campos **solo si `root` concede el permiso explícito** | No crear `root`, elevar privilegios, acceder a salud clínica ni modificar usuarios por defecto |
| `admin_local` | Empresa/sucursal autorizada | Gestionar trabajadores, fichas individuales, contratos y asistencia de sus locales según permisos | **No** crear ni modificar definiciones de campos, tablas tributarias, tasas, tramos o catálogos globales |
| `supervisor` | Locales asignados | Supervisión y operaciones autorizadas, lectura de resultados aplicables | No editar configuración global |
| `operator` | Locales asignados | Marcaciones/tareas operativas y lectura necesaria | No editar configuración global ni información sensible fuera de su función |

**Distinción crítica:** `labor.fields.manage` modifica **qué campos existen, sus opciones, reglas y visibilidad**; `labor.values.write` registra **respuestas de un trabajador** dentro de la ficha. Un administrador local puede obtener el segundo permiso, pero jamás el primero.

El rol `contabilidad` tendrá capacidad de configuración normativa (`labor.parameters.manage` y `labor.catalogs.manage`) **dentro de su alcance**; `labor.fields.manage` requiere autorización expresa. El `root` controla la asignación y revocación. Esta separación permite la opción pedida: los cambios los realiza `root` o un usuario autorizado de Contabilidad, **nunca el administrador de local**.

### Permisos mínimos propuestos

| Acción / permiso | Root | Contabilidad | Admin local | Supervisor | Operador |
|---|---|---|---|---|---|
| Administrar roles/permisos/alcances: `access.manage` | Sí | No | No | No | No |
| Modificar definición de campos: `labor.fields.manage` | Sí | Solo delegado | No | No | No |
| Crear/editar catálogo previsional: `labor.catalogs.manage` | Sí | Según alcance | No | No | No |
| Modificar tasas/tramos/versiones: `labor.parameters.manage` | Sí | Según alcance | No | No | No |
| Consultar parámetros aplicables: `labor.parameters.read` | Sí | Sí | Solo lectura | Solo lectura si procede | Catálogos necesarios |
| Guardar datos individuales: `labor.values.write` | Solo cuando corresponda | Si se asigna | Sí, solo su local y campos autorizados | Según función | Solo campos permitidos |
| Modificar contratos: `contracts.write` | Solo autorizado | Según asignación, no por defecto | Sí, dentro de atribuciones | Según asignación | No por defecto |
| Ver información sensible: `sensitive.read` o permisos por dominio | Solo con trazabilidad | No por defecto | No por defecto | No por defecto | No |

**No modelar `root` como «puede leer todas las fichas médicas sin justificación»**. Los permisos clínicos deben seguir separados, auditados y mínimos. La administración global de acceso no anula normas de privacidad.

## 4. Diseño del configurador de campos

Ubicación propuesta: `Gestión → Contabilidad Laboral → Configuración de campos`. Administrado por `root` o `contabilidad` con `labor.fields.manage`.

**Metadatos de una definición:** código estable e inmutable, etiqueta, descripción, grupo, destino (`FICHA`/`CONTRATO`/otros permitidos), tipo (`BOOLEAN`, `TEXT`, `DATE`, `MONEY`, `PERCENT`, `SELECT`, `DOCUMENT`), opciones, si se exige, condición de visibilidad, validaciones, clasificación de sensibilidad, permisos de lectura/escritura, vigencia, estado, revisión y motivo.

**Persistencia:** definiciones versionadas, opciones/versiones, valores individuales asociados a IDs estables y trabajador, fecha de inicio/fin, procedencia, documento acreditativo si corresponde, historial de cambios y autor. Separar definición del valor; no reconstruir los contratos con un JSON arbitrario que ignore requisitos legales.

**Prohibiciones:** no borrar físicamente definiciones usadas, no reinterpretar valores históricos al cambiar una lista, no cambiar el tipo de un campo usado sin una migración explícita, no eliminar anexos firmados ni alterar condiciones contractuales anteriores. Las modificaciones importantes se preparan con simulación de impacto, confirmación y trazabilidad.

**Formularios:** la ficha y los contratos consultan un esquema publicado con versión, validan servidor además de cliente, muestran solo campos aplicables, admiten casos pendientes/documentación incompleta y evitan sobrescrituras concurrentes. **Las definiciones globales no se editan desde las fichas.**

## 5. Catálogo de información que queremos preparar para remuneraciones

### Individual, en la ficha del trabajador

- AFP y cambio de AFP; sistema de salud, Isapre y plan individual; fechas de vigencia.
- Cargas familiares **declaradas vs. oficialmente reconocidas**, una entrada por causante cuando sea necesario, resolución/institución, vigencia, estado y documento. No generar pago por una declaración no acreditada.
- APV/ahorro voluntario y descuentos individuales **autorizados**, montos/tipos/vigencia, respaldo y topes cuando correspondan.
- Situaciones de protección laboral, permisos y licencias, **datos mínimos** y acceso restringido; evitar diagnósticos/antecedentes reproductivos innecesarios.
- Datos bancarios o de medio de pago **solo si son necesarios y están protegidos**, con permisos separados. La gestión de pagos no se implementa ahora.

### Pactado, en contratos y anexos

- Sueldo base y vigencias, jornada/horas, tipo de contrato, modalidad de gratificación.
- Bonos y beneficios contractuales, movilización/colación pactadas, comisiones y condiciones relevantes **sin confundir haberes tributables e imputaciones**, según tratamiento futuro confirmado.
- Firma/respaldo, aprobaciones, historial y reglas contractuales de cambio.

### Común y versionado, en Contabilidad Laboral

- Mantener AFP/comisión, cotización de salud, topes y aportes empleador existentes.
- Agregar **tramos y montos de asignación familiar**, excepciones pertinentes, fechas y fuentes.
- Completar **seguro de cesantía** según naturaleza del contrato, vigencias y excepciones.
- Incorporar **UF/UTM**, sueldo mínimo y parámetros necesarios, con origen oficial y período; no confundir índice vigente con valor histórico.
- Preparar **tablas del Impuesto Único de Segunda Categoría** y reglas de cálculo como **datos de referencia**, sin descontar ni generar liquidaciones.
- Catálogos de beneficios, descuentos y documentos autorizados; reglas de aplicabilidad y trazabilidad.

**No programar cálculos de impuesto, liquidaciones, cotizaciones, Previred ni pagos todavía.** Registrar valores con fuentes y validación normativa pendiente de publicación cuando proceda. El cálculo futuro puede necesitar movimientos variables del período (horas extra, ausencias, anticipos, bonos ocasionales), que **no** se deben disfrazar de atributos permanentes de la ficha.

## 6. Orden técnico de ejecución propuesto

### Bloque A: auditoría de acceso y datos actuales (primero)
- Inventariar todas las rutas y vistas protegidas por `requireRoles`, administración, empresas, fichas, contratos, documentos, licencias, auditorías y Contabilidad Laboral.
- Mapear `admins`, empresas, locales y relaciones reales de usuario/empresa. Documentar claramente qué consultas carecen de filtro por ámbito.
- Verificar estado de respaldos y esquema SQLite **en entorno controlado**, sin publicar nombres/RUT/credenciales.
- Definir matriz de permisos y reglas de restricción por empresa/local con pruebas negativas obligatorias.

### Bloque B: modelo y migración de seguridad
- Introducir roles `root`, `contabilidad`, `admin_local` y preservar las operaciones legítimas de `supervisor`/`operator`.
- Crear permisos por acción y ámbitos de empresa/local (roles + concesiones, con denegación por defecto); **comprobar en backend y no solo ocultar botones**.
- Evaluar los permisos actuales por usuario **contra la base de datos en cada operación sensible**, no fiarse únicamente del `role` incluido en un JWT antiguo; invalidar o refrescar sesiones tras un cambio de privilegios.
- Convertir el usuario `admin` existente mediante una **transición controlada y reversible**, no renombrarlo automáticamente. Crear/certificar el primer `root` mediante mecanismo único seguro, aprobado por propietario, con contraseña no embebida, MFA recomendado y posibilidad de recuperación validada. **No bloquear al propietario ni generar un segundo root oculto**.
- Restringir enseguida escritura de catálogos/parámetros a `root` y `contabilidad` autorizada. Probar respuestas HTTP 403 de `admin_local`, `supervisor` y `operator`.
- Impedir autoelevación, cambios de rol de `root` por otros usuarios y permisos cruzados entre locales; auditar altas, bajas, delegaciones y revocaciones.

### Bloque C: definición de campos y edición segura
- Diseñar esquema y migraciones **aditivas** para definiciones/opciones/versiones/valores individuales; no convertir automáticamente fichas/contratos existentes.
- Habilitar nuevo panel de configuración de campos en Contabilidad Laboral, visible solo a autorizados.
- Añadir API de consulta del esquema efectivo para ficha/contrato y API de mantenimiento protegida por permiso granular.
- Exigir motivo, vista previa de impacto y bloqueo de cambios incompatibles con información existente.

### Bloque D: parámetros faltantes y conectores UI
- Agregar asignaciones familiares, seguro de cesantía y referencias tributarias mediante versiones por período y fuentes oficiales verificadas.
- Configurar campos del punto 14 (cargas, reconocimientos, permisos parentales y documentos) con manejo especial de privacidad.
- Mostrar los campos en ficha y contratos; permitir ingreso de **datos individuales** por admin local de su ámbito, nunca edición del esquema global.
- Garantizar que no cambien los historiales ni las aplicaciones originales Huella y Propinas.

### Bloque E: aceptación y publicación
- Pruebas de servidor por rol y ámbito: accesos permitidos/denegados, multiempresa, contratos, PDF, datos médicos, catálogos, parámetros y configuración.
- Migraciones repetibles sin duplicados; pruebas de reversión/restore en copia; ninguna operación destructiva sobre datos reales.
- CI + build + prueba web Windows y móvil HTTPS; probar UI con roles distintos, solo lectura y cambio de permiso en sesión activa.
- Revisión manual y aprobación del propietario; integrar cambios por PR controlado, verificar SHA; **actualizar la PC solo con `Actualizar.bat`**, respaldo e integridad.

**Prioridad al comenzar la sesión:** A → B. No exponer el configurador al rol admin actual mientras no exista una protección de permisos segura y comprobada. Si queda tiempo, continuar C y D, pero no presentar fases no probadas como terminadas.

## 7. Criterios de aceptación imprescindibles

- [ ] `admin_local` no puede crear/modificar campos, instituciones, tasas, tramos o permisos **ni por URL ni por solicitud API directa**.
- [ ] `root` administra políticas, permisos por rol y excepciones individuales; `contabilidad` solo configura ámbitos/recursos explícitamente delegados. Dos usuarios del mismo rol pueden tener permisos efectivos distintos sin cambiar la plantilla de todos.
- [ ] Denegaciones individuales prevalecen sobre concesiones ordinarias; reglas no delegables y ámbito por local siguen vigentes; lectura y escritura por subcampo se verifican en API, no solo en UI.
- [ ] Root puede conceder/revocar un permiso puntual con motivo y vencimiento; se aplica inmediatamente sin exigir cierre de sesión ni elevar a todos los usuarios del rol.
- [ ] Trabajadores y datos de un local no aparecen ni se alteran desde otro local sin autorización.
- [ ] Al degradar/revocar un usuario, la autorización cambia en solicitudes posteriores sin necesitar que expire un JWT antiguo.
- [ ] Ficha y contratos solo muestran configuraciones publicadas y capturan valores propios según permisos; cambios globales no reescriben datos previos.
- [ ] Parámetros legales tienen fecha efectiva, fuente, motivo e historial, sin efecto retroactivo silencioso.
- [ ] Se conservan todos los usuarios, contraseñas, fichas, contratos, anexos y respaldos existentes.
- [ ] No hay registro público de datos personales, clínicos, bancarios ni secretos.
- [ ] Pruebas automatizadas de seguridad/migración y validación física reportadas; decisión explícita antes de producción.

## 8. Fuera del alcance de esta tanda

- Liquidaciones y pagos, descuentos automáticos, declaraciones tributarias, integración Previred.
- Conciliación con Propinas, migración maestra a PostgreSQL y mezcla de SQLite de otros proyectos.
- Rediseño masivo de pantallas ya aprobadas o eliminación de roles/datos históricos.
- Funcionalidades clínicas nuevas o captura masiva de datos familiares sin necesidad y justificación.

**Pendiente de revisión inicial:** confirmar con el propietario el alcance del rol Contabilidad (global o por empresas) y los permisos de edición estructural delegados. Como valor seguro por defecto, **permiso granular, alcance asignado y denegación si no hay autorización expresa**.

## 9. Permisos individuales dentro del mismo rol (ampliación acordada el 09-11-2026)

### Principio funcional

El propietario propone reutilizar una idea del sistema de ventas: **Root puede gestionar permisos individuales para un usuario específico**, desglosados por **módulo, submódulo, acción y campo**, además de los permisos base del rol. Esto no cambia el rol ni todos los usuarios que lo comparten.

Por ejemplo, `Contabilidad` podría tener la plantilla estándar de lectura de parámetros contables. Root habilita a **una sola contadora** la visualización de `Personal → Contratos` para uno o varios locales definidos, sin dar permiso de editar contratos ni extenderlo al resto de contadores.

**Decisión de arquitectura:** mantener roles como plantillas y combinar una capa de **autorizaciones/denegaciones individuales**, con alcance explícito y vencimiento opcional. La atribución final se calcula **en el servidor**, nunca solo desde el menú. Una concesión no debe modificar los datos, cambiar un contrato ni crear un documento por sí misma.

### Modelo mínimo

- **Identidad:** usuario estable `user_id`, rol predeterminado y estado activo.
- **Registro de recursos/acciones:** nombres técnicos inmutables y jerárquicos, p. ej. `personal.workers.read`, `personal.contracts.read`, `personal.contracts.write`, `personal.contracts.export`, `labor.parameters.read`, `labor.parameters.manage`, `labor.fields.manage`, `labor.worker-values.write`, `documents.medical.read`. Para cada acción, especificar ámbito y clasificación de sensibilidad.
- **Plantilla por rol:** conjunto de permisos base, revisable y versionado. Cambiarla afecta a ese rol **solo después de una confirmación explícita** y no modifica las concesiones individuales existentes.
- **Excepción individual:** `user_id`, `permission_key`, `effect=ALLOW|DENY`, `scope_type=GLOBAL|COMPANY|BRANCH`, `scope_id` cuando corresponda, `valid_from`, `valid_until` opcional, `reason`, `granted_by`, `revoked_by`, fechas y revisión para concurrencia. Historial **append-only**, sin eliminación de autorizaciones previas.
- **Permiso sobre campos:** acciones distintas para `field.read`, `field.write`, `field.export` y `field.definition.manage`. Si el campo requiere una restricción especial, esa condición también debe validarse en el backend por campo y por operación. Un usuario con `personal.contracts.read` no recibe automáticamente `personal.contracts.write` ni descarga de PDFs.
- **Ámbito efectivo:** la excepción individual solo actúa dentro de los locales/empresas autorizados, salvo un permiso global explícito concedido por Root a funciones que admitan alcance global. Las restricciones de privacidad y segregación que son invariables **no se pueden anular** con una excepción individual corriente.
- **Control anti-escalada:** solamente Root (o mecanismo extraordinario con autorización separada que se diseñe después) administra concesiones; el beneficiario no puede editar sus propias concesiones ni delegar permisos a terceros. El rol `contabilidad` no se convierte en administrador de usuarios por recibir acceso a un submódulo.
- **Revisión y caducidad:** Root puede ver acceso efectivo, permisos heredados, permisos individuales, origen y fecha de vencimiento. Revocar se aplica en la próxima petición sensible, incluso si la sesión ya estaba abierta. Emplear relectura de permisos/versiones en DB, en vez de confiar en un JWT con un rol o claims anteriores.

### Precedencia y denegación por defecto

1. Rechazar usuario inactivo, sesión inválida o sin pertenencia/alcance válido.
2. Aplicar **reglas no delegables**: segregación de datos, límites de acceso clínico y prohibición definida para `admin_local` de modificar configuraciones normativas globales, salvo que el propietario **cambie expresamente la política estructural en otra decisión**.
3. Si existe un `DENY` individual vigente y aplicable, **denegar**.
4. Si existe un `ALLOW` individual vigente, autorizado y compatible con reglas anteriores, **permitir**.
5. En otro caso, usar permiso del rol base, dentro del ámbito autorizado; de lo contrario, **denegar**.

Para campos personales, agregar validación de lectura **y de escritura**: una API no debe aceptar valores de campos ocultos/no autorizados aunque un cliente malicioso los envíe. No usar un comodín implícito de "ver módulo" como acceso a todos los datos médicos, financieros o bancarios que ese módulo pueda exponer.

### Interfaz de Root

**Administración → Usuarios y permisos → Seleccionar usuario → Permisos particulares**:

- Árbol: `Módulo → Submódulo → Sección/campo` con controles `Ver`, `Crear`, `Editar`, `Aprobar`, `Exportar`, `Configurar` según naturaleza del recurso. **No mostrar acciones que no tengan significado en ese recurso.**
- Filtros por empresa/local, búsqueda, vista de permisos heredados del rol y permisos individuales; estado final visible: permitido, denegado, heredado o fuera de ámbito.
- Concesión puntual con motivo obligatorio, vencimiento y vista previa del cambio. Para permiso sensible, solicitar confirmación reforzada; no habilitar todos los campos de una sección automáticamente.
- Revocación con confirmación, auditoría de quién/cuándo/qué/para quién/por qué; revisiones periódicas de accesos temporales.

### Ejemplo de aceptación

Dos usuarios con `role='contabilidad'` poseen exactamente la misma plantilla inicial. Root concede solo al primero `personal.contracts.read` para **un local autorizado** y no `personal.contracts.write` ni acceso a documentos clínicos. Resultado comprobable:

- Contadora A puede **ver** contratos de ese local, sin editar ni exportar datos no autorizados.
- Contadora B conserva permisos base, no ve ese submódulo.
- Un intento de editar, entrar por URL oculta o llamar directamente a una ruta API con permiso faltante recibe `403`.
- Tras revocar el permiso, Contadora A deja de ver el recurso y la API lo rechaza **sin esperar el vencimiento de la sesión**.
- Otras contadoras y otros locales **no cambian**. El historial registra concesión y revocación.

### Dependencia y orden

Este diseño **amplía el Bloque B (seguridad) y precede a la interfaz de configuración de campos (Bloque C)**. Primero implementar inventario de recursos y pruebas de roles/ámbitos; luego concesiones/denegaciones individuales y su UI; finalmente conectar tanto Contabilidad Laboral como ficha/contratos a la autorización efectiva. **No hacer concesiones mediante un campo JSON sin validación por API** ni modificar códigos del rol en muchos lugares sin centralizar permisos.

**Estado:** especificación aprobada conceptualmente por el propietario para diseñar; no implementada, sin migraciones, cuentas, asignaciones ni cambios a datos operativos.

## 10. Instrucción para retomar el 10-11-2026

> Trabajar exclusivamente en `ManuelAcostaGuerrero/sagva-gestion-laboral`. Leer `AGENTS.md`, `docs/24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md` y este documento 25. Iniciar auditando roles, accesos y ámbito por local (bloque A), seguido del modelo de seguridad (bloque B): **roles como plantillas, excepciones ALLOW/DENY por usuario, módulo/submódulo/campo, acción y ámbito por local**, con registro de auditoría y revocación efectiva inmediata. Prioridad absoluta: un administrador de local **no puede modificar definiciones globales ni parámetros**; un usuario `root` o uno de `contabilidad` explícitamente autorizado sí. Preservar usuarios, contraseñas, registros, esquemas históricos y las apps originales. Separar configuración central de datos personales/contractuales visibles en ficha. No iniciar liquidaciones ni pagos. Validar con pruebas y PR antes de actualización local manual.
