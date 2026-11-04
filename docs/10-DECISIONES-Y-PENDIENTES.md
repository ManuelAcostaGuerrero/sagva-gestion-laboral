# 10. Registro de decisiones (ADR simplificado) y pendientes

Todas las decisiones de esta tabla se refieren al **diseño acordado**, no a una implementación ya realizada.

| ID | Fecha | Decisión aprobada | Motivo |
|---|---|---|---|
| D-001 | 2026-11-01 | Nombre **SAGVA Gestión Laboral**, repo `sagva-gestion-laboral` | Personal/asistencia como identidad principal |
| D-002 | 2026-11-01 | Repo público **solo código y datos sintéticos** | Reducir costes de CI, sin exponer datos |
| D-003 | 2026-11-01 | Huella original es base funcional y visual; no rediseñarla | Evitar repetir fallo anterior |
| D-004 | 2026-11-01 | Primero Huella completa, después conciliación de trabajadores, datos/módulos y Propinas | Evitar duplicados y regresiones |
| D-005 | 2026-11-01 | Correspondencia trabajador Propinas ↔ Huella confirmada **por propietario** | Propinas no tiene RUT; nombres insuficientes |
| D-006 | 2026-11-01 | Un único registro maestro de Personal, con datos operativos por módulo | No duplicar ficha ni área/cargo |
| D-007 | 2026-11-01 | Base central objetivo PostgreSQL, tras paridad inicial de Huella con SQLite | Migración controlada |
| D-008 | 2026-11-01 | Propinas extra; Delivery y ERP fuera de alcance | Límites claros |
| D-009 | 2026-11-01 | Rescate técnico del legado **al final**, sin trasladar su UI | Reducir riesgo |
| D-010 | 2026-11-01 | Durante integración `INT-NNN`, luego lanzamiento desde `v1.0.0` | Separar hitos de releases |
| D-011 | 2026-11-01 | Convención X = funcionalidades, Y = estética/UX, Z = corrección | Jerarquía de cambios definida por propietario |
| D-012 | 2026-11-01 | Aprobación expresa para cambiar pantallas y reglas económicas; preservar originales | Paridad y control |
| D-013 | 2026-11-01 | **Ejecutar toda tarea de GitHub directamente desde este chat**, con herramientas GitHub; **no delegarla a Work** | Evitar gasto de los pocos créditos restantes y errores de traspaso |
| D-014 | 2026-11-01 | **Work solo para acciones imprescindibles fuera de las capacidades del chat, con explicación y autorización previa** | Resguardar presupuesto, dar trazabilidad y limitar operaciones sobre la PC |
| D-015 | 2026-11-01 | **El archivo manual `Actualizar.bat` de Windows**, al habilitarse después de INT-001, debe seguir **comprobar versión → detener proceso propio si activo → actualizar seguro → recargar la misma pestaña existente sin duplicarla**. No se trata de actualizaciones automáticas | Proteger datos y evitar reinicios innecesarios/pestañas duplicadas |
| D-016 | 2026-11-02 | El asistente debe **contradecir con fundamento, no asentir automáticamente y no saltar fases**: comprobar evidencias de hito antes de recomendar el paso siguiente y rechazar declarar INT-003 listo sin INT-002 acreditado | Evitar errores de planificación, duplicidad de datos y confundir CI con aceptación funcional |
| D-017 | 2026-11-03 | Por solicitud explícita del propietario, **fusionar código Huella INT-001 a `main`** mediante PR #1 con CI verde, **sin declarar paridad integral aprobada ni producción habilitada** | Separar integración de control de versiones de aceptación funcional; proteger originales y datos privados |
| D-018 | 2026-11-04 | **Búsqueda por RUT sin separadores:** en las búsquedas de trabajadores, los puntos (`.`) y guiones (`-`) introducidos o almacenados no deben afectar las coincidencias; `K` y `k` equivalentes. Este requisito se había solicitado el 03–04/10/2026 y fue reiterado expresamente; no confundirlo con la validación del dígito verificador ni con la prevención de RUT duplicados. | Encontrar la misma ficha con o sin formato de RUT, sin alterar identidades ni registros |
| D-019 | 2026-11-04 | **Cerrar la ficha del trabajador tras guardar correctamente**, tanto con «Guardar ficha»/«Guardar ficha provisional» como con «Completar / validar ficha». Volver a la lista sin dejar ningún formulario de ese trabajador abierto o editable; para cambiarlo otra vez habrá que seleccionar manualmente su ficha. Si el guardado falla o quedan cambios pendientes de otras secciones, conservar la ficha abierta con mensaje claro hasta resolverlos, sin perder datos. | Prevenir modificaciones accidentales posteriores al guardado, sin sacrificar persistencia ni datos pendientes |

