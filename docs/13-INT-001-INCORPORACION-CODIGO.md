# 13. INT-001 — Incorporación de código de Huella (evidencia y pendientes)

**Fecha:** 01-11-2026  
**Estado:** copia técnica parcial; no hay paridad funcional demostrada. No aprobado.  
**Origen fijado:** `ManuelAcostaGuerrero/asistencia-huella-digital`, commit `fe1f797c3a15ed436899f52cd94063f94db23344`, versión 1.19.2.  
**Destino:** `sagva-gestion-laboral`, rama `int001-huella-codigo`. El `main` no debe sustituirse por una versión que no compila.

## Resultado de la comparación Git
- Origen: 223 archivos versionados, incluidos documentación original y recursos.
- Alcance de copia: 191 archivos funcionales, pruebas, herramientas, dependencias, workflows y recursos, **excluyendo documentación PDF/manuales, README/CHANGELOG originales y gitignore original**. Se conserva el README y reglas propias del nuevo proyecto.
- **187 de esos 191 archivos fueron copiados idénticos por SHA; posteriormente se agregó `api.js` idéntico y se modificó exclusivamente el controlador Windows para el nuevo repositorio**, sin refactor ni modificación.
- No se copiaron datos SQLite privados, secretos, nóminas, contratos, ficheros médicos ni respaldos.
- El número 187 **no acredita instalación, ejecución ni paridad visual**.

## Cuatro archivos pendientes de resolver sin exponer información
1. `client/src/services/api.js`: **RESUELTO**. Archivo incorporado y SHA idéntico al original `a943fc978ffcf065b9761c82c45e41c8bae181a7`. Dos workflows completaron con éxito en el commit `627b0c4d7b3dbc8a3cd0645fa7cc42228a5430c7`.
2. `client/public/brand/red-taurus-sidebar.png`: logo original; no redistribuido en el repositorio. Se copia desde la instalación original mediante `tools/preparar-recursos-local.ps1` y se comprueba su SHA.
3. `client/public/vendor/digitalpersona/fingerprint.sdk.min.js`: biblioteca de terceros, se provisiona únicamente en PC autorizada con copia de la instalación original; no republicar sin derechos/licencia.
4. `client/public/vendor/digitalpersona/websdk.client.bundle.min.js`: biblioteca de terceros, misma disposición local. Prueba del lector físico pendiente.

**Las pruebas GitHub del commit que incorporó `api.js` se aprobaron.** Para reproducir la imagen y el lector originales es obligatorio provisionar los tres recursos localmente; todavía no hay prueba visual o hardware aprobada. Si una biblioteca vendor no permite redistribución pública, deberá permanecer en almacenamiento privado y cargarse en el entorno autorizado mediante procedimiento aprobado, sin eliminar su función.

## Advertencias para pruebas locales
- El servidor y el frontend originales están preparados para Node.js 24+, API 4000 y web 5173; pueden colisionar con la instalación original si sigue encendida.
- `tools/control-local.ps1` fue adaptado a `sagva-gestion-laboral` y usa un mutex distinto. **No ejecutar `Actualizar.bat` desde esta rama de prueba; requiere `main` y actualización solo de una release aprobada.**
- `Preparar.bat` puede crear una base SQLite nueva y credenciales: usar **solo directorio aislado** y datos ficticios; no sobreescribir la carpeta/SQLite original.
- No interpretar que un `git pull` actualiza el sistema operativo local o migra datos.
- **No** pasar a PostgreSQL, Propinas, rediseño de UI ni migración real durante esta entrega.

## Salida pendiente para cerrar INT-001
1. Completar los cuatro recursos críticos de forma lícita/segura o documentar su provisionamiento local equivalente y conservar la funcionalidad.
2. Validar SHA de cada fichero de origen copiado.
3. Ejecutar `npm ci`, `npm run test:server` y `npm run build --workspace client` en CI del commit exacto.
4. Probar instalación aislada; revisar todos los flujos de Personal, Horarios, Documentos, Licencias, QR/PIN, usuarios y auditoría contra Huella original.
5. Solicitar aceptación expresa del propietario. No fusionar este PR mientras estén los bloqueos anteriores.

## Instalación de prueba
Seguir [docs/14-PRUEBA-LOCAL-INT-001.md](14-PRUEBA-LOCAL-INT-001.md). Los tres recursos privados de publicación quedan localmente copiados con SHA verificado y excluidos expresamente de Git.
