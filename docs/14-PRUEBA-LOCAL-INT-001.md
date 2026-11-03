# INT-001 — Probar Huella en Windows sin tocar la original

**Estado:** procedimiento de prueba propuesto; todavía no ejecutado en la PC del propietario. Debe realizarse solo cuando GitHub Actions del commit elegido esté en verde y se haya comprobado que la app original no ocupa los puertos 4000/5173.

## Requisitos
- Windows con Git y Node.js 24 o posterior.
- Tener una copia existente y legítima del proyecto **Asistencia Huella Digital 1.19.2** en la PC, por ejemplo en `C:\Users\Admin\Documents\Codex\asistencia-huella-digital`.
- Los recursos externos de DigitalPersona se copian **solo localmente**, sin subirlos al repositorio público. No es una autorización de redistribución ni una prueba del lector físico.
- Ninguna base de trabajadores ni archivo `data/asistencia.db` se trasladará del original. Se usa **nueva SQLite local vacía**.

## Instalación inicial mediante BAT (recomendada)

El archivo **`Instalar-INT001.bat`** contiene los pasos de instalación que antes se pegaban en PowerShell. Está **separado de `Actualizar.bat`** y solo se usa para preparar la copia de INT-001.

1. Abre [Instalar-INT001.bat](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/blob/int001-huella-codigo/Instalar-INT001.bat) y descárgalo con **Raw / Descargar archivo sin procesar**.
2. Ejecuta ese BAT en Windows. Usa por defecto las rutas `C:\Users\Admin\Documents\Codex\asistencia-huella-digital` y `C:\Users\Admin\Documents\Codex\sagva-gestion-laboral`.
3. El BAT clona la rama `int001-huella-codigo` si no existe, copia los tres recursos locales originales con SHA verificado, ejecuta `npm ci`, `npm run test:server` y `npm run build --workspace client`.
4. Si ya existe la carpeta nueva, no la elimina, no hace `git pull` ni cambia la rama automáticamente. Si contiene base de datos o configuración privada, detiene la instalación.

**No ejecuta `Actualizar.bat`, `Preparar.bat` ni `Iniciar.bat`; tampoco abre pestañas.** Al terminar, para probar la aplicación sigue el apartado «Iniciar base de prueba aislada» de más abajo.

### Alternativa manual
## 1. Preparar carpeta independiente
Desde PowerShell, sustituir la ruta base solo si tu carpeta `Codex` está en otro lugar:

```powershell
cd C:\Users\Admin\Documents\Codex
git clone --branch int001-huella-codigo https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral.git sagva-gestion-laboral
cd .\sagva-gestion-laboral
```

Si la carpeta `sagva-gestion-laboral` ya existe, **no ejecutar clone encima**. Revisar primero su estado sin descartar cambios ni datos.

## 2. Copiar SOLO los tres recursos públicos/terceros localmente
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\preparar-recursos-local.ps1 -Origen "C:\Users\Admin\Documents\Codex\asistencia-huella-digital"
```

El script comprueba el SHA de Git de cada archivo y aborta si es diferente; no lee ni copia datos, `.env`, contratos, trabajadores, médicos, credenciales ni bases SQLite. Los tres recursos permanecen ignorados por Git.

## 3. Instalar dependencias y validar
```powershell
npm.cmd ci
npm.cmd run test:server
npm.cmd run build --workspace client
```

Si falla uno, detenerse y presentar el texto exacto del error. No ejecutar `npm audit fix --force` ni cambiar versiones por cuenta propia.

**Para esta validación de INT-001 no ejecutar `Actualizar.bat` ni desde Huella original ni desde SAGVA.** La comprobación del actualizador queda para una etapa posterior y deberá respetar los cuatro pasos documentados en `docs/07-VERSIONADO-Y-CAMBIOS.md`.

## 4. Iniciar base de prueba aislada
**Detener antes la instancia original de Huella** y comprobar que no hay otro sistema usando 4000, 5173 ni 5180. No cerrar programas por PID a ciegas. En la carpeta nueva:

```powershell
.\Preparar.bat
.\Iniciar.bat
```

El preparador genera credenciales aleatorias nuevas en `.local/acceso-inicial.txt`; guarda esa información en privado y cámbiala en Seguridad. Abrir `http://localhost:5173`. **No se importan trabajadores reales**.

`Actualizar.bat` debe utilizarse solo después de fusionar una versión verificada a `main`, con rama local `main` y copia de seguridad; no ejecutarlo desde la rama de prueba.

## 5. Comparar con Huella original
- Visual: menú, fichas, contratos, documentos, fichas médicas, planificador, marcación, botones y densidad de pantalla.
- Operación: crear empleado ficticio, empresa ficticia, contrato ficticio y turno; comprobar permisos, QR/PIN y guardado sin datos reales.
- Registrar diferencias con captura **solo de datos ficticios** en PR #1.
- El lector de huella físico requiere driver/SDK instalado y prueba separada; CI no demuestra su funcionamiento.

## Límites
Esto **no** es restauración de los trabajadores originales, integración de Propinas, migración PostgreSQL ni certificación productiva. El sistema de prueba no debe reemplazar el de uso diario. Si la instalación anterior debe continuar funcionando en paralelo, primero se necesita aislamiento de puertos y ajustes adicionales, no ejecutarlas simultáneamente.

## Aclaración vigente al 03-11-2026
El procedimiento de instalación anterior fue redactado antes de la prueba local de puertos y antes del merge de PR #1. **No volver a clonar ni ejecutar `Instalar-INT001.bat` si la carpeta nueva ya existe.** Los puertos documentados del entorno vigente son **Huella 4000/5173** y **SAGVA Gestión Laboral 4010/5183** (ver `docs/15-ORDEN-LOCAL-Y-PUERTOS-20261103.md`), por lo que es posible probar ambos sin mezclarlos cuando se conserva dicha configuración. La app nueva ya tiene código en `main`, pero la carpeta de Windows puede seguir en `int001-huella-codigo`. **No cambiar de rama, ejecutar `Actualizar.bat` ni modificar SQLite hasta comprobar el estado local y contar con procedimiento seguro de respaldo y despliegue.** Las pruebas integrales INT-001/INT-002 continúan pendientes.
