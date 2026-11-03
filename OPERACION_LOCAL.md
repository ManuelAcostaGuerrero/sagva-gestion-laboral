# Asistencia huella digital: operacion local SQLite

Continuacion de «Busqueda proyecto huella marcacion», Proyecto huella.
Repositorio privado ManuelAcostaGuerrero/asistencia-huella-digital, rama main.
Unica carpeta en este equipo: C:\Users\Admin\Documents\Codex\asistencia-huella-digital.

## Uso diario

- Preparar.bat: inicializacion explicita. Genera .env y secreto JWT solo si no
  existen, crea SQLite y un administrador solo si la tabla de usuarios esta vacia.
  Nunca cambia una clave ni usuario existentes. Acceso inicial aleatorio en
  .local/acceso-inicial.txt; cambiar la clave desde Seguridad despues del primer login.
- Actualizar.bat: exige main limpia y no admite servicios ajenos en 4000/5173.
  Respalda antes de fetch y revisa la sintaxis del codigo remoto antes del avance
  fast-forward. Si este proyecto estaba iniciado, detiene solo sus procesos
  registrados y lo reinicia al pasar pruebas, build, migraciones e integridad.
  Desde 1.7.0 la migración de Rotativo consolida horarios históricos equivalentes,
  conserva las horas originales y reasigna referencias de semanas/calendarios al
  horario maestro antes de archivar duplicados.
  Si estaba detenido, sigue detenido. npm ci solo cuando faltan dependencias o
  cambian manifiestos. No hay reset, stash ni restauracion automatica.
- Iniciar.bat: revisa puertos antes de migrar, respalda y levanta los dos procesos
  identificados por ruta absoluta, PID y fecha de creacion. Verifica ambas URLs.
- Detener.bat: detiene solamente procesos registrados cuya identidad coincide.
- Reiniciar.bat: aborta si un servicio ajeno ocupa los puertos; reinicia los propios.
- Estado.bat: muestra puertos, procesos, servicios, configuracion y estado Git.
- Respaldar.bat: respaldo manual con este proyecto detenido.
- ImportarTrabajadores.bat: importación explícita A–F de un Excel, con el mismo
  mutex, comprobación de puertos y respaldo previo. No forma parte del arranque.

Frontend http://localhost:5173; API http://localhost:4000/api.

Desde 1.8.0, Armar horario guarda borradores automaticamente despues de una breve
pausa de edicion, al cambiar de modulo y antes de cerrar sesion manualmente. El
guardado automatico no publica horarios. «Repetir en semana siguiente» crea una
nueva base semanal con los turnos y las personas activas de la semana actual.
El control inicia la pantalla compilada, sin publicar el servidor de desarrollo.
El servidor web también ofrece /api para acceso por una sola dirección HTTPS.
Cloudflare se controla manualmente con IniciarCloudflare.bat, EstadoCloudflare.bat
y DetenerCloudflare.bat; ver docs/cloudflare-local.md.
Logs y registro de procesos en .local. No hay autoactualizaciones ni tareas
programadas. Mutex evita controles simultaneos. No se matan procesos por puerto.
No afecta reparto (5000), propinas (3000) ni otros servicios.

## Datos y configuracion

SQLite en data/asistencia.db, relativo a la raiz y dentro de esta misma carpeta.
server/.env define SQLITE_PATH, JWT_SECRET, ADMIN_SESSION_EXPIRES_IN, PORT=4000 y CLIENT_ORIGIN.
ADMIN_SESSION_EXPIRES_IN controla la duración de la sesión administrativa; si no
se define, el servidor usa 8h. El cierre manual sigue disponible y el cliente
mantiene el aviso previo al vencimiento.
client/.env admite VITE_API_URL=/api (o vacío). La pantalla se conecta por /api
en su propia dirección; las URLs absolutas antiguas se ignoran. El puerto 4000
lo usa internamente el servidor web. El arranque comprueba /api/health en 5173.
El login muestra si el servidor responde y la versión de la pantalla instalada.
Después de Actualizar.bat, recargar el navegador con Ctrl+F5 para abrir la nueva
versión. La actualización conserva usuarios y contraseñas; no restablece admin.
Node.js 24 o posterior incluye el motor usado por este proyecto. No requiere MySQL,
mysqldump, credenciales de base ni servicio adicional.
Documentacion de la API empleada: https://nodejs.org/docs/latest-v24.x/api/sqlite.html.

