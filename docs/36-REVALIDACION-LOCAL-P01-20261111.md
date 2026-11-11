# Revalidación de instalación existente P0/P1 — 11-11-2026

## Resultado

Instalación Windows real accesible en la carpeta habitual de SAGVA Gestión Laboral. Se ejecutó **Estado.bat**. Rama main limpia, sin modificaciones locales; HEAD, origin/main, manifiesto de instalación y versión web coinciden en **17820c6d12f782b678c7fffeb2b929a1c5332484**. Las correcciones PR #17 (68303e0) están incluidas. Procesos propios iniciados, web 5183 y API 4010. Recuperación pendiente: no. Se verificaron los hashes de todos los archivos del manifiesto instalado.

No fue necesaria actualización: no se ejecutó Actualizar.bat, no se detuvo el servicio y no se ejecutaron importadores ni migraciones manuales.

## Controles nuevos en esta ejecución

- Diagnóstico oficial P0, solo lectura: integridad ok, FK 0, todos sus indicadores de discrepancia en 0.
- Totales agregados: 2 trabajadores activos, 2 fichas, 1 empresa, 1 cargo, 2 condiciones contractuales, 3 marcaciones, 0 aprobaciones salariales y 0 PDF contractuales.
- Inventario privado del esquema real: 70 tablas y 32 migraciones; columnas, índices, relaciones y conteos por tabla guardados en .local/p0-inventario-esquema-20261111.json, sin valores personales.
- Pruebas afectadas, ejecutadas nuevamente con SQLite en memoria y registros sintéticos: data-model-diagnostic, data-integrity-stage1, contract-files-permissions-p1 y entrega2-contracts: **6 pruebas, 6 aprobadas, 0 fallos**.
- Navegador Chromium real contra instalación existente: commit visible, panel Root operativo, ficha, formulario bancario y sección Documentos laborales visibles. API real de capacidad bancaria habilitada para Root y cifrado/descifrado sintético correcto. No se guardaron cambios en trabajadores, cuentas, permisos o contratos; las lecturas sensibles generan su auditoría normal.

## Evidencia anterior aplicable, no repetida ni presentada como nueva

El mismo SHA fue instalado y probado en la recuperación autorizada documentada en [informe 35](35-RECUPERACION-VALIDACION-P01-20261111.md), publicado en la rama de evidencias. Incluye 94 pruebas, build, auditoría 0, respaldo consistente, restauración aislada y preservación de 57 tablas de negocio frente al respaldo inicial; configuración privada preservada. No se realizó un respaldo independiente nuevo ni se detuvo el sistema para esta revalidación.

## Puertas todavía pendientes

Los indicadores del script P0 no cubren toda la planificación de Issue #16: no equivalen a conciliación nominal privada, revisión legal de jornada/sueldo por fecha, diccionario completo de autoridad de cada campo o aislamiento integral por empresa/local. No se declara cerrado todo P1.

No existen PDF contractuales locales que permitan probar apertura de un documento existente; la autorización/denegación de PDF se probó con documentos sintéticos. Móvil/cámara física, recuperación externa y aceptación del propietario siguen pendientes.

No se fusionaron PR #19/#20, no se instalaron P2/P3, no se ejecutó backfill, normalización ni Propinas. La Issue #16 debe mantenerse abierta para los remanentes. Ningún resultado de esta revisión autoriza pasar automáticamente a etapas 2 y 3.

## Privacidad

Diagnóstico e inventario técnico se ejecutaron con SQLite readOnly y query_only. Los logs, esquema real y respaldos quedan privados. No se publican datos personales, documentos, claves ni hashes de secretos.
