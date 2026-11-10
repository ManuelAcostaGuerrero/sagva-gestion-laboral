# BL-013: Bonos y asignaciones individuales (sin pagos)

**Solicitado el 10-11-2026.** Registrar desde ahora monto de cada concepto y una casilla **«Tiene cláusulas pactadas»** para su futuro tratamiento, **sin activar evaluaciones, descuentos ni cálculos de remuneraciones**.

## Decisiones de arquitectura

1. **Configuración central:** `Gestión → Contabilidad Laboral → Bonos y asignaciones` permite crear tipos y cambiar nombre/estado con motivo, permisos y trazabilidad. Una tabla de conceptos separa `BONO_REMUNERACIONAL` de `ASIGNACION_PERDIDA_CAJA`. Solo administrador temporal explícitamente autorizado por ID en `SAGVA_CONFIGURATION_USER_IDS` cambia el catálogo; migrar más adelante al modelo Root + permisos individuales.
2. **Ficha/contrato:** `Personal → Ficha del trabajador → Empresa y contrato → Condiciones para un futuro contrato` lista múltiples bonos, cada uno con tipo del catálogo, monto CLP, periodicidad, vigencia opcional, marca «Tiene cláusulas» y estado activo/inactivo. Los cambios se guardan con «Guardar ficha» y **historial de condiciones contractuales**, sin modificar PDF firmados.
3. **Datos y compatibilidad:** IDs internos estables para registros, migración aditiva solo del catálogo, sin alterar las bases originales; un cliente antiguo que guarde contrato sin incluir `bonuses` debe conservar los existentes. Bonos ya guardados no se eliminan físicamente: se desactivan.
4. **Fuera de esta actualización:** cláusulas detalladas, evaluaciones de desempeño, faltantes de caja, retenciones, impuestos, liquidaciones y pagos. La casilla no es autorización para efectuar descuentos. Ninguna fórmula genera un monto distinto al registrado.
5. **Evidencias para aceptación:** test de migración idempotente, permisos 403, historial y protección de datos anteriores; CI, revisión de cambios, pruebas Windows/HTTPS móvil y autorización del propietario antes de instalar.

## Criterio jurídico que condicionará la fase de pagos

- Los bonos por productividad o cumplimiento de metas pueden sujetarse a condiciones objetivas **pactadas previamente**, con exigibilidad conforme a su devengo. Ver [Dirección del Trabajo, bonos](https://www.dt.gob.cl/portal/1628/w3-article-60241.html) y [ORD. N°383/2026](https://www.dt.gob.cl/legislacion/1624/w3-article-129693.html).
- La [asignación por pérdida de caja](https://www.dt.gob.cl/portal/1626/w3-article-60219.html) tiene naturaleza y restricciones propias; no registrarla como «bono de producción» ni crear una autorización genérica de descontar montos. Los casos futuros requerirán validación jurídica y evidencia.
- **Una evaluación o checkbox no permite disminuir unilateralmente una remuneración ya devengada.**

## Estado

**Implementación inicial propuesta en rama y PR de revisión**, sin fusionar, actualizar la PC ni afirmar pruebas locales. No usarla para pagos.
