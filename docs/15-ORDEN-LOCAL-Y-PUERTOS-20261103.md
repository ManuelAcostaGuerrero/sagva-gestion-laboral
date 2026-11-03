# Organización local y separación de puertos — 03-11-2026

## Qué proyecto conservar

La revisión se ejecutó en Windows local autorizado. **De las cinco carpetas de asistencia, la instalación original vigente es `asistencia-huella-digital`, v1.19.2.** Los directorios QR son ensayos históricos del mismo repositorio, no cuatro aplicaciones que deban seguir iniciándose.

**SAGVA Gestión Laboral es el proyecto nuevo de integración, todavía en INT-001. No es una unificación completa aceptada con Propinas ni una migración a PostgreSQL acreditada.** Esta reparación operativa no cierra INT-001/INT-002 ni autoriza conciliación de personas o INT-003.

| Carpeta revisada | Hallazgo comprobado | Decisión ejecutada |
| --- | --- | --- |
| `asistencia-huella-digital` | Repositorio principal, main de origen `fe1f797c3a15ed436899f52cd94063f94db23344`, v1.19.2 | Conservar como original vigente; corrección local separada en rama de revisión |
| `asistencia-qr-identidad` | Worktree detached `22c8a62c5ecf5b19fa6c90656929d8069a636ce6`, paquete 1.18.0; ensayo aislado de identidad con su propia SQLite | Respaldar, verificar y retirar de las carpetas activas |
| `asistencia-qr-lan` | Worktree detached `ba36ec70d4a7054d8a3c8b5670d74bb98191bbca`, paquete 1.18.0; ensayo LAN/TLS | Respaldar, verificar y retirar |
| `asistencia-qr-piloto` | Carpeta completamente vacía, sin repositorio ni archivos | Eliminar únicamente la carpeta vacía |
| `asistencia-qr-piloto-nuevo` | Worktree detached `3788c0776a67e23bc5ecb87799ba4967b992a615`, paquete 1.18.0; ensayo de cámara/QR | Respaldar, verificar y retirar |
| `sagva-gestion-laboral` | Repositorio independiente, rama `int001-huella-codigo`; instalación inicial `652a1783a3a8d06cf2c3aed2451dbd5a4c93ba86` | Conservar como integración en desarrollo; incorporar por fast-forward solo la documentación remota pendiente `3c5c358969c2b802adbc36f9e0e79674fad769f2`, sin sobrescribir la reparación |

Los worktrees tenían Git limpio, pero contenían código experimental no idéntico al main vigente. **No se fusionaron experimentos ni bases por copia de carpetas.** Se preservó cada commit con referencias Git locales `archivo/asistencia-qr-…-20261103`. Se generaron ZIP privados del código y archivos locales, excluyendo únicamente Git y salidas regenerables `node_modules`/`dist`; se verificaron CRC y SHA-256 de todos los archivos archivados antes de retirarlos con Git. La base del piloto recibió además una copia SQLite consistente comprobada.

Archivo privado recuperable: `C:\Users\Admin\Documents\Codex\Archivo-SAGVA\2026-11-03\pilotos-retirados`. No se publican ZIP, certificados, tokens, bases ni manifiestos privados. Dos enlaces npm huérfanos que Git dejó se conservaron aparte en `restos-enlaces-npm`; no se siguieron ni eliminaron destinos de enlaces. Las cuatro rutas QR ya no existen entre los proyectos activos.

## Causa del fallo

Gestión Laboral heredó de Huella los puertos API **4000** y web **5173**. Sus procesos registrados ocupaban ambos. El `Iniciar.bat` de Huella rechazaba el conflicto correctamente y no cerraba el otro proyecto. El título y los archivos públicos servidos correspondían al nuevo repositorio, no al original que se quería iniciar.

Los procesos se habían iniciado como administrador; desde una sesión normal Windows ocultaba sus comandos y denegaba detenerlos. La detención inicial solicitada por el propietario se realizó mediante el aviso de administrador de Windows, validando PID, creación y ruta exacta; nunca por nombre global o solamente por puerto.

## Puertos e inicio corregidos

| Proyecto | API | Pantalla | HTTPS móvil reservado |
| --- | --- | --- | --- |
| Huella original | `127.0.0.1:4000` | <http://127.0.0.1:5173/> | 5180 |
| Gestión Laboral INT-001 | `127.0.0.1:4010` | <http://127.0.0.1:5183/> | 5184 |

Se mantiene el `Iniciar.bat`, `Detener.bat`, `Reiniciar.bat` y `Estado.bat` de cada carpeta. No se instala otro actualizador. Vite utiliza puerto explícito y `strictPort`, sin saltar silenciosamente al puerto de otro sistema. En Gestión Laboral se ajustaron backend, proxy compilado y de desarrollo, comprobación de salud, diagnóstico, configuración de ejemplo y referencias del helper HTTPS/túnel. **No se inició ni configuró Cloudflare, DNS, firewall o TLS en esta ejecución.** Su validación externa/móvil permanece pendiente.

