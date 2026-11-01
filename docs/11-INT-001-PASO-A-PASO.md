# 11. INT-001: instrucciones de primera ejecución

**Misión:** tener Huella Digital v1.19.2 (o versión/commit efectivo que se verifique al ejecutar) funcionando en `sagva-gestion-laboral` exactamente como en su repositorio original. **Sin mover la base real ni integrar Propinas todavía.**

## Responsable de ejecución y herramientas

**Ejecutar la parte GitHub directamente desde el chat:** lectura del repositorio original, selección de archivos, creación de rama, copia segura de código, commits, PR, CI y verificación. **No usar Work para estos pasos**, ni pedir al propietario que copie archivos manualmente si la conexión GitHub permite hacerlo.

La instalación y comparación visual en la **PC física del propietario** no se puede dar por realizada desde GitHub. Solo para ese tramo, si realmente no existe una alternativa segura desde este chat, explicar el impedimento y **pedir autorización antes de involucrar Work o gastar créditos**. Separar la entrega GitHub del ensayo local, sin inventar resultados.

## Antes de tocar archivos
- [ ] Confirmar repo destino `ManuelAcostaGuerrero/sagva-gestion-laboral` y rama `main`.
- [ ] Registrar SHA exacto y versión actual del origen `ManuelAcostaGuerrero/asistencia-huella-digital`.
- [ ] Revisar árboles, scripts y referencias a rutas; comprender preparador e instalador Windows.
- [ ] Asegurarse de que se puede construir una copia de **código sin historia Git de origen** y sin `data/`, `server/.env`, `client/.env`, `.local/`, backups ni adjuntos.
- [ ] Comprobar `.gitignore` y escanear posibles secretos/datos embebidos **antes** de publicar.

## Orden de trabajo
1. En rama `int/001-huella-base` incorporar **todos los archivos funcionales** de Huella, manteniendo estructura/UI y configuración pública. No copiar `.git`. Preservar documentación y reglas de este repositorio; resolver conflictos de README/manuales sin borrarlos.
2. No hacer refactor, renombrado masivo, división de módulos, cambio de framework ni cambio de BD en este PR. Solo ajustes imprescindibles para que una copia aislada arranque, documentados.
3. Instalar dependencias en el entorno de prueba, revisar comandos efectivos del origen y usar exclusivamente datos **ficticios**.
4. Comparar la UI/flujo original con nuevo: ficha completa y pestañas, planificador, QR/PIN, empresas/áreas/cargos, documentos, licencias, ficha médica restringida, reportes y auditoría.
5. Registrar problemas en matriz `03` y pruebas `06`. Añadir CI aplicable sin datos reales; no exigir migración PG en este hito.
6. Preparar PR con evidencias, revisar seguridad y solicitar aprobación. Solo tras aprobación y pruebas, fusionar a `main`.

## Entregables y evidencia
- SHA original y SHA del nuevo PR.
- Comparación de árbol/código para certificar qué se copió y qué se excluyó.
- Procedimiento probado para instalar y ejecutar en carpeta limpia.
- Capturas con **solo datos sintéticos**, comparación UI y resultado de casos mínimos.
- Configuración de privacidad comprobada.
- Registro `docs/12-REGISTRO-DE-HITOS.md` actualizado con hechos, no estimaciones.

## Criterio de cierre
**INT-001 se aprueba solo si Huella arrancó y se probaron las funciones esenciales sin pérdida de interfaz.** Copiar archivos o tener CI verde, sin evidencia funcional, NO basta.

## Prohibiciones inmediatas
No importar bases reales a Git, no tocar Huella original, no ejecutar scripts sobre su carpeta, no añadir Propinas, no convertir a PostgreSQL ni traer los 40 modelos del legado aún. No confundir el archivo `data/asistencia.db` local con el que existiría en GitHub: normalmente está ignorado.

## Instrucción breve reutilizable para un ejecutor autorizado
«Lee AGENTS.md y docs/00, 02, 03, 05, 06 y 11. Ejecuta solamente INT-001: inspecciona Huella original y copia íntegramente su código sin datos privados al repo nuevo, preservando comportamiento/UI; usa rama/PR, datos sintéticos y pruebas verificadas; documenta SHA, evidencias, exclusiones y rollback. No toques fuentes ni producción ni intentes la migración PostgreSQL todavía».