## Pendientes que no se pueden inventar
- [ ] **Cerrar ficha al guardar con éxito (D-019):** después de persistir **todas las secciones aplicables** de un trabajador mediante el guardado general/compartido o «Completar / validar ficha», limpiar la selección y mostrar la lista sin campos editables de ese trabajador. Mostrar confirmación visible («Ficha guardada y cerrada»); para seguir editando, seleccionar expresamente de nuevo la ficha. Si alguna sección falla, se cancela o queda sin guardar (p. ej., información médica o contractual), no cerrar ni perder el borrador, e indicar lo pendiente. Comprobar con pruebas de guardado normal, validación, creación, múltiples secciones y fallos. **Pendiente de implementar, sin tocar la BD ni modificar la interfaz original todavía.**
- [ ] **Buscar trabajadores por RUT ignorando `.` y `-` (D-018):** en la pantalla de ficha personal y en cualquier consulta por RUT, comparar ambos lados sin separadores y sin distinguir `K/k`. Ejemplo sintético de equivalencia: `12.345.678-5`, `12345678-5`, `12.345.6785` y `123456785`. Mantener búsqueda por nombre/empresa y filtros de activo/inactivo; no alterar RUT guardados, corregir identidades ni crear personas. Probar con datos ficticios las combinaciones guardado con formato ↔ entrada sin formato, y viceversa. **Pendiente de implementar y validar; la normalización existente para validación/duplicidad no prueba que el buscador funcione.**
- [ ] Implementar y probar en etapa posterior el actualizador con comprobación previa, detención selectiva, actualización segura y recarga cooperativa de la pestaña existente. **No implementar ni ejecutar en INT-001.**
- [x] Fuente Huella INT-001 fijada en `fe1f797c3a15ed436899f52cd94063f94db23344` (v1.19.2), más mejoras autorizadas de contraseña y exportación.
- [x] Copia de código y CI de la rama INT-001 integrado en `main` (PR #1).
- [ ] Prueba funcional integral, paridad visual/operativa local y aceptación formal INT-001 e INT-002.
- [ ] Ruta, cantidad y calidad de datos reales: **solo se inspeccionan privadamente con permiso**.
- [ ] Matriz privada aprobada de equivalencias por trabajador; recuperar decisiones anteriores si están disponibles, sin darlas por confirmadas.
- [ ] Reglas reales de empresa/local/área/cargo → grupo/tarifa Propinas y excepciones, con vigencias. **No inventar porcentajes**.
- [ ] Alcance exacto de permisos por local y acceso a documentos médicos.
- [ ] Método de conservación de QR/PIN y compatibilidad de credenciales con PostgreSQL.
- [ ] Umbrales de respaldo y recuperación RPO/RTO, medio externo y custodio.
- [ ] Criterios detallados de la navegación contenedora, sin cambiar pantallas originales.
- [ ] Fecha y condiciones de futura producción/hosting.
- [ ] Pruebas de CI, Windows/Linux, navegador, celular físico y evidencia verificable.

## Protocolo de cambios de decisión
Cada nueva decisión agrega ID, fecha, problema, opciones, decisión aprobada, impacto, pruebas y reversión. No inferir una decisión a partir de código viejo o una conversación incompleta. No incluir nombres ni RUT ni información confidencial en este registro público.
