# Comprobación local P0/P1 — 10-11-2026 (hora Chile)

## Resultado: BLOQUEADO en actualización; no aprobado como instalación operativa

Autorización del propietario: formularios guardados y ejecutar Actualizar.bat. Windows local existente, origin verificado y main limpio. SHA anterior `03688b8d8ca0083f32626a28d33ed56b3ea2ef80`; objetivo activado en Git/build `9bb46222b342f24f8d10c1410a9d30cea65a836f`.

El BAT habitual preparó el código aislado: instalación de dependencias, sintaxis de 196 archivos, **94 pruebas aprobadas**, compilación web, auditoría con **0 vulnerabilidades**, 13 controles de procesos, 24 aserciones del actualizador y prueba Git real. Después creó respaldo consistente y detuvo exclusivamente Gestión Laboral; otros proyectos conservaron sus PID.

Las migraciones e integridad finalizaron, pero SaveInstalledBuild falló porque Windows PowerShell no resolvió Get-FileHash. No se declara completada la actualización. RecoveryRequired continúa en true y los servicios de Gestión Laboral quedaron detenidos por el controlador. No se borró la marca, no se forzó inicio ni se restauró la base sobre la original.

## P0 y preservación: comprobados sin modificar registros

- integrity_check: ok; foreign_key_check: 0.
- 2 trabajadores activos, 2 fichas, 1 empresa, 1 cargo, 2 condiciones contractuales, 3 marcaciones, 0 aprobaciones salariales, 0 PDF contractuales. 32 migraciones registradas.
- Todos los indicadores del diagnóstico P0 en 0: fichas ausentes, estados contradictorios/faltantes, empresa sin vínculo/etiqueta, etiqueta diferente, cargo fuera de catálogo y JSON inválido.
- Copia de restauración aislada creada desde el respaldo: integridad ok, FK 0 y todos sus contenidos iguales al respaldo.
- Comparación de todas las tablas preexistentes y columnas originales con la base posterior (excepto registro de migraciones): datos conservados, sin diferencias. No hubo conciliación ni corrección de personas.
- server/.env y client/.env idénticos byte a byte al respaldo; Root conservado. Clave bancaria conservada sin mostrarla.

## Corrección preparada por separado, no instalada

Se reemplaza la dependencia de Get-FileHash por SHA256 de .NET, con cierre de archivos garantizado. Prueba Windows con Get-FileHash deliberadamente inutilizado: vector SHA256 conocido correcto, manifiesto verificado y alteración detectada. Se repitieron 24 aserciones del actualizador: correctas. Se incorpora esa prueba a la preparación de futuras actualizaciones.

## Pendientes y siguiente paso sujeto a aprobación

Por la regla de detenerse ante error del documento 33, la corrección queda en rama separada. Propuesta concreta: revisar e incorporar esa corrección, acreditar recuperación con el respaldo y comparación ya realizados, completar manifiesto/arranque mediante controlador revisado y repetir comprobaciones de Root/banca/navegador y P1 aisladas. Nunca borrar el bloqueo sin registrar revisión y motivo.

P1 sintético: aprobado en las pruebas de preparación (empresa/estado/auditoría/finiquito, permisos de PDF y protección de salario aprobado). Navegador y APIs de la instalación tras actualizar: PENDIENTES por servicio detenido. No existen PDF contractuales locales que permitan acreditar apertura real de un PDF de esta instalación. Aceptación del propietario y producción: pendientes. P2/P3 y Propinas no ejecutados.

Los logs y respaldos privados permanecen localmente en .local. Este informe no contiene identificadores, claves, datos personales ni archivos privados.
