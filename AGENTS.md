# Instrucciones obligatorias para asistentes, agentes y colaboradores

Leer primero `README.md` y `docs/00-INDICE-Y-ESTADO.md`. Este archivo rige cualquier trabajo técnico sobre SAGVA Gestión Laboral, incluso si la solicitud de cambio parece menor.

## Mandato del proyecto
- Proyecto principal: **gestión de personal y asistencia**. Propinas es un módulo adicional. Reparto/Delivery y Sagva-System quedan fuera.
- Conservar íntegros los repositorios originales y sus datos. Trabajar en este repositorio, nunca modificar los originales por arrastre.
- **Huella es la referencia funcional y visual de Personal/Asistencia; Propinas es la referencia funcional/visual y matemática de Propinas.** El legado Integral solo aporta componentes técnicos que superen evaluación posterior.
- No inventar funciones implementadas, pruebas aprobadas, identificaciones de personas, backups, instalación local, fechas ni cifras productivas.
- Cambios de navegación permitidos solo tras autorización expresa; no rediseñar las pantallas originales ni sustituirlas por prototipos.
- Una sola ficha autorizada de trabajador bajo Personal; datos de eventos y semanas por módulo, referenciados, sin fichas personales duplicadas.
- Distinguir empleados reales de **figuras operativas** de Propinas (Copero Mañana, Copero Tarde, Refuerzo); estas no son personas ni requieren fichas ficticias.
- La asignación de área/cargo en Personal alimenta la clasificación de propinas por reglas aprobadas, con vigencias; jamás asignar porcentajes/grupos no confirmados.

## Prohibiciones
1. No subir a Git bases reales `*.db`, `*.sqlite*`, WAL/SHM, backups, RUT, listas de empleados, documentos médicos/laborales, claves ni exportaciones privadas. Tampoco a PR, issues, capturas, logs o archivos de pruebas.
2. No unir personas por nombre, parecido, cargo o ID legado aislado. Las equivalencias se aprueban **una por una** por el propietario en archivo **privado fuera del repo**.
3. No recalcular semanas cerradas, inventar participación, transformar montos, borrar historial ni reasignar una figura a un empleado.
4. No ejecutar escrituras/migraciones en fuentes productivas; no borrar/reemplazar datos sin copia consistente, ensayo de restauración y autorización.
5. No afirmar «terminado», «funciona», «v3.0.0 local» u otro estado sin evidencia de la versión/entorno y pruebas correspondientes.
6. No contratar hosting, modificar DNS, desplegar a producción, cambiar permisos públicos/privados ni fusionar cambios riesgosos sin autorización.
7. No usar recursos de Work o servicios de pago si puede hacerse de forma segura y verificable con GitHub/CI gratuitos; no prometer costo cero universal.

## Política de trabajo y presupuesto: GitHub aquí, Work solo si es imprescindible

**Decisión expresa del propietario (01-11-2026), de máxima prioridad para este proyecto:**
- **Todo lo que se pueda realizar en GitHub se ejecuta directamente desde este chat usando la conexión GitHub disponible:** leer código, copiar archivos entre repositorios, documentar, crear ramas, commits, PR, revisar pruebas/Actions, resolver problemas, verificar resultados y fusionar los cambios autorizados. No trasladar estas labores a Work ni pedir al usuario que las repita manualmente.
- **Work NO se utiliza por defecto ni por comodidad.** Reservarlo exclusivamente para una acción que de verdad requiera controlar la PC, una aplicación local o un proceso gráfico que las herramientas de este chat no permitan completar.
- Antes de consumir créditos de Work, **explicar exactamente qué paso no puede hacerse desde aquí, por qué es imprescindible, cuál será la acción mínima y solicitar autorización expresa**. No hacer traspasos automáticos ni gastar créditos para probar suerte.
- Si una operación local no está disponible, continuar con todo el trabajo GitHub que sí se pueda verificar; entregar instrucciones locales breves solo para el tramo imprescindible. **No afirmar que se ejecutó trabajo sobre la PC**.
- Priorizar GitHub y CI con costos verificables, trabajo en este chat, cambios pequeños y validaciones reales. No consumir recursos adicionales para compensar problemas de planificación.
- Proteger el esfuerzo del propietario: **no reconstruir funcionalidades que ya existen ni repetir el fracaso de la integración anterior**. Cada fase debe acreditar paridad funcional/visual y la procedencia del código utilizado.

## Reglas específicas del archivo `Actualizar.bat` (no ejecutarlo en INT-001)

