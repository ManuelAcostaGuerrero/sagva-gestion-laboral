# SAGVA Gestión Laboral — PR: simplificar bonos (12-11-2026)

## Objetivo

**Este repositorio gestiona antecedentes laborales y asistencia; no realiza liquidaciones, cálculos de pago ni deducciones.** El sistema contable independiente se integrará después.

El usuario solicita mantener **una sola decisión sobre imponibilidad** (sí/no) y **un solo campo de condiciones** que incluya cláusulas, métricas y escalas de cumplimiento, además del nombre y monto de referencia del bono. El resto de las casillas de clasificación jurídica, base de horas extras, casilla de cláusula, criterio duplicado y motivo libre de cambio desaparece de la interfaz.

> **Nota jurídica:** Que un bono sea imponible **no implica automáticamente** que integre la base de cálculo de horas extraordinarias. La determinación legal corresponde a revisión jurídica futura. El programa no debe inferirla ni calcular pagos usando la clasificación de imponibilidad.

## Plan y alcance implementado

1. **Catálogo simple:** `Gestión → Contabilidad Laboral → Bonos`, con **Nombre del bono**, **Monto de referencia CLP**, **¿Es imponible? (Sí/No)** y **Condiciones del bono y métricas de cumplimiento** (una sola textarea con escala porcentual o condiciones documentales). El código único del bono se genera en el servidor y deja de solicitarse al usuario. El estado de actividad y demás columnas técnicas anteriores continúan en la BD.
2. **Compatibilidad sin pérdida:** no se borra ni altera `labor_bonus_definitions`, `labor_bonus_definition_history`, evaluaciones históricas, ni se ejecuta backfill. Para registros anteriores con cláusula y criterios separados, la API devuelve `conditions` combinando ambas partes en la lectura, y conserva ambas columnas originales sin modificarlas. La API acepta temporalmente las entradas heredadas, pero la interfaz utiliza el nuevo contrato simplificado.
3. **Asignación al trabajador:** la ficha solo muestra bono, monto individual pactado/referencial, imponibilidad, condiciones, vigencia y observación. Se oculta `Evaluar`; no ofrece simulaciones de cobros. Las evaluaciones pasadas permanecen consultables, sin botón para generar nuevas.
4. **No reemplazar anexo por una justificación informal:** los bonos del catálogo **ya asignados** no admiten cambios contractuales mediante edición ordinaria de nombre, monto, clasificación o condiciones. Una asignación del trabajador no permite modificar monto, vigencia ni suspender/reactivar mediante PUT. El backend devuelve HTTP 409. Una nota administrativa puede modificarse con auditoría sin alterar el contrato. El flujo de anexos contractuales con respaldo y aprobación **queda pendiente de desarrollo**; no se simula que ya exista.
5. **Servicio de evaluación heredado:** el POST de nuevas evaluaciones devuelve 410, en vez de ejecutar una simulación dentro de este sistema. El GET conserva acceso al historial previo; no se eliminan tablas ni pruebas de integridad.
6. **Pruebas automáticas sintéticas:** creación sin código ni motivo, valores imponible/no imponible, texto de métricas unificado, control de permisos, persistencia de datos legados, bloqueo sin anexo por UI y API, no cálculo, notas auditadas y sin pérdida de contratos.
7. **Validación de integración:** ejecutar `npm run test:server`, `npm run build --workspace client` y GitHub Actions; verificar en interfaz desktop/móvil (en una beta independiente, sin datos reales).

## Modelo de campos nuevos visibles

| Campo | Ejemplo |
|---|---|
| Nombre | Bono por cierre correcto de caja |
| Monto referencial | $50.000 CLP |
| Imponible | Sí |
| Condiciones y métricas | 90% o más de cierres correctos: 100% del bono. Entre 80% y 89%: 80% del bono. Menor al 80%: sujeto al acuerdo documentado. |

La escala queda **documentada como antecedente**, no convertida en fórmula automatizada. Los descuentos de sueldos **no** se autorizan por escribirlos en este texto.

## Exclusiones

- No integrar este código con Propinas, remuneraciones, pagos o nóminas.
- No cambiar cuentas bancarias ni autorizaciones.
- No crear anexos falsos o referencias de documentos inexistentes.
- No asumir certificación DT ni clasificación legal validada.
- No tocar SQLite, trabajadores, contratos ni auditores reales.
- `main` es la rama de pruebas; el servidor operativo permanece separado. Este PR se revisa antes de fusionarse.

## Criterio de aceptación

El administrador debe poder dar de alta un bono desde **cuatro campos**, verlo en la ficha con sus condiciones sin duplicación y no poder alterar condiciones económicas de bonos ya asignados sin el proceso de anexos. El historial viejo sigue intacto y el sistema de asistencia deja de generar simulaciones nuevas.
