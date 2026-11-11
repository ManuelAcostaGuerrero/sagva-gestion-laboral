# Requisitos consolidados de pruebas físicas · 10 de noviembre de 2026

> **Estado al 11-11-2026:** implementación de los ajustes actuales integrada a `main` mediante [PR #15](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/15), commit `dbfb805b0572ff459588ce8538ca502e9408b2eb`. Pruebas de servidor y compilación web aprobadas en CI del PR; pruebas físicas Windows/móvil, restauración y revisión legal pendientes.
>
> **Repositorio:** `ManuelAcostaGuerrero/sagva-gestion-laboral` · Rama de referencia: `main` · Seguimiento: https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/issues/14

## Registro de avance tras el PR #15

**Codificado y aprobado por CI:** catálogo de varios bonos con casilla de imponibilidad y condición de horas extras separada, cláusulas, evaluaciones auditables de simulación; pago mixto; autorización bancaria de tercero en PDF cifrado; referencia de renta familiar acreditada y visualización del total legal por carga sin edición; catálogo de funciones escritas por área/cargo y autocompletado; turno semanal editable con deshacer/restablecer; formato CLP y pantalla más compacta y ancha.

**Límites explícitos:** las simulaciones de bonos **no pagan ni descuentan** remuneraciones; se requiere revisión laboral de condiciones, imponibilidad y cálculo de horas extras. La renta semestral de referencia debe acreditarse para determinar tramo; no se infiere del sueldo base. La generación de contratos/PDF y el flujo futuro de postulantes quedan para otra fase, conforme a lo acordado. Centro de costo y unidad jerárquica siguen siendo códigos organizacionales distintos de empresa/sucursal y deben catalogarse antes de poder autocompletarlos.

**Pendiente de aceptación:** pruebas reales en Windows y móvil, test de respaldo/restauración de base local con migraciones, revisión jurídica de contratos/bonos y aceptación del propietario. Integrar código a main no instala ni despliega automáticamente la aplicación.

## Objetivo
Registrar hallazgos de pruebas físicas de la ficha laboral y contabilidad laboral (10-11-2026). **Prioridad alta: bonos**. Este issue es de especificación y ejecución pendiente: no implica que los cambios estén implementados.

## P0 · Bonos múltiples, imponibilidad, cláusulas y evaluación
- [ ] Crear o ajustar el **catálogo de conceptos de pago** administrable desde Contabilidad Laboral, vinculado a la ficha y contratos. Permitir **varios bonos por trabajador** (caja, producción, otros) y conceptos como viáticos con su clasificación jurídica propia.
- [ ] Cada concepto: código/nombre, descripción, monto o fórmula, modalidad fija/variable, periodicidad, vigencia, estado, y condiciones/cláusulas editables y versionadas.
- [ ] Incluir checkbox **«Imponible»** por concepto (marcado/desmarcado), pero **no decidir la clasificación legal solo por el nombre**. Viáticos y otros conceptos requieren validación normativa antes de marcarse no imponibles.
- [ ] Configurar **por separado** si integra la base de cálculo de horas extraordinarias u otras bases remuneracionales, según validación legal. Imponibilidad no equivale automáticamente a inclusión en horas extras.
- [ ] La descripción contractual de condiciones queda en texto; la evaluación/cálculo va en módulo estructurado, **no en un textarea**: indicadores, periodo, resultados, monto potencial, monto devengado, evidencias, justificación, aprobador e historial.
- [ ] Ejemplo bono caja: definir criterios verificables (cierres correctos, registro de débitos, cumplimiento de procedimientos) y evaluación de resultados por período. No hacer «descuentos» automáticos ilegales de remuneraciones: determinar primero si la regla configura devengo variable válido y revisado legalmente.
- [ ] Permitir asociar varios conceptos a un mismo trabajador; guardar trazabilidad, versión de reglas, permisos y efecto en documentos emitidos. No modificar contratos históricos cuando cambie el catálogo.
- [ ] Agregar checklist «con cláusula» para indicar qué conceptos requieren referencia expresa en contrato/anexo; usar el texto aprobado, no la fórmula del motor de evaluación.

## P1 · Ficha y pagos
- [ ] Sueldo mostrado en CLP con separador de miles automático (p. ej., `650.000`), conservando valor numérico íntegro, sin puntos en almacenamiento/cálculos.
- [ ] Medio de pago en control compacto y claro: efectivo, transferencia; admitir modalidad mixta solo si la operación lo requiere y se detalla la distribución, sin casillas contradictorias.
- [ ] Si cuenta receptora pertenece a tercero, mostrar «Titular diferente del trabajador» y botón compacto «Cargar autorización», con archivo asociado y permisos restringidos. **Por ahora solo carga de autorización**; redacción/generación del documento queda para una fase posterior.
- [ ] Datos bancarios solo visibles/editables por roles autorizados, con auditoría.
- [ ] Asignación familiar: cantidad de cargas reconocidas, tramo legal vigente según renta que corresponda, valor unitario y total **calculados automáticamente y no editables en la ficha**; guardar tabla oficial con fechas de vigencia y fuente, administrada por rol autorizado, y evitar valores estimados o fijos sin vigencia. Verificar requisitos y base legal antes de aplicar.
- [ ] Prestación/entidad IPS u otro campo similar: lista de opciones oficiales predefinidas, con administración de catálogo y validación; evitar texto libre indiscriminado.
- [ ] Formato de texto coherente para contratos: nombres propios en formato de nombre, códigos/siglas en mayúsculas, direcciones según corresponda; normalización en captura sin alterar correos, RUT, números de cuenta ni otros identificadores.

## P1 · Distribución contractual de jornada
- [ ] En la ficha, componente compacto con botón «Incorporar turnos actuales» para cargar plantillas de turnos ya configuradas.
- [ ] Mostrar lunes a domingo en filas/grupos, con los turnos/horarios disponibles por día y selección por trabajador.
- [ ] Permitir desactivar un día completo y excluir sus turnos; también quitar solo horarios puntuales manteniendo el día activo.
- [ ] Controles pequeños «Deshacer» última acción y «Restablecer» la selección desde las plantillas, con confirmación si sobrescribe cambios.
- [ ] Guardar la asignación contractual por trabajador sin modificar las plantillas globales; validar solapamientos, total de horas y reglas de jornada vigentes.

## P1 · Funciones del cargo, estructura, estado
- [ ] Contabilidad Laboral: catálogo de **funciones de cargo en texto editable**, transcrito de documentos fuente aportados después, asociado a **área + cargo** (p. ej., cocina, garzón), con control de edición, vigencia y versiones.
- [ ] Al seleccionar área/cargo en la ficha, autocompletar el texto preaprobado; permitir excepciones del trabajador sin modificar el catálogo maestro. **No adjuntar el PDF como contenido principal del campo**.
- [ ] Al cambiar estado laboral a inactivo, mostrar motivo/observación y fecha de término; con estado activo ocultar estos campos, sin ocultar empresa, local, centro de costo o unidad jerárquica.
- [ ] Razón social/local/centro de costo/unidad jerárquica deben vincularse a los catálogos/estructura ya presentes y completarse cuando sea posible, sin duplicar captura. Revisar nombres exactos en la UI antes de eliminar campos.

## P2 · Flujo futuro de contratación y contrato
- [ ] Link/token de postulante para completar datos personales; revisión y aprobación por rol autorizado antes de crear ficha definitiva.
- [ ] Generación posterior de contrato imprimible desde plantilla aprobada con ficha, sueldo, modalidad de pago, gratificación, régimen/artículo aplicable, bonos/cláusulas, funciones del cargo y distribución contractual vigente; conservar versión de lo firmado.
- [ ] Campo «Condiciones adicionales para revisión jurídica» solo para observaciones o cláusulas especiales, **no** para registrar montos y evaluar bonos.

## P1 · Interfaz adaptable
- [ ] Reducir tamaño visual excesivo de botones, campos y separaciones en desktop, manteniendo accesibilidad táctil en móvil.
- [ ] Usar ancho adaptable/breakpoints para aprovechar espacio lateral en pantallas grandes, sin columnas de ancho rígido ni pérdida de legibilidad.
- [ ] Probar Windows, pantallas de escritorio de distintos tamaños y teléfonos físicos.

## Criterios de cierre
- [ ] Pruebas con datos reales de prueba autorizados, sin alterar registros productivos ni inventar datos de trabajadores.
- [ ] Auditoría y permisos por rol, particularmente cambios de bonos, reglas, banco, autorización y catálogos.
- [ ] Persistencia tras actualización/reinicio, migraciones seguras y respaldo antes de cambios.
- [ ] Revisión jurídica antes de activar cálculos de remuneraciones y deducciones en producción.
- [ ] Documentación de prueba y pasos de actualización manual; **sin actualizaciones automáticas**.

**Alcance de la especificación original:** requisitos de usuario; ver el registro de avance y límites anterior para distinguir código integrado de validación local pendiente.

## Orden de ejecución propuesto

1. Diseñar modelo de datos y formularios de bonos, incluyendo bandera imponible y evaluación separada; definir revisión legal.
2. Ajustar formulario de pagos, asignación familiar y catálogos; evitar duplicación de campos organizacionales.
3. Vincular jornadas y turnos de plantillas al trabajador con deshacer/restablecer.
4. Incorporar catálogo editable de funciones por área/cargo.
5. Compactar interfaz, ajustar responsividad y hacer pruebas de regresión.
6. En etapa futura implementar generación de contratos desde ficha validada y plantillas.

## Notas de producto

- Una autorización bancaria de tercero se **adjunta** en esta entrega: su plantilla se redactará más adelante.
- La tabla de asignación familiar **no se inventa**; se integra desde un origen oficial vigente con historial y reglas verificadas.
- El campo de condiciones jurídicas es descriptivo. El **cálculo de bonos** exige datos estructurados y un módulo de evaluación, no texto libre.
- No se presume que todos los pagos denominados «bonos» tengan el mismo tratamiento remuneracional ni previsional.