**El propietario habla específicamente del archivo `Actualizar.bat` que se ejecuta manualmente desde Windows, como en sus otros proyectos. No se refiere a actualizaciones automáticas, avisos en segundo plano ni a crear otra herramienta distinta.** Cuando se habilite ese `.bat` en SAGVA Gestión Laboral, deberá dirigir esta **secuencia obligatoria**:
1. **Evaluar si está actualizado**: leer versión y commit instalados, consultar versión/commit aprobado en el repositorio, verificar compatibilidad, origen y rama. Si está actualizado, informar **«Ya está actualizado»** y no detener procesos, reinstalar ni abrir pestañas.
2. **Detener el proceso solo si está activo**: reconocer y detener exclusivamente procesos de este proyecto por identidad/ruta/PID verificados. Jamás cerrar procesos ajenos, el navegador ni otras aplicaciones; registrar si estaba encendido.
3. **Actualizar de forma segura**: backup consistente y restaurable de datos/configuración, prevalidación, avance Git sin forzar ni descartar cambios, dependencias, migraciones y pruebas según corresponda. Si falla, no declarar éxito ni perder datos; proporcionar pasos de recuperación. Reiniciar el servicio solo si estaba activo antes de la actualización (o conforme a una orden expresa).
4. **Conservar la pestaña existente del sistema**: si el usuario tiene SAGVA abierto en el navegador, **actualizar o recargar ESA MISMA pestaña**, conservando URL y sesión cuando sea seguro, sin abrir otra. Si no hay pestaña, recién entonces ofrecer abrir una. Un script BAT/PowerShell por sí solo no puede identificar y activar de forma fiable una pestaña arbitraria: diseñar y probar un mecanismo cooperativo de la aplicación/navegador (detección de versión y aviso de recarga en pestaña existente, o equivalente) antes de prometer esta funcionalidad. Nunca ejecutar un `Start-Process` del navegador sin antes resolver esa condición.

**Esta regla describe el comportamiento requerido del `Actualizar.bat` manual, no una función ya implementada**. Durante INT-001 **no se utilizará ese `.bat`**, no se añadirá automatización de actualizaciones y no se gastarán créditos Work en ello. Para las pruebas actuales se usa una instalación aislada y control manual.

## Regla de criterio independiente y control de fases

**Obligatoria para toda respuesta y ejecución de este proyecto.** No aceptar ni elogiar automáticamente una idea del propietario. Actuar como revisor técnico que busca el mejor resultado, incluso cuando eso implique decir **«no», «todavía no» o «estás confundiendo las etapas»**. Mantener un tono respetuoso y explicar el fundamento con hechos, sin discutir por discutir.

1. Antes de afirmar cuál es el siguiente paso o iniciar trabajo, **consultar el estado real** de cada hito en el repositorio, las pruebas y las evidencias de aceptación disponibles. Distinguir claramente **propuesto**, **codificado**, **CI aprobado**, **probado localmente**, **validado por el propietario**, **fusionado en main** y **terminado**.
2. **No saltar una etapa obligatoria** porque el usuario mencione la siguiente. Si pide INT-003 sin haber cerrado los requisitos de INT-001/INT-002, advertir explícitamente el bloqueo, indicar qué falta y recomendar la acción correcta. Un comentario, una pregunta o un recuerdo del usuario **no equivale a autorizar una integración**.
3. Si una propuesta es incorrecta, prematura, contradictoria, riesgosa o ineficiente, **corregirla de manera clara, concisa y razonada** y recomendar la alternativa viable. No inventar desacuerdos: validar lo correcto y objetar solo lo que tenga sustento.
4. Antes de cambiar el estado de un hito, exigir evidencias verificables y la aceptación definida en `docs/06-PRUEBAS-Y-ACEPTACION.md`; **CI verde, pantalla que abre o satisfacción verbal no equivalen por sí solos a paridad funcional acreditada**.
5. No confundir **preparar** una fase con **ejecutarla**. Pueden documentarse futuros pasos sin extraer, copiar o importar datos reales ni modificar fases anteriores.
6. Ante un error de juicio del asistente, **reconocerlo y corregir documentación/plan** sin culpar al usuario ni ocultar la contradicción.

**Aplicación al caso 02-11-2026:** INT-001 tiene código copiado y CI verde pero todavía no está formalmente aceptada la paridad; INT-002 (ensayo privado y paridad funcional completa de Huella) **no está completado**; por ello INT-003 (conciliación de identidad con Propinas) **no puede declararse iniciado ni ejecutarse como integración** hasta acreditar las etapas previas.

## Procedimiento mínimo por tarea
1. Consultar fase/estado en `docs/00-INDICE-Y-ESTADO.md` y criterios en `docs/06-PRUEBAS-Y-ACEPTACION.md`.
2. Verificar archivos/commit de origen **en la ejecución actual**, no suponer información de un historial de chat.
3. Proponer cambio concreto y su impacto sobre la interfaz, datos, permisos, privacidad, cálculos y rollback.
4. Implementar incremento pequeño; preservar UX original; incluir pruebas reproducibles y datos sintéticos.
5. Ejecutar verificaciones pertinentes; anotar comandos, SHA, sistema operativo, resultado real y limitaciones.
6. Documentar avance real en registro de hitos y PR. No actualizar estados por simple creación de archivos.
7. Pedir aprobación del propietario para correspondencias de trabajadores, cambios visuales, reglas económicas y paso a siguiente fase.

**Versiones**: `INT-001`... durante integración. Luego `v1.0.0` con X funcionalidades, Y visual y Z corrección. Ver `docs/07-VERSIONADO-Y-CAMBIOS.md`.

Si una operación necesita acceso al PC o bases privadas que no está disponible, indicar exactamente ese bloqueo y continuar únicamente con trabajo seguro verificable. Nunca suponer acceso local por tener acceso a GitHub.
