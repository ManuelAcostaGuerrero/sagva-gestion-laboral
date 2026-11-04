# 03. Inventario funcional y paridad con originales

**Estado:** inventario documental inicial construido con los README de Huella 1.19.2 y Propinas 4.4.0; **no** es auditoría de interfaz actual ni prueba superada. Cada funcionalidad debe verificarse en código, capturas sintéticas y operación en su fase.

## Huella: funciones que NO se pueden perder
| Área | Comprobación mínima | Origen |
|---|---|---|
| Trabajadores | Crear/editar, ficha general, nombre legal completo, RUT opcional, contacto, empresa, cargo/área, estados y validación | Huella |
| Campos administrativos de ficha (D-021, pendiente) | Verificar en SQLite local cuántas fichas tienen Unidad jerárquica, Centro de costo y Sucursal. La Sucursal visible dos veces apunta a `extra.branch` (duplicación visual). Unidad y Centro de costo no son sinónimos de Área/Cargo: preservar valores y fuente importada, ocultar/reagrupar solo después de auditoría. | Diagnóstico de código, 04/11/2026 |
| Cierre seguro tras guardar (D-019, pendiente) | Al guardar correctamente ficha general o completar/validar, cerrar la ficha y regresar a lista sin formulario editable; reabrir solo tras selección expresa. No cerrar en error o con otras secciones sin guardar; confirmar visualmente y conservar borradores. | Solicitud del propietario, 04/11/2026 |
| Búsqueda por RUT (D-018, pendiente) | Encontrar al mismo trabajador con RUT escrito o almacenado con/sin puntos y guion; equivalencia `K/k`. Probar las cuatro combinaciones con datos ficticios, sin cambiar búsqueda por nombre/empresa o filtros. Diferenciar búsqueda de validación módulo 11 y detección de duplicados. | Solicitud del propietario del 03–04/10, reiterada el 04/11/2026 |
| Condiciones laborales | Contrato, anexos, jornada, fechas y cambios históricos | Huella |
| Indefinido sin fecha de término (D-020, pendiente) | El contrato indefinido vigente no muestra ni admite fecha de vencimiento. Fecha real de término solo tras finalizar expresamente la relación, con motivo/auditoría; inactividad no equivale a finiquito. No borrar silenciosamente fechas históricas; conservar fechas y anexos de plazo fijo. | Solicitud del propietario, 04/11/2026 |
| Documentos | Catálogo dinámico, vencimientos, entregas/firmas registradas, PDF, búsqueda e historial | Huella |
| Licencias | Registrar períodos/adjuntos; señalización roja en horarios, bloqueo correcto de asignaciones | Huella |
| Ficha médica | Antecedentes Sí/No y observaciones, accesos restringidos y separación de información | Huella |
| Turnos | Catálogos de turnos/horarios; sin solapamientos; preservar horas reales | Huella |
| Planificador semanal | Vista todas las áreas, orden/columnas y tamaños originales, copiar turno, repetir semana, guardado, no duplicidad | Huella |
| Marcaciones | Terminal QR/PIN, lectura móvil con cámara que se apaga tras escanear, lector/PIN alternativo, información legible | Huella |
| Credenciales | Revocación administrativa de terminal, emisión múltiple QR, PIN y gestión segura de tokens | Huella |
| Administración | Empresas, catálogos de áreas/cargos, usuarios/permisos, auditoría y reportes | Huella |
| Vínculo empresa→trabajador (D-028, pendiente) | Empresa recién creada aparece en selector de ficha sin F5, con vínculo persistente; configuración opcional Área/Cargo/Jornada no afecta disponibilidad. | Inspección de código y captura, 04/11/2026 |
| RUT de ficha médica (D-029, pendiente) | Igual que ficha general, usa normalizador/formato de presentación sin reescribir identidad; pruebas con puntuación mal ubicada. | Inspección de código y captura, 04/11/2026 |
| Fechas en documentos (D-030, pendiente) | Inicio sigue inicialmente a Entrega hasta que usuario cambie manualmente Inicio; se respeta la fecha distinta y no se cambia el vencimiento histórico. | Solicitud del propietario, 04/11/2026 |
| Domicilio de trabajador (D-031, pendiente) | Región/Provincia/Comuna/Ciudad usando catálogo Chile; domicilio particular NO se autocompleta con dirección de empresa ni se pierden históricos. | Solicitud del propietario, 04/11/2026 |
| Empresas: RUT (D-023, pendiente) | RUT empresa y representante se autoformatean sin exigir puntos/guion, y se validan; empresa duplicada por RUT normalizado es rechazada. | Solicitud del propietario, 04/11/2026 |
| Empresas: ubicación Chile (D-024, pendiente) | Región/Provincia/Comuna con catálogos oficiales completos y filtros encadenados, localidad cuando proceda; direcciones antiguas conservadas. | Solicitud del propietario, 04/11/2026 |
| Empresas: sucursal (D-025, pendiente) | Sucursal predeterminada completa Nombre comercial al crear empresa hasta modificación explícita, sin sobrescribir el dato manual ni fichas anteriores. | Solicitud del propietario, 04/11/2026 |
| Empresas: valores sugeridos (D-026, pendiente) | Área/Cargo/Jornada son sugerencias opcionales para nuevas fichas, explicadas y plegadas, sin afectar trabajadores guardados. | Solicitud del propietario, 04/11/2026 |
| Personal: nombre completo (D-027, pendiente) | Referencia gris no editable ni enfocada, recompuesta con campos individuales; nombre histórico conservado. | Solicitud del propietario, 04/11/2026 |
| Operación local | Inicio/detención/estado/respaldo/actualización cuando correspondan, etiqueta de versión visible | Huella |

