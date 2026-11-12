> **Informe histórico recuperado de `evidencia/recuperacion-p01-20261111` el 12-11-2026.** La versión y el estado descritos corresponden al día de la prueba, no al `main` actual. No se copian imágenes de la PC, respaldos, datos personales ni logs. Estado vigente: `docs/40-CONSOLIDACION-RAMAS-Y-PENDIENTES-20261112.md`.

# Recuperación y validación local P0/P1 — 11-11-2026

**Resultado: recuperación completada; sistema local iniciado.** Complementa y resuelve el bloqueo operativo registrado en el documento 34. No acredita producción, DT ni paridad INT completa.

## Versión y autorización

- Windows local del propietario, SAGVA Gestión Laboral exclusivamente.
- Autorización explícita del propietario para incorporar la corrección y completar recuperación/arranque.
- Código instalado y probado: **17820c6d12f782b678c7fffeb2b929a1c5332484**, integrado en main mediante avance sin forzar.
- El fallo original y su respaldo se conservaron. Se verificó nuevamente restauración aislada, integridad y preservación antes de registrar la revisión de recuperación y permitir el reintento. No se borró la marca sin revisión ni se restauró sobre la base existente.

## Comprobaciones ejecutadas

| Control | Resultado |
|---|---|
| Actualizar.bat habitual | Completado; estado correcto y RecoveryRequired=false |
| Preparación aislada npm ci, sintaxis 196 archivos | Aprobado |
| Pruebas servidor en este SHA | 94 aprobadas, 0 fallidas |
| Compilación web | Aprobada |
| Auditoría de dependencias | 0 vulnerabilidades |
| Procesos / controlador / Git | 13 controles, 24 aserciones y ensayo Git real aprobados |
| Regresión SHA256 sin Get-FileHash | Vector conocido, manifiesto y alteración detectada: aprobados |
| SQLite y restauración aislada del respaldo | Integridad ok, FK 0 y contenidos restaurados idénticos |
| Datos existentes frente al respaldo inicial | 57 tablas de negocio conservadas, sin diferencias en columnas originales; auditoría de lecturas y registro de migraciones excluidos de igualdad |
| Configuración privada | server/.env y client/.env idénticos al respaldo inicial; Root y clave bancaria conservados |
| Diagnóstico P0 final, lectura solamente | Integridad ok, FK 0; todos los indicadores de discrepancia en 0 |
| Inicio habitual tras actualización | Sistema disponible en http://localhost:5183 |
| API real bancaria con Root | Lectura y escritura habilitadas; cifrado/descifrado sintético correcto sin guardar cuentas |
| Navegador Chromium real contra instalación local | SHA, panel Root, ficha, formulario bancario y sección Documentos laborales visibles; sin guardar cambios |
| Navegador aislado, API Express y SQLite sintética | Aviso de versión, borrador conservado, cancelación y recarga explícita de una sola pestaña: aprobados |
| Segunda ejecución de Actualizar.bat | «Ya está actualizado», mismos PID; sin reinicio ni pestañas nuevas |

El actualizador respetó que el servicio estaba detenido al comenzar el reintento. Se ejecutó después el controlador Iniciar de forma expresa para completar la recuperación autorizada. Otros proyectos permanecieron fuera del ámbito.

Las pruebas sintéticas P1 ejecutadas en la preparación incluyen edición parcial de empresa, baja/reactivación atómica, finiquito bloqueado, auditoría, protección de sueldo aprobado y acceso/concesión/denegación de PDF contractual con Root. Los cambios de empleados, sueldos, empresas y permisos de esas pruebas ocurrieron únicamente en SQLite sintética, nunca sobre los trabajadores existentes.

La captura original queda preservada en la rama de evidencias. Se omite aquí para evitar trasladar material de la instalación privada.

## Pendientes reales

- No hay PDF contractuales guardados en esta instalación: la apertura/descarga de uno existente no puede acreditarse aquí. Control de permisos PDF verificado con documentos sintéticos por las pruebas automatizadas.
- No se probó cámara física, móvil ni certificación DT.
- Recuperación externa en otro equipo, paridad INT completa y autorización productiva siguen pendientes. La restauración comprobada aquí es aislada en la misma PC.
- Permisos por empresa/sucursal completos no se consideran acreditados por estos controles.
- No se ejecutaron P2/P3, Propinas ni correcciones masivas de datos. No se encontraron discrepancias P0 que requieran proponer un lote correctivo.
- Revisión y aceptación final del propietario pendientes.

Logs completos, configuración y respaldos permanecen privados en .local. No se publican nombres, RUT, cuentas, credenciales ni PDFs.
