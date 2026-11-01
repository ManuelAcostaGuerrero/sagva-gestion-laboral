# 13. INT-001 — Incorporación de código de Huella (evidencia y pendientes)

**Fecha:** 01-11-2026  
**Estado:** copia técnica parcial; no hay paridad funcional demostrada. No aprobado.  
**Origen fijado:** `ManuelAcostaGuerrero/asistencia-huella-digital`, commit `fe1f797c3a15ed436899f52cd94063f94db23344`, versión 1.19.2.  
**Destino:** `sagva-gestion-laboral`, rama `int001-huella-codigo`. El `main` no debe sustituirse por una versión que no compila.

## Resultado de la comparación Git
- Origen: 223 archivos versionados, incluidos documentación original y recursos.
- Alcance de copia: 191 archivos funcionales, pruebas, herramientas, dependencias, workflows y recursos, **excluyendo documentación PDF/manuales, README/CHANGELOG originales y gitignore original**. Se conserva el README y reglas propias del nuevo proyecto.
- **187 de esos 191 archivos están ya copiados y tienen SHA Git idéntico a su origen**, sin refactor ni modificación.
- No se copiaron datos SQLite privados, secretos, nóminas, contratos, ficheros médicos ni respaldos.
- El número 187 **no acredita instalación, ejecución ni paridad visual**.

## Cuatro archivos pendientes de resolver sin exponer información
1. `client/src/services/api.js`: **esencial para compilar**. La operación de transferencia de código entre repositorios fue bloqueada por controles de seguridad; no está publicado en este PR. Debe quedar idéntico al original tras transferencia autorizada/segura y verificación SHA.
2. `client/public/brand/red-taurus-sidebar.png`: logo de Huella necesario para reproducción visual exacta. La transferencia binaria a GitHub fue bloqueada; no está publicado en este PR. No sustituirlo con una imagen inventada.
3. `client/public/vendor/digitalpersona/fingerprint.sdk.min.js`: biblioteca de terceros. No republicar públicamente sin revisar derechos/licencia; fingerprint físico no acreditado.
4. `client/public/vendor/digitalpersona/websdk.client.bundle.min.js`: biblioteca de terceros. Misma revisión antes de republicación; fingerprint físico no acreditado.

**Sin estos archivos, especialmente `api.js`, la instalación NO está lista para compilar y no debe describirse como copia exacta.** Si una biblioteca vendor no permite redistribución pública, deberá permanecer en almacenamiento privado y cargarse en el entorno autorizado mediante procedimiento aprobado, sin eliminar su función.

## Advertencias para pruebas locales
- El servidor y el frontend originales están preparados para Node.js 24+, API 4000 y web 5173; pueden colisionar con la instalación original si sigue encendida.
- `tools/control-local.ps1` contiene una validación del remote `asistencia-huella-digital`; **`Actualizar.bat` NO funciona para actualizar `sagva-gestion-laboral` sin adaptación previa**. No ejecutarlo hasta corregir esa validación de forma segura.
- `Preparar.bat` puede crear una base SQLite nueva y credenciales: usar **solo directorio aislado** y datos ficticios; no sobreescribir la carpeta/SQLite original.
- No interpretar que un `git pull` actualiza el sistema operativo local o migra datos.
- **No** pasar a PostgreSQL, Propinas, rediseño de UI ni migración real durante esta entrega.

## Salida pendiente para cerrar INT-001
1. Completar los cuatro recursos críticos de forma lícita/segura o documentar su provisionamiento local equivalente y conservar la funcionalidad.
2. Validar SHA de cada fichero de origen copiado.
3. Ejecutar `npm ci`, `npm run test:server` y `npm run build --workspace client` en CI del commit exacto.
4. Probar instalación aislada; revisar todos los flujos de Personal, Horarios, Documentos, Licencias, QR/PIN, usuarios y auditoría contra Huella original.
5. Solicitar aceptación expresa del propietario. No fusionar este PR mientras estén los bloqueos anteriores.
