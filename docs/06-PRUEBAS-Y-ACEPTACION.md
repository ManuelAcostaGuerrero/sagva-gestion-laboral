# 06. Calidad, pruebas, evidencia y aprobación

## Puertas comunes
Un hito o PR no se aprueba hasta contar con:
- Revisión de archivos y control de privacidad. No valores reales en source, fixtures o logs.
- Dependencias instaladas en entorno limpio; comandos reproducibles y salida registrada.
- Pruebas automatizadas aplicables **aprobadas realmente** en el commit propuesto.
- Comparación de comportamiento/UX con origen para funciones afectadas.
- Prueba negativa (fallo controlado) de funciones sensibles.
- Plan de reversión y restore si hay cambio persistente.
- Aprobación del propietario cuando afectan identidades, reglas de Propinas, interfaz, productivo o avance de fase.

## Matriz mínima
| Grupo | Prueba exigida | Momento |
|---|---|---|
| Huella | Crear/editar persona, ficha, contrato y validación | INT-001/002 |
| Huella | Adjuntar/ver PDF, vencimiento, licencia y ficha médica con acceso restringido | INT-002 |
| Huella | QR/PIN en terminal, móvil real, revocación y auditoría | INT-002 |
| Huella | Turnos sin superposición indebida, planificador, repetir/copia/guardar | INT-002 |
| Datos | Conteos, claves foráneas, tabla de IDs, duplicados, PDF SHA-256 | INT-003/004 |
| Migración | Dos importaciones sin duplicados; rollback; fuente intacta | INT-004 |
| Propinas | Días Completa/Media/Nada, 70/30 y 70/35/30, saldos, cierres | INT-005 |
| Propinas | Diferencia de cálculo exacta de **0 CLP** para entradas idénticas | INT-005 |
| Propinas | Semanas cerradas, figuras y años anteriores conservados | INT-005 |
| Seguridad | Empresa A no ve datos de empresa B; Propinas no ve ficha médica | INT-004/005/006 |
| Plataforma | Windows + Linux CI; PostgreSQL; navegador y celular físico | Según fase, cierre INT-006 |
| Recuperación | Restauración externa independiente y corte reversible | Antes de producción |

## Evidencia mínima por prueba
`fecha; commit exacto; fuente y commit de origen; OS; versión Node/DB; comando o pasos; resultado esperado; resultado observado; tipo de datos (sintéticos o copia privada); incidencias; quién validó`.

En GitHub solo publicar evidencia anonimizada/sintética. Las cantidades reales, nombres, documentos y hashes sensibles permanecen en informe privado. Una captura sin datos no basta para verificar el motor de reparto; una prueba sintética aprobada no demuestra por sí misma paridad con históricos.

## CI / costos
Configurar en INT-001 los controles pertinentes y usar GitHub Actions en ejecutores estándar **gratuitos para repositorios públicos según condiciones vigentes del servicio**. No confundir eso con costo ilimitado de paquetes, almacenamientos, herramientas externas o Work. Verificar cuota y reglas de GitHub actuales antes de activarlos.

El proyecto anterior aprobó ciertas pruebas de código pero no acreditó la experiencia original. Aquí se exige **ambas cosas**.

## Estado actual
**Actualización 02-11-2026 (histórica):** ya existía código en la rama `int001-huella-codigo` y GitHub Actions acreditó pruebas del servidor y compilación del frontend en `652a1783`.

**Actualización 03-11-2026:** el propietario solicitó integrar PR #1 y este se fusionó en `main` como `a23de9b4164b975d2589091782c7a5d4a538f0f5`. El commit PR `fccf017d3` tenía dos CI verdes. Esto **no certifica** experiencia visual, funcionamiento en PC ni paridad con los originales. INT-001 aún exige cierre funcional y aceptación; INT-002 sigue sin acreditarse y bloquea INT-003. El merge **no autoriza** despliegue de producción, cambio de base privada ni ejecutar `Actualizar.bat` de Gestión Laboral.

## Estado añadido — 09-11-2026

El propietario confirmó en conversación las pruebas de Windows, funcionalidad de fichas/contratos/parámetros y conectividad móvil HTTPS, y **aprobó la fase funcional reciente (Fase 3)**. CI del último commit funcional `281b9182d186`: servidor/compilación y validación QR móvil correctas; los resultados de esas suites no demuestran uso real de cámara ni paridad completa.

**La aprobación comunicada no anula las puertas originales `INT-001/INT-002`**: siguen pendientes una matriz comparativa completa con Huella original, ensayo privado de restauración aislada e inspección verificable de integridad/accesos. Se mantiene la restricción de no publicar evidencia sensible en Git.

[Registro detallado, alcance aprobado, límites y siguientes pasos](24-CIERRE-FUNCIONAL-F3-Y-HOJA-RUTA-20261109.md).
