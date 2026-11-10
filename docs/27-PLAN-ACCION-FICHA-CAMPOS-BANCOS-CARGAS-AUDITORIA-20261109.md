# 27. Plan de acción: ficha única, bancos, cargas, campos configurables, Root y auditoría

**Fecha de planificación:** 09-11-2026.  
**Producto:** `ManuelAcostaGuerrero/sagva-gestion-laboral`.  
**Estado:** plan de ejecución por entregas. **No significa que el código ya cambió.**  
**Base funcional actual:** Entregas 1 y 2, Contabilidad Laboral (AFP/Fonasa/Isapres) y validación funcional reciente aprobadas. [Estado](24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md).  
**Decisiones e inventario:** [Bitácora 26](26-BITACORA-FICHA-BANCOS-CARGAS-AUDITORIA-20261109.md), [plan de roles original 25](25-PLAN-CONTABILIDAD-LABORAL-CAMPOS-Y-PERMISOS-20261110.md).

## 1. Objetivo y principio arquitectónico

Preparar **una única ficha integral** con datos y respaldos útiles para la futura remuneración, sin construir aún pagos. El contenido debe estar subdividido visualmente y las configuraciones centralizadas:

- `Gestión → Contabilidad Laboral`: catálogos, bancos, AFP/Isapres, parámetros, tramos, montos y **metadatos autorizados de campos**. Solo Root y Contabilidad con permiso específico pueden mantenerlos. Bancos son **instituciones para el medio de pago**, no tasas previsionales; mantener sección propia.
- `Administración → Seguridad Root`: roles base, ámbitos por empresa/local y permisos individuales por usuario, módulo/submódulo/acción/campo; acceso a bitácora con controles.
- `Personal → Ficha del trabajador`: presenta los campos publicados y guarda **datos particulares**, solicitudes, documentos, históricos y relaciones del trabajador. No modifica tasas, nombres de bancos ni estructuras.
- `Contratos/anexos`: condiciones firmadas/efectivas, sin repetir campos personales ni alterar acuerdos cuando cambian catálogos.
- `Autoregistro del trabajador`: portal de captura inicial con enlace seguro y revisión antes de consolidar información.

**Autoadaptable = edición declarativa** (etiquetas, opciones, obligatoriedad condicionada, orden de visualización y valores en catálogos); no edición libre de código ni cambios arbitrarios de tablas SQL. Los identificadores técnicos son estables, se mantiene el historial y los cambios incompatibles requieren revisión de desarrollo.

## 2. Subdivisión exacta de la ficha única

La ficha debe seguir siendo **una ficha por trabajador**, con un encabezado común y subpestañas o acordeones claramente diferenciados:

| Sección propuesta | Contenido / origen | Permisos |
|---|---|---|
| A. Identificación y contacto | Nombres, apellidos, RUT, nacimiento, nacionalidad, correo, teléfonos; identificación única | Personal autorizado y futura autocaptura; no datos de otros trabajadores |
| B. Domicilio particular | Dirección del trabajador, región/provincia/comuna/localidad; independiente de domicilio de empresa | Personal autorizado |
| C. Vinculación empresarial | Empresa vinculada, local/sucursal, área, cargo, unidad jerárquica, centro de costo y estado | Administración local dentro de su empresa/local |
| D. Condiciones laborales y contratos | Tipo de contrato, fecha, jornada, sueldo base, anexos, beneficios contractuales, condiciones pactadas | Usuarios con permiso de contrato; cambios con aprobación e historial |
| E. Datos previsionales y beneficios | AFP, Fonasa/Isapre, plan de salud, APV autorizado, cargas familiares y reconocimiento | Ficha refleja catálogos y parámetros **sin editarlos** |
| F. Medio de pago y cuenta bancaria | Transferencia/otros medios permitidos; banco, tipo/número de cuenta, titular, solicitud/autorización, historial | Acceso **explícito por usuario y campo**, especialmente Contabilidad; enmascarado |
| G. Documentos y autorizaciones | Contratos, anexos, reconocimientos de cargas, solicitudes de pago y otros respaldos, con vigencia | Acceso por tipo de documento y sensibilidad; firma futura separada |
| H. Licencias y antecedentes médicos restringidos | **Conservar módulo y permisos especializados existentes**, sin mezclar datos clínicos en ficha general | Solo roles autorizados para ese dominio |

