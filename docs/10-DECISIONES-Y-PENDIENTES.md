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

## Pendientes que no se pueden inventar
- [ ] Commit exacto de Huella que servirá de copia INT-001 (tomar de `main` cuando inicie).
- [ ] Copia de código y prueba funcional del sistema en repo nuevo.
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
