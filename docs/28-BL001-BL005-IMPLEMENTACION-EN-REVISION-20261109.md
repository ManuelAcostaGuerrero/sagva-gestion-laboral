
# 28. BL-001 a BL-005: entrega integrada en revisión

**Rama:** `feature/bl001-bl005-ficha-beneficios-20261109`  
**PR:** [#9](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/9)  
**Estado de GitHub al 09-11-2026:** código integrado en rama del PR #9 con CI verificado (servidor, build y QR móvil) en SHA `d323d6db95e5ff2a3ea4469ecec20e9fa945e1e8`. **No probado todavía en el PC del propietario ni aprobado para producción.**

## Secuencia de trabajo realizada

1. **BL-003: Bancos**: migración aditiva de catálogo CMF 2026 (18 instituciones entre bancos locales y sucursales extranjeras), códigos estables, estado/renombre, historial, razón y autor. Referencia: https://www.cmfchile.cl/portal/principal/623/w4-propertyvalue-29280.html. No confundir marcas comerciales con bancos autónomos.
2. **BL-004: Cargas familiares**: registros individuales y status familiar por trabajador, historiales, validación de acreditación, sin eliminación física. Ver/editar solo roles administrativos actuales, operador denegado. La ficha muestra detalles solo cuando se declaran cargas. Los reconocimientos deben estar respaldados por institución y fecha.
3. **BL-005: Parámetros**: tablas familiares versionadas en Contabilidad Laboral, vigencias 1 mayo y 1 julio 2026, tramos 649039 / 947990 / 1478539; valores 22601 / 13870 / 4382 / 0 CLP. **El semestre usado para calcular el ingreso promedio cambia desde julio.** Referencia SUSESO: https://www.suseso.gob.cl/606/w3-article-498133.html y dictamen https://www.suseso.gob.cl/612/w3-article-686804.html. No se calcula asignación ni remuneración automática.
4. **BL-001: Ficha única subdividida**: subpestañas personales, previsión, vínculo con empresa/contratos, cargas, banco. No crear otra ficha ni duplicar tablas maestras. Guardado compartido extiende control de cambios pendientes.
5. **BL-002: Cuenta bancaria**: tabla separada con JSON cifrado AES-256-GCM, revisionado, titularidad del trabajador, fecha de solicitud de transferencia y referencia privada de autorización. Registro de auditoría solo de tipo/campos cambiados; no exponer número de cuenta en bitácora ni en listado general.

## Seguridad temporal, mientras BL-007 Root sigue pendiente

Los **bancos y tramos** solo pueden modificarlos `admin` **cuyo ID esté explícitamente incluido** en `SAGVA_CONFIGURATION_USER_IDS`. Por defecto nadie tiene esa autorización. Lectura de catálogos activos no entrega cuentas personales.

La **cuenta bancaria** solo puede leerse/guardarse si se cumplen simultáneamente: rol `admin`, su ID figura en `SAGVA_BANK_ACCESS_USER_IDS`, y se ha configurado `SAGVA_BANK_DATA_KEY` de exactamente 64 caracteres hexadecimales para AES-256-GCM. No almacenar esa clave en GitHub, repo, logs ni respaldos de datos sin protección. **Pérdida de la clave impide recuperar cuentas cifradas**: planificar custodia/recuperación fuera del repositorio. El catálogo se puede visualizar sin estos permisos.

Estos env vars son una **barrera transitoria deliberada**, no el panel visual Root ni el RBAC fino definitivo. **No abrir la escritura bancaria por el simple hecho de tener `admin`**, dado que aún no existe separación entre admin global y local. La gestión visual de concesiones individuales, sucursales y revocación al vuelo queda pendiente BL-007; por eso no autorizar uso productivo de cuentas reales todavía.

### Nota de privacidad

- La solicitud de transferencia a cuenta del trabajador debe documentarse (art. 54 Código del Trabajo). La captura de cuenta es opcional y el usuario puede operar sin ella.
- En el formulario la entrada está enmascarada por defecto; solo se desenmascara mientras se mantiene pulsado el control.
- Los datos bancarios NO se guardan en `employee_files.extra_json` ni se incluyen en `fileSelect` o la auditoría genérica de la ficha. Las versiones anteriores quedan cifradas en `employee_bank_account_history` sin mostrar valores en bitácora.
- El acceso de familia es por endpoint separado y denegado a operadores; los detalles familiares no se incluyen en listas generales ni trazas de auditoría, pero se conservan snapshots privados por revisión. No hay pagos.

## Pruebas y límites

La prueba en `server/src/__tests__/labor-benefits.test.js` usa SQLite en memoria y personas sintéticas, verifica precarga, idempotencia, restricciones, vigencias, reconocimiento, concurrencia, cifrado y redacción de logs.

**Evidencia CI del SHA `d323d6db95e5ff2a3ea4469ecec20e9fa945e1e8`:** [Verificar proyecto 42689884990](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/actions/runs/42689884990) = `success`; [Validar mejoras QR móvil 42689885021](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/actions/runs/42689885021) = `success`. El commit posterior solo cambia documentación; comprobar nuevamente estado y SHA antes de fusionar.

**Aún pendientes de validación física antes de uso productivo:** actualización manual Windows con respaldo recuperable, previsualización responsiva móvil HTTPS, uso y caducidad de permisos, pruebas de acceso bancario configurado con usuarios autorizados, restauración de copia y revisión de la política de datos personales. No hay ensayo con datos reales desde GitHub.

**Límites conocidos de este lote:** la cuenta bancaria almacena una referencia de autorización, no genera todavía un PDF firmado; las cargas guardan referencia de reconocimiento, sin añadir en esta entrega un cargador PDF por causante. El panel Root y la delegación granular siguen siendo BL-007; el mecanismo transitorio exige IDs explícitos y clave externa. No configurar claves bancarias sobre repositorios públicos.

**Fuera de esta entrega:** BL-006 motor autoadaptable general, BL-007 Root y permisos individuales, BL-008 auditoría transversal, BL-009 enlaces de alta; no cambiar Huella original ni Propinas.