**Regla de integración:** datos de la empresa permanecen en su catálogo; la ficha almacena la **relación** con empresa/local y atributos laborales propios, no copias de razón social, dirección o parámetros legales que deban sincronizarse manualmente. Preservar el texto histórico cuando su vínculo actual aún no esté normalizado.

### Campos condicionales obligatorios del punto 14

- Pregunta: **¿Tiene cargas familiares?** Opciones: `No`, `Sí, sin reconocimiento acreditado`, `Sí, reconocidas`.
- `No`: ocultar formulario de cargas, sin borrar automáticamente registros históricos de otras fechas.
- `Sí`: desplegar un bloque por causante con relación/tipo, nombre o identificador **solo cuando sea necesario legalmente**, fecha de reconocimiento/solicitud, período de vigencia, institución, estado, documento y observaciones mínimas.
- Carga **no reconocida** puede guardarse como trámite pendiente, pero no puede producir asignación pagadera.
- Los montos y tramos de asignación familiar se consultan en Contabilidad Laboral por **vigencia y condiciones acreditadas**; no se escriben manualmente en la ficha.

## 3. Cuenta bancaria del trabajador y bancos de Chile

### Campos individuales

- `payment_method`: transferencia, efectivo, cheque u otro permitido, según política/documento.
- `bank_id`: referencia a catálogo único y versionado.
- `account_type`: corriente, vista/CuentaRUT, ahorro u otra modalidad admitida, con reglas según institución/operación.
- `account_number`: **texto, no número matemático**; preservar ceros iniciales y formatos válidos, sin truncamiento.
- `account_holder_name` y `account_holder_rut` o confirmación de titularidad del propio trabajador; no permitir pagos automáticos a terceros sin validación jurídica/operativa.
- Fecha de solicitud de transferencia, fuente/autorización, vigencia, estado de verificación y fecha de último cambio.
- Historial de medio de pago y cuenta con versión, autor, fecha, motivo y procedimiento de cambio seguro.

**Privacidad y seguridad:** información financiera personal de acceso restringido, aun sin suponer que pertenece formalmente a todas las categorías de datos sensibles de la ley. Cifrado en reposo, TLS/HTTPS, enmascaramiento predeterminado, lectura bajo permiso expreso, auditoría sin revelar cuenta completa, exportación deshabilitada por defecto, controles de titularidad y proceso de corrección/revocación.

**Seguridad de pagos futuros:** un cambio de banco/cuenta podría desviar remuneraciones; requerir confirmación del trabajador y, cuando corresponda, doble validación de Contabilidad antes de que la cuenta sea elegible para pago. No implementar transferencia de dinero en este ciclo.

### Catálogo central administrable

