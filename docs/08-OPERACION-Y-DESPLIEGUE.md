# 08. Operación local, migraciones y producción

**Documento de diseño de operación; no hay instalación del nuevo sistema validada.** Primero clonar código, luego pruebas con datos sintéticos, luego respaldo privado/restauración. No adelantar PostgreSQL como requisito para comprobar la interfaz inicial de Huella.

## Entornos
| Entorno | Base | Datos | Red | Estado |
|---|---|---|---|---|
| Original Huella | SQLite | Reales privados en PC de origen | Según instalación existente | No tocar |
| Original Propinas | SQLite | Reales privados en PC de origen | Según instalación existente | No tocar |
| Nuevo laboratorio INT-001/002 | SQLite | Ficticios / copia privada aislada autorizada | Local | Pendiente |
| Nuevo laboratorio INT-004/005 | PostgreSQL | Sintéticos y copias privadas aisladas autorizadas | Local | Pendiente |
| Producción futura | PostgreSQL | Reales tras corte autorizado | HTTPS protegido | **Bloqueada por condiciones previas** |

## Hitos operativos
1. Clonar `sagva-gestion-laboral` en carpeta nueva, sin reutilizar ruta de Huella original.
2. Registrar commit del original y copia exacta de archivos de código. Excluir `.git`, `.env`, `data/` y respaldos del original.
3. Reinspeccionar `OPERACION_LOCAL.md` de Huella; los nombres de scripts originales son `Preparar.bat`, `Iniciar.bat`, `Detener.bat`, `Respaldar.bat`, `Actualizar.bat` y `Estado.bat`. Solo usar en directorio aislado y tras revisión de sus rutas/acciones.
4. Preparar datos sintéticos; iniciar puertos sin colisionar con aplicaciones activas; verificar URL/versión reales en consola.
5. Para ensayo con datos reales, antes obtener copia privada consistente y restaurar fuera del árbol Git. **Nunca** ejecutar `Preparar` o migraciones sobre el archivo original de Huella.
6. En INT-004 crear migraciones PostgreSQL repetibles y prueba de segunda ejecución, rollback/restauración y rendimiento.
7. Para corte definitivo: auditar seguridad, permisos, respaldo externo probado, paridad, aprobación y plan con escrituras congeladas. No operar dos maestros simultáneos.

## Criterios para seleccionar servidor en el futuro
No contratar de inmediato. Se evaluará VPS cuando el sistema esté validado localmente. Requisitos: PostgreSQL estable, backups cifrados y recuperación probada, acceso HTTPS, logs protegidos, monitoreo, actualización repetible y control de costos. No confundir dominio con hosting.

## Instrucción de recuperación
Ante regresión: detener **sistema nuevo**, conservar evidencia y datos del ensayo, restaurar entorno anterior probado, comprobar integridad y reportar. No ejecutar borrados automáticos ni sobrescribir original para «arreglar» actualización.

Los procedimientos exactos con comandos dependerán del código y versión que se copie y se escribirán/revalidarán en INT-001; comandos inventados antes de inspección serían un riesgo innecesario.
