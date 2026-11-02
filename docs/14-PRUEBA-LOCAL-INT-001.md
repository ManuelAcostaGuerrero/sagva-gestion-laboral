# INT-001 — Probar Huella en Windows sin tocar la original

**Estado:** procedimiento de prueba propuesto; todavía no ejecutado en la PC del propietario. Debe realizarse solo cuando GitHub Actions del commit elegido esté en verde y se haya comprobado que la app original no ocupa los puertos 4000/5173.

## Requisitos
- Windows con Git y Node.js 24 o posterior.
- Tener una copia existente y legítima del proyecto **Asistencia Huella Digital 1.19.2** en la PC, por ejemplo en `C:\Users\Admin\Documents\Codex\asistencia-huella-digital`.
- Los recursos externos de DigitalPersona se copian **solo localmente**, sin subirlos al repositorio público. No es una autorización de redistribución ni una prueba del lector físico.
- Ninguna base de trabajadores ni archivo `data/asistencia.db` se trasladará del original. Se usa **nueva SQLite local vacía**.

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
