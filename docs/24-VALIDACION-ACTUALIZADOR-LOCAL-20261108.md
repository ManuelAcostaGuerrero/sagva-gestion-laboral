> **Archivo histórico recuperado de `evidencia/actualizador-local-20261108` el 12-11-2026.** Registra una ejecución pasada, no el estado de la versión actual en `main`. No se incluyen respaldos, capturas, claves, logs privados ni datos personales. Consulta `docs/40-CONSOLIDACION-RAMAS-Y-PENDIENTES-20261112.md` para el estado vigente.

# Actualizador corregido e instalación local acreditada — 08-11-2026

**Resultado: SAGVA Gestión Laboral actualizado y funcionando en Windows en http://127.0.0.1:5183/ (API4010).** La carpeta operativa está en main limpio, con upstream origin/main correcto. El `Actualizar.bat` habitual se ejecutó después de la instalación y respondió **«Ya está actualizado»**, conservando los mismos PID y sin abrir pestañas.

SHA exacto instalado: **`fd1405d5d0fb1defaf6cd6d3860998e107a65759`**. Incluye Entrega1/PR#4 y las correcciones de operación PR#5 y PR#6. La etiqueta del navegador muestra INT-001 y `fd1405d`. No se inventa una versión de producto nueva ni se acepta la fase de integración.

## Causa y solución

La instalación anterior estaba en `int001-huella-codigo`, commit `a298ecab76397ffd41d1ffec656603b74ae62809`; el actualizador rechazaba cualquier rama distinta de main, aunque ya estuviera integrada. El propietario solicitó expresamente corregirlo y completar la actualización local.

Se implementó el protocolo de [actualización local](23-ACTUALIZADOR-LOCAL-20261108.md): candidato probado antes de parar; SHA fijado; respaldo; identidad de procesos; transición segura a main; dependencias preparadas; migraciones verificadas; bloqueo tras un fallo; sello del build; respeto del estado encendido/apagado y salida sin cambios. La prohibición anterior del BAT en AGENTS se sustituyó únicamente para esta operación manual autorizada. No se habilita producción ni se saltan puertas INT.

La primera activación, con `ae49ee7`, falló al establecer upstream porque el clon original era --single-branch y su refspec solo cubría INT-001. El bloqueo se produjo en **activación, antes de dependencias/migración**, y se conservó el respaldo y el intento fallido. Se añadió cobertura con un clon Git temporal real y una corrección que agrega solo el refspec de main cuando falta. PR#6 integró esa corrección.

Antes de levantar el bloqueo se acreditaron SHA esperado, árbol limpio, integridad y contenido/esquema idénticos al respaldo, y ausencia de la migración nueva. La revisión quedó privada; no se borró la marca a ciegas ni se restauró una base. El reintento se completó en `fd1405d`; después se inició el sistema porque estaba funcionando antes del primer intento. La primera transición se ejecutó con funciones del controlador aprobado extraídas de Git, sin copiar cambios sueltos sobre el checkout antiguo. La operación posterior del BAT real quedó comprobada.

## Validación real

| Control | Resultado |
| --- | --- |
| Preparación aislada del SHA instalado | npm ci, sintaxis, servidor, build, auditoría y controladores aprobados antes de aplicar |
| Pruebas de servidor | **75 aprobadas**, SQLite sintética/en memoria |
| Identidad/inicio de procesos | **13 controles**, dobles sin DB operativa |
| Orquestación de actualización | **24 aserciones**, ramas, no-op, fallos, bloqueo, orden y estado previo |
| Git real temporal | Clon single-branch → main, upstream correcto, rama anterior conservada, divergencia rechazada |
| Navegador de prueba real | Express/SQLite en memoria, aviso de versión, borrador conservado, cancelación segura y recarga confirmada de una sola pestaña |
| Auditoría final instalada | **0 vulnerabilidades** en la ejecución del08-11; corregidos los cuatro hallazgos iniciales, incluido Zod4.6.7 |
| Proceso/API instalada | HTTP200 en5183, procesos acreditados de esta carpeta |
| Build servido | local-version.json y etiqueta de navegador corresponden al SHA instalado |
| Git operativo | main limpio, upstream origin/main y mismo SHA |
| Datos anteriores | Todas las filas/columnas previas de negocio conservadas frente al respaldo; no se publican contenidos ni cantidades |
| Migración aditiva | `20261108_016_company_territory` una sola vez; tres columnas nuevas de territorio, sin reemplazar valores anteriores |
| Integridad | SQLite integrity_check y foreign_key_check correctos |
| Configuración | server/.env y client/.env idénticos a sus copias previas; claves/usuarios no modificados |
| Segundo Actualizar.bat real | «Ya está actualizado»; mismo processes.json/PID, sin reinicio |
| Otros proyectos | PID de servicios3000/4000/5173/5000 conservados durante la operación |

El sistema permaneció detenido después del fallo de activación hasta completar la revisión y el reintento. No se afirma continuidad ininterrumpida. El nuevo esquema no se aplicó durante el intento fallido. La migración real solo se aplicó en el intento acreditado y luego se comprobó su idempotencia al iniciar.

## Evidencias y alcance

[Resultados sanitizados y etiqueta pública](evidencias/actualizador-20261108/README.md). El historial de intentos, configuración y respaldos permanecen privados en `.local` y `Archivo-SAGVA/2026-11-08`; nunca deben publicarse. El informe documental se publica en rama de evidencias, sin mover main ni provocar otra actualización de la instalación.

No se crearon trabajadores, marcaciones, contratos o fichas clínicas reales para probar. No se modificaron Huella, Propinas, Delivery, DNS o túneles. No se activaron Actions ni se contrataron servicios. Las capturas se limitan a la etiqueta pública de versión; no se publican pantallas autenticadas, bases, secretos ni PDFs.

**Este resultado acredita reparación del actualizador e instalación local.** Siguen pendientes aceptación funcional integral INT-001/INT-002, recuperación externa independiente, pruebas físicas/cámara/móvil, validación productiva/legal y conciliación de identidades. La auditoría es una observación de esta ejecución, no una garantía futura. Los fallos nuevos deben quedar registrados y proteger el servicio/datos según la fase; no se promete que toda actualización futura sea infalible.