database/schema.sql es SQLite. Cambios de esquema se aplican dentro de transaccion
por server/src/migrations.js y se registran en schema_migrations. No hay importacion
historica, seed periodico, restauracion ni duplicacion de usuarios/marcaciones.
Actualizacion y arranque nunca vuelven a crear ni restablecer el administrador.
Despues de cambiar la clave desde el sistema, .local/acceso-inicial.txt ya no
es un acceso vigente: conserva solo la clave generada en la primera instalacion.
Usar la clave elegida o la recuperacion configurada en Seguridad.

Version 1.3.0: Administracion > Armar horario permite diseñar puestos anonimos, asignar
personas y publicar. Guia: docs/planificador-semanal.md. La segunda migracion
incorpora tablas, siete areas sugeridas y 77 modelos de turnos sin importar
personas ni horarios historicos. Conserva datos, configuracion y claves actuales.
Las transacciones se serializan dentro del servidor. Fechas de marcacion conservan
la hora local configurada; las fechas de auditoria usan la hora del equipo.
Unicidad de documentos/usuarios usa NOCASE de SQLite; NOCASE ignora mayusculas ASCII,
no reproduce todas las equivalencias de acentos del antiguo MySQL.

## Respaldo y recuperacion

.local/backups/<fecha-identificador> guarda configuracion, acceso inicial si existe,
commit y copia SQLite verificada (asistencia.db). Usa la API de backup SQLite para
incluir registros aun presentes en WAL; valida integridad y claves foraneas.
No copia el proyecto ni crea clones adicionales. Permisos de respaldos y .local
restringidos al usuario actual y SYSTEM; server/.env se protege al preparar.
Nunca se suben .env, datos, credenciales ni respaldos a Git. Si falla un respaldo,
se bloquea la operacion y se marca el archivo incompleto. No se purgan respaldos.

Para recuperar, detener este proyecto, respaldar el estado actual y revisar que
la copia corresponde al sistema correcto. Reemplazar manualmente el archivo
indicado en database-path.txt; eliminar WAL/SHM antiguos solo despues de confirmar
que no hay procesos usando la base. Nunca aplicar una copia sobre un servidor activo.
El control no hace rollback de datos/codigo ni restauracion automatica.

## Cuando una actualizacion falla

El detalle queda en .local/<fecha>-Actualizar.log. Un archivo JSX incompleto se
detecta antes de instalar la version remota. Si hay cambios locales, otra rama,
commits no publicados o servicios ajenos, se cancela sin forzar Git ni cerrar
esos servicios. Un fallo de pruebas o compilacion impide migrar e iniciar.
Corregir el problema en GitHub y volver a ejecutar Actualizar.bat. No borrar
.env ni SQLite para solucionar un error de codigo.

Esta PC no tenia una base MySQL de huella: la inicializacion SQLite crea una base
vacia y no convierte datos inexistentes. Si otra PC conserva MySQL con datos,
respaldar y realizar una conversion explicita verificada; cambiar .env no importa
esos datos. La configuracion DB_HOST antigua sin SQLITE_PATH bloquea el arranque.

## Lector real

Se mantienen captura WebSDK, plantillas y comparador .NET DigitalPersona. Para
probar un dedo real aun se necesitan driver/DPAgent, SDK y .NET 8; SQLite no instala
esos componentes. La aplicacion y marcacion por clave/manual funcionan sin ellos.
Los scripts de diagnostico son de solo lectura; el reiniciador de lector original
es una accion separada explicita sobre DpHost.

## Continuidad y validacion

Desarrollar, confirmar y subir a GitHub; luego actualizar manualmente. Nunca reset
forzado, stash ni descarte automatico. Si falla validacion despues del avance Git,
queda detenido y el log explica el fallo. Para futuras sesiones continuar en esta
misma carpeta. No tocar los archivos de referencia del proyecto ChatGPT.

Pruebas: reglas de colacion existentes; API en base de memoria (login, empleados,
plantillas sinteticas, codigo/manual, reportes, horarios, auditoria, notificaciones);
restricciones/rollback/concurrencia y recuperacion de respaldo WAL. No hay datos de
prueba en la base real. El lector fisico requiere verificacion en equipo preparado.
Las dependencias existentes reportan 11 vulnerabilidades (1 critica); pendiente
una revision separada sin aplicar cambios forzados a funcionalidad.

Versión 1.4.0: ficha persistente y migración 20261003_003_employee_files.
Documentación vigente: docs/ficha-trabajador.md y docs/checklist-dt.md.
Las fichas pueden quedar incompletas. VALIDADO es revisión interna de datos;
no equivale a certificación DT. Propinas no se modifica ni sincroniza.