**Presentación:** preservar distribución, pestañas, campos, orden, botones y planilla original; cuando se cambie la navegación por módulos se comprobará que las pantallas internas no se deterioran. Mantener nombres completos en ficha; nombres cortos solo en contextos aprobados.

## Propinas: funciones que NO se pueden perder
| Área | Comprobación mínima |
|---|---|
| Semana | Crear siguiente, editar, guardar parcial, guardar/salir y reservas entre sesiones |
| Planilla | Vista de trabajo amplia original; fluidez, teclado, cambios no guardados, estados Completa/Media/Nada |
| Elegibilidad | Contrato/fechas, días no trabajados y participación diaria independiente |
| Cálculo | Grupos 70/30, tarifas 70/35/30, racionales exactos/BigInt, transferencia de saldos y redondeo por mayores restos |
| Cierre | Validaciones de cierre, reabrir con permisos, no cerrar con saldos indebidos |
| Histórico | Snapshots de personas, grupos, cargos, fechas, cálculos y montos; semanas cerradas sin recálculo |
| Figuras | Copero Mañana, Copero Tarde y Refuerzo, sin crear personas ficticias |
| Operación | Imagen/resumen, entregas, auditoría, exportación/backup, roles y sesión |
| Seguridad | Restricción operador/consulta, bloqueo de concurrencia, respaldo no expuesto |

## Matriz de revisión por pantalla (para rellenar con evidencia real en INT-001/002/005)
| Módulo | Pantalla de origen | Resultado en nuevo | Evidencia | Aprobación |
|---|---|---|---|---|
| Personal | Ficha trabajador + pestañas | Pendiente | Pendiente | Pendiente |
| Asistencia | Armar horario | Pendiente | Pendiente | Pendiente |
| Asistencia | Terminal QR/PIN | Pendiente | Pendiente | Pendiente |
| Administración | Empresas/usuarios/catálogos | Pendiente | Pendiente | Pendiente |
| Propinas | Planilla semanal completa | Pendiente | Pendiente | Pendiente |
| Propinas | Cierre y semanas históricas | Pendiente | Pendiente | Pendiente |

### No afirmar paridad solo por
- Que `npm test` pase con fixtures artificiales.
- Que las rutas respondan HTTP 200.
- Que una captura nueva «se parezca» a la original.
- Que un PR esté fusionado o un README diga «v3.0.0».

La evidencia exigida incluye tarea funcional, resultado, caso negativo, fidelidad visual, versión/commit y autorización del propietario.
