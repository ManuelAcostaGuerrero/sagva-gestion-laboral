# Etapa 3 — Configurador de campos en Contabilidad Laboral

**Solicitada 10-11-2026. En PR borrador de revisión, no instalada.** Se implementa sobre los cambios de Etapas 1 y 2 y conserva la ficha única vigente.

## Funcionalidad incluida

1. `Gestión → Contabilidad Laboral → Configuración de campos`: Root o Contabilidad con `labor.fields.manage` puede crear y versionar definiciones, etiqueta, tipo (texto/número/fecha/sí-no/lista), opciones de selección, obligatorio, destino y estado. Motivo e historial siempre presentes.
2. Los campos adicionales tienen código estable que empieza `EXT_`; nunca modifican la estructura de RUT, sueldo, previsión, documentos firmados, banco ni ficha médica. **No se implementa un diseñador SQL arbitrario ni fórmulas dinámicas**.
3. `Personal → Ficha → Datos personales` y `Empresa y contrato` leen las definiciones publicadas y muestran valores individuales; no pueden modificar catálogos ni reglas globales. Se guardan con el botón general «Guardar ficha», con control de concurrencia e historial.
4. Se aplica autorización de servidor: permiso para leer/editar ficha o contrato **y** permiso para cada campo `custom_field.EXT_CODIGO.read/write`. Las excepciones por usuario se administran en Root; denegación individual prevalece.
5. El campo requerido se valida al introducirlo y antes de cerrar una ficha como validada. El guardado provisional sigue permitiendo fichas incompletas. Los datos de contrato no firman ni actualizan automáticamente documentos.
6. Una definición desactivada permanece visible como histórica si un trabajador ya tiene un valor. Cambiar la etiqueta no reinterpreta datos, y una opción ya usada no puede eliminarse sin proceso especial.

## Limitaciones que requieren siguiente fase

- Restricción de ámbitos `admin_local` aún no habilitada: primero auditar todos los endpoints por empresa/local, no solo esta API.
- Reglas condicionales entre campos, firma de cláusulas, liquidaciones, descuentos, subsidios, pagos y cálculos tributarios quedan fuera de esta primera versión.
- Cada campo configurable es **complementario y no sensible**. No usarlo para diagnósticos, embarazo, cuentas bancarias, claves ni documentos clínicos, que requieren módulos propios.
- El código se encuentra en PR y debe pasar CI, pruebas de seguridad, validación Windows y móvil antes de fusionar y actualizar la PC manualmente.

## Fuentes

- [Plan Etapa 2](30-ETAPA2-ROOT-PERMISOS-20261110.md).
- [Plan consolidado](25-PLAN-CONTABILIDAD-LABORAL-CAMPOS-Y-PERMISOS-20261110.md).

## Revisión adicional de ejecución e interfaz — 10-11-2026

- La ficha provisional **puede guardar campos configurados incompletos**: `required` se exige solo al marcar «Completar / validar ficha», no al guardar un borrador. Se verifican campos de ficha y condiciones contractuales cuando estén configurados como obligatorios.
- El resumen de campos pendientes muestra también los campos configurables, los resalta y permite saltar directamente al control.
- La API Root rechaza permisos de ámbito empresa/sucursal hasta completar el aislamiento real de todos los módulos; evita ofrecer una protección falsa.
- Las fechas de vencimiento de permisos se validan contra el calendario, no solo por coincidencia de formato.
- No se conceden permisos a campos personalizados inexistentes para evitar autorizaciones futuras accidentales.
- Respuestas de error dentro de transacciones de permisos hacen `ROLLBACK` explícito antes de liberar conexiones.
- Se ejecutan regresiones del servidor, compilación frontend y validación automática QR. **No equivale a prueba física en Windows y móvil ni a instalación local.**