- Sección `Gestión → Contabilidad Laboral → Bancos y medios de pago`.
- Precarga inicial contrastada con **CMF** (https://www.cmfchile.cl/portal/principal/623/w4-propertyvalue-29280.html), con código, nombre oficial, denominación visible, estado, fuente y vigencias. Revisar fusiones y marcas y verificar antes de aprobar bancos nuevos.
- Acciones permitidas: **agregar**, **renombrar**, activar/desactivar, gestionar alias y ver historial. **Nunca borrar físicamente** un banco que se utilizó en una cuenta.
- Un cambio de nombre de banco afecta su **etiqueta visible**, no su ID ni el banco histórico de una cuenta. Toda modificación requiere motivo, usuario, fecha e historial.
- Permiso para crear/modificar catálogo: solo Root y Contabilidad con `catalog.banks.manage` expresamente concedido; administradores locales solo consultan bancos activos al registrar una cuenta.

**Marco laboral:** art. 54 del Código del Trabajo contempla depósito por transferencia **a solicitud del trabajador** y sin costo para él (https://www.bcn.cl/leychile/navegar?idNorma=207436). No asumir que toda persona debe tener cuenta bancaria para ser contratada.

## 4. Formularios configurables sin tocar código

- Esquema estable para **definiciones de campo**, **opciones**, **versiones**, **valores personales**, **condiciones**, **ámbitos y permisos**, sin mutar estructura SQL ante ediciones ordinarias de Root.
- Permitir editar nombres/etiquetas, descripciones, opciones de selectores, obligatoriedad permitida, visibilidad, orden, catálogos y valores vigentes; mostrar simulación de impacto antes de publicar.
- Las **reglas legalmente fundamentales**, fórmulas de remuneraciones y tipos de datos incompatibles no son editables mediante texto libre que pueda reprogramar el servidor. Cambios estructurales excepcionales exigen desarrollo y migración.
- Solo se guardan valores **individuales** en ficha y condiciones contractuales específicas en Contratos; se enlazan por ID/versiones a los metadatos.
- Validación en API, no solo frontend. Cambios de etiquetas no alteran claves técnicas ni históricos.

## 5. Captura de datos por el propio trabajador

**Objetivo:** reemplazar el doble ingreso desde ficha física con un flujo opcional controlado, conservando el formulario de administración.

1. Usuario autorizado genera **invitación** a un trabajador nuevo o preexistente con propósito y alcance específicos.
2. Entregar enlace HTTPS de uso limitado, token aleatorio **de un solo uso**, caducidad y revocación. No exponer datos bancarios o RUT en URL, logs ni correo sin protección.
3. Trabajador ingresa datos de identidad, contacto, domicilio, selección AFP/salud, cargas declaradas y medio de pago **si corresponde**, con información clara sobre finalidad de uso.
4. El servidor valida formato, coherencia, unicidad de RUT y titularidad, y guarda un **borrador de revisión** (no ficha consolidada, no nueva identidad duplicada).
5. Administración autorizada revisa discrepancias, acepta/rechaza cada sección, solicita documentos cuando corresponda y registra su aprobación.
6. Aplicar cambios de forma transaccional con historial, sin sobreescribir contratos, salarios, cargas ya acreditadas ni cuentas previas automáticamente.
7. Registrar invitación, envío, apertura/autenticación, presentación, revisión, aprobación y revocación en la bitácora; no incluir valores confidenciales en entradas públicas.

**No usar un enlace público estable sin autenticación o caducidad.** Antes de exponerlo a Internet se necesita revisión específica de seguridad, privacidad, retención y control antiabuso.

## 6. Seguridad Root, auditoría y separación de responsabilidades

### Roles y permisos

- Roles como plantillas: `root`, `contabilidad`, `admin_local`, `supervisor`, `operator`, y otros perfiles cuando realmente existan funciones nuevas.
- Permisos individuales: `ALLOW/DENY` por **usuario + módulo + submódulo + acción + campo + empresa/local + vigencia**, controlados por Root. Un permiso personalizado **no modifica a todos los del mismo rol**.
- Acciones granulares: ver, editar, crear, aprobar, exportar y administrar la definición; lectura de cuenta bancaria y edición de cuenta son **permisos diferentes**.
- Contabilidad podrá gestionar catálogos/tasas y leer/editar la cuenta bancaria **solo si Root se lo asignó**. Administrador de local NO podrá editar definiciones globales ni tasas, y no verá datos bancarios completos por defecto.
- Garantizar aislamiento entre empresas/locales, permisos sobre servidor, denegación de acceso por API directa y **revocación inmediata aun con sesión abierta**.
- Root no se exime de trazabilidad: registrar sus cambios, evitar autoelevación de otros usuarios, asegurar transición inicial de `admin` a Root **sin bloqueo** y con copia verificable.

### Bitácora automática existente y ampliación

Ya existe `recordAudit()` y tabla `audit_logs`; también historiales previsionales y trazabilidad de ciertas operaciones. **Extender, no duplicar**:
- Catálogo unificado de eventos: `field.definition.change`, `bank_catalog.create|rename|deactivate`, `employee.bank.read|change|verify`, `family_recognition.create|update`, `access.grant|deny|revoke`, `worker.selfservice.submit|approve|reject`, `parameter.version.create`, `contract.approve`.
- Registrar ID estable, actor y rol efectivo, fecha UTC, objeto, entidad/local, campos cambiados (con valores redactados en categorías protegidas), motivo y resultado.
- Inmutabilidad operacional: usuario Root no puede editar/borrar audit trail desde panel. Verificar política de retención, respaldo, integridad verificable y consulta/exportación supervisada.
- Evitar logging de contraseñas, tokens, números completos de cuenta, documentos privados, diagnósticos o datos familiares identificables.
- Pruebas negativas: acceso no autorizado/denegado, cambios Root auditados, falla de escritura de auditoría en mutaciones críticas, cambios simultáneos y reversión.

## 7. Orden de trabajo por entregas

| Orden | Paquete | Resultado y dependencia | Puerta para continuar |
|---|---|---|---|
| **P0** | Inventario + copia y pruebas base | Auditar ficha, contratos, DB, roles, rutas, auditores y estado del actualizador; definir matriz de datos y permisos. Conservar original Huella separado. | Check de inventario, riesgos y respaldo privado |
| **P1** | Root + roles + permisos individuales | Transición segura de roles, ámbito por empresa/local y autorización por campo en API. Resolver acceso Root de forma segura antes de retirar privilegios antiguos. | Tests de denegación/permitidos por rol y usuario, no bloqueo del administrador actual |
| **P2** | Auditoría transversal | Ampliar `audit_logs` y vistas de bitácora. Toda operación crítica incluido Root genera evento, con datos protegidos. | Tests auditables, integridad y visualización solo autorizada |
| **P3** | Reorganizar ficha única | Subpestañas claras, sin cambiar contratos ni persistencia de datos actuales. Eliminar solo duplicaciones visuales auditadas; conservar historial. | Regresión de guardado, navegación y borradores |
| **P4** | Configurador declarativo de campos + catálogos | Panel Contabilidad Laboral con metadatos y versiones; conectar ficha sin modificación manual de código ante cambios de catálogo. | Tests de configuración, compatibilidad y permisos |
| **P5** | Bancos + cuentas individuales | Precarga CMF validada, CRUD seguro sin borrados, número como texto, titularidad, autorización y cifrado. | Tests de acceso, cambio de cuenta, auditoría y no exposición |
| **P6** | Cargas familiares + tramos | Formulario condicional, múltiples cargas, reconocimiento/documentos, valores históricos de asignación familiar en Contabilidad Laboral. | Tests de casos No/Sí pendiente/Sí acreditada e histórico |
| **P7** | Portal/autoregistro con revisión | Enlace temporal, borradores por trabajador, validaciones, aprobación por secciones, historial y revocación. | Pruebas token, identidad, duplicados, HTTPS móvil y permisos |
| **P8** | Integración, estabilidad y aprobación | CI, Windows, móvil real, recuperación/restore en copia, prueba transversal de todos los roles, privacidad; documentación y PRs revisados. | Aprobación funcional expresa por propietario; despliegue posterior manual |

**Secuencia de ejecución:** priorizar P0 → P1 → P2 antes de exponer cuentas bancarias o invitaciones públicas. P3 (maquetación) puede prepararse en una rama aislada en paralelo, pero no se debe fusionar si rompe guardados. P4 precede a P5/P6. P7 solo después de P1/P2/P5/P6, por privacidad y autenticación.

**Un PR por paquete lógico**, o PRs pequeños por capa dentro de un mismo paquete: backend/migración/permiso, frontend, pruebas. Respetar el flujo manual GitHub → CI → autorización → `Actualizar.bat`; respaldo antes de instalación, pruebas Windows/HTTPS móvil cuando se autorice.

## 8. Matriz de pruebas mínimas

| Prueba | Esperado |
|---|---|
| Admin local intenta cambiar banco/tasa/campo global | `403`, evento auditable de denegación |
| Contadora A tiene acceso específico al campo bancario, Contadora B no | Solo A ve el dato enmascarado o completo según permiso; B no puede API ni exportación |
| Root cambia nombre de banco | Alias visible actualizado; ID de banco y cuentas anteriores preservados; evento histórico |
| Root cambia valor legal con vigencia futura | La ficha consulta la versión según fecha; períodos antiguos no se recalculan |
| Sin cargas familiares | Bloque oculto, sin borrar cargas históricas |
| Carga pendiente | No se transforma en acreditada ni produce pago automáticamente |
| Trabajador modifica cuenta desde enlace | Dato pasa a revisión; no sustituye una cuenta ya vigente sin autorización |
| Cambia rol o permiso con sesión abierta | Siguiente solicitud respeta revocación |
| Falla el registro de auditoría en una mutación protegida | Operación no queda confirmada silenciosamente |
| Dos administradores editan mismo campo | Conflicto controlado; sin pérdida de datos |
| Copia de SQLite antigua | Migración aditiva, sin duplicados, backup verificable y regresiones aprobadas |

## 9. Fuera de esta entrega

- **No** desarrollar liquidaciones, transferencia de dinero, Previred ni obligaciones tributarias automáticas.
- **No** mezclar identidades ni bases de Propinas o del ERP de ventas, ni migrar ya a PostgreSQL.
- **No** almacenar datos médicos detallados ni historias clínicas en la ficha general.
- **No** publicar bases reales, claves, cuentas, PDFs, enlaces de autoregistro o bitácoras privadas en GitHub público.
- **No** declarar `INT-002` ni `v1.0.0` completos solo por aprobar estas mejoras.

## 10. Checklist de preparación para iniciar

- [ ] Confirmar inventario de rutas/roles y existencia de `audit_logs` en pruebas, sin filtrar datos reales.
- [ ] Elaborar diccionario de campos: ubicación actual, ubicación propuesta, origen, obligatoriedad y sensibilidad.
- [ ] Diseñar esquema de bancos/cuentas y método de cifrado con claves privadas fuera de código y backups utilizables.
- [ ] Concretar el flujo de solicitud de transferencia y verificación de titularidad.
- [ ] Validar fecha y fuente oficial de bancos CMF, asignaciones familiares y tablas legales antes de precarga.
- [ ] Definir permisos de Root/Contabilidad/administración local por acción, campo y empresa/local.
- [ ] Diseñar y probar captura automática de eventos críticos reutilizando el sistema existente.
- [ ] Generar PRs pequeños con tests, sin alterar la fuente de datos original ni automatizar actualizaciones.
- [ ] Documentar y aprobar cada paquete antes de instalar en Windows y probar móvil.

**Resultado que se busca:** datos completos, bien separados, configurables y seguros **antes** de crear el futuro módulo de remuneraciones. Contabilidad Laboral define parámetros, la ficha consume configuraciones, Root gestiona accesos y la bitácora acredita movimientos.

**No equivale a funcionalidades implementadas ni a certificación laboral oficial.**

## 11. Entregable de cierre solicitado: manual breve en PDF por interfaz y campo (10-11-2026)

**Estado: PENDIENTE. Crear el PDF solamente al terminar y validar las actualizaciones de esta tanda.** Es una tarea de documentación final, no una función nueva ni una indicación de generar el PDF antes de cerrar los cambios. El documento debe reflejar **la interfaz realmente implementada y probada**, no pantallas imaginadas ni planes sin ejecutar.

### Alcance del manual

- Entregar **un PDF corto, claro y visual**, en español, dirigido a las personas que usarán SAGVA; organizarlo por **módulo, pantalla y sección**. Cubrir las interfaces y campos modificados en esta tanda: empresa y sus correos, ficha del trabajador, documentos laborales, cuenta bancaria, Contabilidad Laboral/campos configurables y Root/permisos individuales, según lo que efectivamente quede disponible tras las pruebas.
- Para **cada campo visible** indicar: **nombre exacto en pantalla**, **para qué sirve**, **qué información se debe ingresar**, **formato/tipo de dato**, **si es obligatorio u opcional**, **un ejemplo ficticio** y, cuando corresponda, **quién puede verlo o editarlo**. Usar una tabla simple «Campo | Qué ingresar | Ejemplo | Observaciones/obligatoriedad»; agrupar campos relacionados, sin repetir instrucciones innecesarias.
- Explicar brevemente las **acciones**: guardar provisionalmente, validar, editar, cargar un respaldo, consultar estados, configurar permisos, sin confundir un archivo **no ingresado en el sistema** con un documento **sin respaldo físico/existente**.
- En la ficha de empresa documentar separadamente **correo institucional/de contacto** y **correo de soporte/notificaciones**. Si queda implementada la selección por empresa para enviar correos, indicar qué remitente corresponde a cada trabajador. **No afirmar que existe envío automático o recuperación de clave por correo hasta implementarlo y probarlo**.
- No inventar obligaciones legales, validaciones, valores previsionales ni efectos de firma o correo. Diferenciar claramente «dato informativo», «requisito interno» y «respaldo legal por validar con asesoría».
- Incluir imágenes o capturas **únicamente de un entorno de prueba sin datos reales**, si ayudan a identificar la pantalla. En los ejemplos usar nombres, RUT, correos, cuentas y empresas **ficticios**; nunca copiar secretos ni datos del personal.

### Puerta de aceptación del manual

- [ ] Confirmar qué cambios de esta tanda están integrados en `main` y cuáles están realmente disponibles al actualizar la instalación beta.
- [ ] Completar pruebas de interfaz, campos y permisos en Windows/móvil y comprobar textos, formatos, obligatoriedad y errores mostrados.
- [ ] Elaborar el PDF desde las pantallas y campos finales con al menos un ejemplo ficticio por campo.
- [ ] Revisar con el propietario que las indicaciones coincidan con la operación y corregir el documento antes de marcarlo como entregado.
- [ ] Guardar el PDF como **entregable descargable** y dejar constancia de versión/fecha/SHA de SAGVA al que corresponde, sin datos privados.

**Prioridad:** finalizar cambios actuales → comprobar funcionamiento → generar PDF breve por interfaz/campo → validación del propietario. No trasladar esta tarea indefinidamente a la fase de producción; corresponde al cierre de estas actualizaciones beta.

## 12. Integración beta de correos empresariales y estados documentales — 10-11-2026

**Código incorporado directamente en `main` por decisión del propietario**, sin alterar instalaciones Windows, repositorios originales ni archivos reales.

### Configuración de empresas
- Se conserva el campo **Correo institucional** y se añade **Correo de soporte y notificaciones**, ambos opcionales y validados en el servidor.
- Cada valor pertenece a la empresa identificada por `company_profiles.id` y queda visible en la ficha de administración de empresas; no se agrega correo genérico compartido.
- Las asociaciones de personas con empresas ya existen mediante `employee_files.company_id`. **La selección automática de remitente, SMTP, recuperación de clave y envío por correo NO se han implementado todavía.** Se incluirán tras elegir proveedor y revisar seguridad/legalidad.

### Estados de documentos: dos controles independientes
- **Estado digital:** `Sin entrega registrada`, `Falta cargar PDF` o `PDF ingresado al sistema`, obtenido del historial de entregas y adjuntos; no se deduce de una declaración manual.
- **Estado físico:** `Sin verificar`, `Sí, existe respaldo físico` o `No existe / no se dispone del respaldo`, declaración individual por trabajador/tipo documental, auditable, editable solo por administración/supervisión y con revisión para evitar escrituras concurrentes.
- Se muestran dos indicadores independientes en cada documento (por ejemplo, **respaldo físico disponible, PDF pendiente**). Cambiar estado físico **no** crea una entrega, no sube un PDF, no acredita firma ni modifica un anexo, un pago o un sueldo.
- Los registros previos continúan con estado físico **Sin verificar** hasta revisión humana, incluso si existen PDF; no se inventa el estado de los originales.
- Migraciones aditivas con historial y pruebas sintéticas: `20261110_027_company_contact_emails` y `20261110_028_document_physical_status`.

### Futuro, NO ejecutado
- Generar documentos desde plantillas, enviarlos al correo correcto de la empresa y completar el flujo de firmas electrónicas/físicas. La asesoría laboral debe validar los requisitos de entrega, notificación, firma y conservación.
- Sigue pendiente el **manual PDF corto por interfaz y campo**, con ejemplos ficticios, después de cerrar pruebas de estas actualizaciones.

Las pruebas automáticas de servidor y compilación de interfaz deben aprobarse en el SHA integrado de `main`. Se añade verificación por cada nuevo commit en `main`, **solo CI**, sin instalar ni actualizar el Windows local ni realizar acciones en producción.