Ambos controladores ahora reconocen una segunda apertura saludable como **ya iniciado**, sin duplicar procesos, respaldar ni migrar nuevamente. Una instancia parcial se rechaza con diagnóstico. Se siguen exigiendo ruta, nombre y sello de creación del proceso; un PID reutilizado o de otro directorio no se adopta. Cuando Windows impide leer el comando, se solicita el mismo nivel de privilegios de inicio y se bloquea el control: no se llama a métodos sobre valores nulos ni se mata un proceso no acreditado.

**Estado final solicitado:** Huella activo en 5173/4000. Gestión Laboral detenido, preparado para iniciar en 5183/4010. Ambos se probaron simultáneamente antes de dejar ese estado. Sus usuarios, credenciales y bases siguen siendo independientes; no hay sincronización ni mezcla de trabajadores.

## Código comprobado

- Huella: `9883e46e34948b105e19fdc944ec29dc40ec8d22`, rama `fix/puertos-locales-20261103`.
- Gestión Laboral: `3244b2007153c25fdd9c9783344c8240bcc1ff3b`, rama existente `int001-huella-codigo`.

Los commits posteriores de esta entrega son solo documentación/evidencias. La versión fuente Huella sigue siendo 1.19.2; no se declara una nueva versión de producto ni una fase INT aceptada. No se fusiona ningún PR ni se modifica main remoto.

## Respaldos y pruebas reales

Antes de cambiar código/configuración se copiaron privadamente ambos árboles de código y configuración. SQLite se respaldó con la API consistente de Node; una copia independiente de cada respaldo pasó integridad y claves foráneas. Esto **no equivale a recuperación externa ni a paridad funcional completa INT-002**. Las claves/configuración no relacionadas con el enrutamiento permanecieron iguales. En Gestión Laboral solo se ajustaron `PORT` y los orígenes locales correspondientes; en Huella no se alteró su entorno.

| Prueba Windows | Huella | Gestión Laboral |
| --- | --- | --- |
| `npm run test:server` | 66 aprobadas | 68 aprobadas |
| `npm run build --workspace client` | Aprobada | Aprobada |
| `tools/test-control-local.ps1` | 13 controles aprobados | 13 controles aprobados |
| Navegador Chromium real, sin autenticar con datos operativos | Pantalla Asistencia y acceso Administración visibles, sin errores JS | Mismo recorrido, sin errores JS |
| Navegador → proxy `/api/health` → API real | HTTP 200 | HTTP 200 |
| Segunda ejecución real de Iniciar | Mismos PID, sin procesos nuevos | Mismos PID, sin procesos nuevos |
| Integridad/fuentes SQLite | Integridad y referencias correctas; valores previos idénticos al respaldo | Mismo resultado |

Se probó además un **conflicto real controlado**: después de detener solo Gestión Laboral se ocupó 4010 con un servidor de prueba sin datos. Iniciar rechazó el puerto antes de respaldar/migrar, no cerró ese servidor y conservó Huella. Se retiró únicamente el servidor creado para ese ensayo. Propinas en 3000 y Reparto en 5000 conservaron sus PID durante la prueba de detención/conflicto.

Las suites de servidor usan SQLite en memoria y datos sintéticos. Las comprobaciones de las instalaciones fueron de salud, acceso sin sesión y comparación privada de integridad/contenido, sin crear marcaciones, trabajadores ni fichas clínicas. No se publican datos, cantidades de personas, PDFs ni capturas autenticadas.

Se corrigió el arnés de navegador para abrir Administración desde la portada de Asistencia; el primer selector esperaba incorrectamente el formulario de acceso en la portada. No era un defecto de la aplicación. Un resto de enlaces npm se archivó al detectarlo; la comprobación final de ausencia de las cuatro carpetas pasó.

[Resultados y registros sanitizados](evidencias/puertos-20261103/README.md). Respaldo completo y diagnóstico privado bajo `Archivo-SAGVA\2026-11-03`; no deben subirse a GitHub.

## Límites y operación futura

- **Actualizar.bat de Gestión Laboral sigue sin habilitarse para INT-001**, conforme a AGENTS. Esta tarea usó control manual de inicio/detención, no el actualizador ni una importación.
- La corrección de Huella está publicada en rama de revisión; no se fusiona automáticamente a main. Su `Actualizar.bat` exige main y no debe utilizarse sobre esa rama hasta integrar la corrección revisada. El inicio/detención local quedó probado; no se afirma que esta entrega acredite el protocolo completo de actualización.
- No se validaron lector físico, cámara de teléfono, TLS móvil, túneles ni certificación DT. Tampoco paridad integral, conciliación de identidades, integración de Propinas, PostgreSQL canónico o restauración externa. No se avanzan fases por resolver puertos.
- Los archivos de inicio de cada proyecto deben ejecutarse con el mismo nivel de privilegios que los creó; se dejaron los nuevos procesos de Huella bajo el usuario normal para evitar la necesidad habitual de administrador.
