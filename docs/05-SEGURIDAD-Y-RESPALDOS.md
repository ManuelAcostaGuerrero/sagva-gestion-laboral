# 05. Seguridad, privacidad, respaldos y recuperación

## Regla absoluta: repo público ≠ base de datos pública
Solo subir **código, tests sintéticos y documentación no sensible**. Son privados y deben quedar fuera de GitHub, CI, issues, PR y capturas: bases `.db` y sus `-wal/-shm`, nóminas de trabajadores, RUT, empresas reales si identifican personas, salarios, fichas médicas, licencias, contratos, PDFs, backups, contraseñas, tokens y claves Cloudflare.

**No confiar únicamente en `.gitignore`:** no protege archivos ya versionados ni secretos escritos directamente en fuente. Inspeccionar `git status`, `git diff --cached` y listado de archivos antes de commit. Revisar historial previo si se copia código de otro repo. **No copiar el directorio `.git` del original.** Si hay filtración, detener publicación, revocar secretos y manejar incidente; borrar un commit visible no despublica necesariamente los datos.

## Backups reales
- **Asistencia**: usar `Respaldar.bat` y la guía `OPERACION_LOCAL.md` originales, verificar consistencia SQLite, `integrity_check` y `foreign_key_check`. Si la BD está activa en modo WAL, copiar solo `asistencia.db` a mano **no garantiza un respaldo consistente**.
- **Propinas**: copia SQLite consistente con servidor detenido o API de respaldo; respaldos XML adicionales **no están cifrados** aunque usen Base64; cuidado con copias internas.
- Preservar documentos PDF/adjuntos y sus referencias/hashes; la recuperación debe comprobar que se pueden abrir y asociar al trabajador correcto.
- Guardar copia en ubicación **privada cifrada**, distinta de fuente; custodiar la clave de recuperación por separado. La matriz de conciliación también es privada.
- No escribir en bases operativas durante inspección/migración; nunca reutilizar ruta productiva para pruebas.

## Requisitos antes de operación real
1. Respaldo local consistente y **restauración realizada** en una carpeta/instancia aislada.
2. Respaldo externo cifrado y **restauración verificada en otro equipo/entorno** sin depender del PC original.
3. Verificación de integridad de tablas, referencias, PDFs, hashes, permisos, historiales y montos.
4. Custodio, frecuencia, retención, RPO (pérdida de datos tolerable), RTO (tiempo de recuperación) y responsables documentados y aprobados.
5. Procedimiento de revertir versión y datos probado, con prohibición de escrituras en dos sistemas divergentes.
6. Certificados, credenciales y secretos custodiados, no adjuntos al mismo backup.

**Estado inicial:** restauración externa del sistema NUEVO **no acreditada**. La ausencia de ella bloquea uso en producción/corte definitivo, **no** bloquea desarrollo ni ensayos locales autorizados con copias aisladas.

## Seguridad de aplicación
- Roles por empresa/local y por operación; una sesión/identidad operativa independiente de la ficha laboral.
- Personal clínico/administrador autorizado para ficha médica. Propinas no recibe datos clínicos ni por API, exportación o error.
- Autenticación sin contraseñas iniciales fijas al unificar; no exponer tokens QR/PIN, sesiones ni hashes.
- Auditoría de altas, cambios de área/cargo, contratos, accesos sensibles, correcciones de asistencia, reglas de propina y cierres.
- Evitar accesos cruzados entre empresas; autorización validada en backend, no solo botones ocultos.
- Publicación HTTPS, endurecimiento y privacidad revisados antes de operar fuera de red local.

## Política de archivos en Git
`.gitignore` es una protección adicional, no suficiente. Fixtures solamente sintéticos. Los scripts de comprobación de secretos se incorporarán y verificarán al instalar el código en INT-001; no afirmar que CI ya los ejecuta.

## Puerta obligatoria antes de producción: secretos, usuarios y sesiones (acordado 10-11-2026)

**Estado: PENDIENTE PARA PRODUCCIÓN.** Este apartado es un requisito de transición y **no autoriza modificar ahora** la configuración local de pruebas, restablecer contraseñas, rotar claves, desplegar ni poner el sistema en producción.

### Seguridad que debe quedar implementada desde desarrollo

- El servidor **no puede usar** el valor predeterminado conocido `'desarrollo'` para `JWT_SECRET` ni arrancar sin un secreto seguro. Corregir el fallback en código y añadir tests de arranque con variable ausente, insegura y válida **antes de cualquier exposición productiva**. No confundir esa corrección de código con rotar una clave que ya es segura.
- Los entornos de desarrollo/pruebas y producción usan secretos distintos. Los secretos y copias cifradas permanecen fuera de GitHub, CI público, documentación y capturas.
- La presencia de un instalador que genera `JWT_SECRET` **no acredita que una instalación concreta esté configurada**; se comprobará de forma privada sin imprimir su valor.

### Checklist de activación productiva

- [ ] Cerrar puertas de seguridad (permisos Root y por empresa/sucursal, autorización por API, auditoría y datos bancarios/clinicos) y verificar restauraciones y pruebas de regresión.
- [ ] Generar o asignar un **`JWT_SECRET` único y aleatorio de producción**, mediante gestión segura de secretos. Conservar una clave válida de pruebas sin exponerla. **Cambiar JWT invalida sesiones previas y exige volver a iniciar sesión**, pero no cambia las contraseñas almacenadas.
- [ ] Inventariar las cuentas de usuarios. **Exigir cambio de contraseña solo** a quienes tengan credenciales iniciales, compartidas, débiles o de prueba; mantener las contraseñas personales seguras cuando corresponda. Evaluar MFA para administradores y Root.
- [ ] Activar Root expresamente por el responsable, revisar privilegios, cuentas de Contabilidad, administradores de local y acceso sensible. No asignar privilegios universales por defecto ni activar el aislamiento por local hasta probarlo.
- [ ] Configurar y resguardar la **clave definitiva de cifrado bancario** por separado de JWT. **No rotar ni reemplazar `SAGVA_BANK_DATA_KEY`** que ya protege datos reales sin migración criptográfica controlada, respaldo verificable y plan de recuperación. Con datos exclusivamente sintéticos, usar secretos de prueba independientes.
- [ ] Realizar respaldo consistente y restauración ensayada, comprobar documentos y registros; ejecutar pruebas Windows, servidor, móvil HTTPS y autorización formal antes de cambiar a producción.
- [ ] Registrar acta privada de fecha, responsable, versión/SHA desplegado, controles aprobados, rotación/autenticación y plan de recuperación. No registrar valores de claves, contraseñas ni datos personales.

**No hay reestructuración obligatoria de todo el sistema por este punto**: son controles de código y configuración de despliegue. La decisión de ponerlo en producción queda pendiente de autorización explícita del propietario.
