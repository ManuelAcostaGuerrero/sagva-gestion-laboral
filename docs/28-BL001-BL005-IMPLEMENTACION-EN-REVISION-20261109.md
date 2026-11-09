
# 28. BL-001 a BL-005: entrega integrada en revisión

**Rama:** `feature/bl001-bl005-ficha-beneficios-20261109`  
**PR:** [#9](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/9)  
**Estado inicial:** implementado en rama; **no declarar aceptado ni instalado** hasta CI y pruebas de Windows/móvil, revisión de seguridad y aprobación.

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
- Los datos bancarios NO se guardan en `employee_files.extra_json` ni se incluyen en `fileSelect` o la auditoría genérica de la ficha.
- El acceso de familia es por endpoint separado y denegado a operadores; los detalles familiares no se incluyen en listas generales ni trazas de auditoría. No hay pagos.

## Pruebas y límites

La prueba en `server/src/__tests__/labor-benefits.test.js` usa SQLite en memoria y personas sintéticas, verifica precarga, idempotencia, restricciones, vigencias, reconocimiento, concurrencia, cifrado y redacción de logs.

**Antes del merge:** esperar resultado real de GitHub CI, compilar React, corregir fallos; luego revisar la UI, seguridad transitoria, migraciones y visualización en teléfono. Ninguna ejecución sobre base real ni Windows se da por realizada desde GitHub.

**Fuera de esta entrega:** BL-006 motor autoadaptable general, BL-007 Root y permisos individuales, BL-008 auditoría transversal, BL-009 enlaces de alta; no cambiar Huella original ni Propinas.
