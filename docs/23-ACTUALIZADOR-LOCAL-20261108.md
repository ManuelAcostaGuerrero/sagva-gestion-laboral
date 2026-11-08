# Corrección de Actualizar.bat y operación local — 08-11-2026

El propietario solicitó expresamente corregir el bloqueo de actualización y completar la actualización local. La instalación había quedado en `int001-huella-codigo` (`a298eca`), pero el controlador exigía main incluso cuando todos sus commits estaban integrados. `main` ya contenía PR #1 y Entrega 1/PR #4 (`bab0b676ff9ad687ddaf500ab9704a277888bda1`). No correspondía forzar Git, borrar la rama ni perder las correcciones de puertos.

Esta autorización habilita la operación manual local del actualizador una vez probada. **No acepta INT-001/INT-002, no inicia INT-003 ni autoriza producción, importaciones o correspondencias de trabajadores.** Se conserva el procedimiento de privacidad y pruebas sintéticas.

## Comportamiento corregido

1. Verificar repositorio/origen, árbol limpio y ausencia de recuperación pendiente. Admitir main o la rama antigua INT-001 únicamente si su HEAD es ancestro de main remoto. Rechazar commits no integrados y main local divergente. Nunca reset, stash ni borrado de cambios del propietario.
2. Descargar y fijar un SHA exacto. Si Git y las huellas de todos los archivos del build coinciden con una instalación acreditada, informar «Ya está actualizado», sin detener procesos, reinstalar ni abrir pestañas.
3. Preparar un worktree aislado. Ejecutar npm ci, validación de sintaxis/manifiestos, pruebas de servidor, build, auditoría y pruebas de los controladores. La instalación anterior sigue funcionando durante esta preparación. Las pruebas usan SQLite en memoria y ningún `.env` operativo se copia al candidato.
4. Comprobar que la instalación no cambió durante la preparación; respaldar SQLite/configuración con el helper mantenido y comprobar integridad. Registrar intento, SHA anterior, destino, estado previo y ubicación del respaldo en `.local/update-state.json`.
5. Detener solo los PID acreditados de este proyecto por ruta y creación; activar main por avance seguro conservando la rama anterior. Instalar dependencias desde la caché ya preparada con npm ci offline; activar el build probado. No detener Huella, Propinas, Delivery, túneles ni navegador.
6. Marcar la fase de migraciones, aplicarlas con el helper mantenido y verificar integridad y referencias. Si falla después de la parada, dejar marca de recuperación y rechazar nuevos inicios/actualizaciones hasta revisión; no intentar una restauración de esquema a ciegas. Si falla antes de la parada, mantener el servicio anterior.
7. Acreditar SHA del build, huellas, procesos y salud. Reiniciar solamente si estaba funcionando. Un sistema apagado permanece apagado. Un fallo de limpieza de la preparación no convierte una actualización correcta en falsa caída del servicio.

El primer cambio de una instalación que todavía ejecuta el controlador antiguo se hace de forma controlada después de respaldo y prueba del candidato: detener sus procesos propios, activar main y usar el `.bat` ya corregido; conservar el estado previo para iniciar después si correspondía. Las actualizaciones siguientes no necesitan ese paso de transición.

## Pestaña, formularios e identificación

El build incluye `local-version.json` y un SHA embebido en el JavaScript. Un aviso en la pestaña existente compara ambas versiones y ofrece recargar después de guardar. Cancelar conserva el borrador. El actualizador no abre ni cierra pestañas ni intenta controlar perfiles del navegador. Los assets antiguos se conservan durante la activación para permitir terminar formularios que ya estaban abiertos; la nueva portada referencia el bundle nuevo.

La etiqueta dice INT-001 y commit, evitando presentar la versión fuente Huella 1.19.2 como una versión nueva de producto aceptada. El propietario puede comprobar si la pestaña corresponde al código instalado.

## Dependencias y regresión

Se corrigen los cuatro hallazgos de auditoría reportados durante el diagnóstico mediante versiones corregidas del lock y Zod 4.6.7. El cambio de Zod se valida con las pruebas existentes de las rutas: Personal, Empresas, administración, documentos, permisos, licencias, ficha médica, turnos y QR/PIN. No se utiliza `npm audit fix --force` en la instalación operativa ni se cambian reglas económicas o identidades. Las actualizaciones de dependencias futuras se preparan y revisan en Git, no se resuelven automáticamente durante la operación.

## Evidencias de desarrollo

- Diagnóstico inicial de main `bab0b67`: compilación correcta, 75 pruebas de servidor y 13 controles; todavía cuatro vulnerabilidades. No instalado durante ese diagnóstico.
- Corrección: 75 pruebas sintéticas aprobadas tras actualizar dependencias; 13 controles de identidad/inicio y 24 aserciones del actualizador (dobles sin DB ni procesos reales). Auditoría con cero hallazgos en la ejecución registrada.
- Navegador Chromium real, API Express y SQLite en memoria: aviso por cambio de versión, borrador conservado, cancelación y recarga autorizada en una única pestaña.
- La activación real y los SHA exactos instalados se registran posteriormente en el PR y en el informe local; no se confunden estos dobles con una restauración externa o con una instalación ya realizada.

Los archivos de diagnóstico y respaldos permanecen privados bajo `.local`/Archivo-SAGVA. No publicar secretos, fichas, cantidades personales, bases, PDFs ni capturas autenticadas. No activar Actions de pago ni ejecutar importadores. Continúan pendientes la recuperación externa independiente, aceptación funcional integral, pruebas físicas y conformidad legal/productiva.
