# 04. Datos maestros, conciliación y reglas de negocio

## Fuentes iniciales verificadas en código (no registros de usuarios)
- **Huella**: SQLite `data/asistencia.db`, entidades como `employees`, información de ficha, `company_profiles`, catálogos, contratos y anexos, documentos/PDF, perfiles/licencias médicas, planificador, marcaciones, terminales y auditoría. Varias tablas se crean desde migraciones JS, no solamente `database/schema.sql`.
- **Propinas**: SQLite `data/propinas.db`, `people(id TEXT, body JSON)` y `weeks(start, body JSON)`, usuarios, sesiones, bloqueos, auditoría y respaldos. El cuerpo de `people` tiene identificador/nombre/puesto/grupo/tarifa/fechas/estado, **sin RUT**.
- Los archivos del repositorio GitHub **no prueban que existan registros reales** ni cuántos. Esto requiere respaldos privados autorizados.

## Una autoridad de Personal
El destino tendrá `Persona`, `Empresa`, `Local`, `RelacionLaboral` (histórico), `Area`, `Cargo`, referencias originales contextuales y auditoría. Una persona puede tener varias relaciones por empresa/periodo; eso **no** crea identidades humanas duplicadas. No reutilizar IDs globalmente; cuando falta RUT, permitir perfil incompleto explícito (sin inventarlo). Los usuarios de acceso no son automáticamente los trabajadores.

| Dato | Autoridad | Consumidores |
|---|---|---|
| Identidad, RUT, nombres, contactos | Personal | Asistencia y Propinas con permiso |
| Empresa, local, área, cargo y vigencias | Personal / Administración de catálogos | Turnos, elegibilidad y categoría Propinas |
| Turnos, QR/PIN, marcaciones, correcciones | Asistencia | Propinas solo según reglas aprobadas |
| Monto, estado diario, saldo, cálculo, cierre | Propinas | Reportes autorizados |
| Documentos médicos y observaciones | Personal restringido | **No Propinas** |

## Correspondencia entre sistemas: trabajo privado y humano
1. Hacer respaldo consistente de cada origen y extracción de **lectura** al entorno privado.
2. Producir matriz privada con: origen, instalación, ID origen, período/snapshot, nombres originales, vínculo propuesto, estado de decisión, confirmador, fecha, evidencia y observaciones. No subir a Git ni compartir por PR.
3. Estado por fila: `CONFIRMADO_MISMA_PERSONA`, `DISTINTA_PERSONA`, `NUEVA_PERSONA`, `FIGURA_OPERATIVA`, `PENDIENTE`.
4. El **propietario confirma cada trabajador** de Propinas frente a Huella. Un nombre similar, misma área, antiguo ID o coincidencia automática **no bastan**.
5. Un ID legado reutilizado en snapshots históricos no debe mapearse ciegamente a una sola persona; mantener referencias temporales/contextuales.
6. Identidades históricas irresueltas se conservan sin adjudicar: no perder dinero ni historia por una conciliación incompleta.
7. Importar idempotentemente: reejecutar importador no crea duplicados.

**Ejemplo exclusivamente ficticio:** `Huella employee:42` ↔ `Propinas people:ejemplo-uuid` ↔ `Persona:UUID-central`, solo después de confirmación del propietario. No usar este ejemplo como dato real.

## Figuras operativas de Propinas
`Copero Mañana`, `Copero Tarde` y `Refuerzo` pueden representar posiciones operativas del reparto, **no necesariamente personas identificadas**. Mantenerlas como `ParticipanteTipo=FIGURA`, sin RUT, ficha médica ni contrato inventado. Coexisten con trabajadores reales; una fila asignada no supone automáticamente que trabajó.

## Clasificación automática y vigencias
- Resolver grupo/tarifa según **empresa, local, área, cargo, vigencia** y, si existe aprobación, excepción individual.
- Configuración explícita revisable; no suponer categorías de Cocina, Barra, Garzones o Copería ni fijar porcentajes por intuición.
- Al cambiar área/cargo, aplicar regla a futuros períodos según fecha; no reescribir cierres históricos.
- La asistencia/tardanza puede alimentar **indicios o reglas operativas aprobadas**, pero no sustituye unilateralmente el estado diario de participación de Propinas.
- Preservar instantáneas de cada semana cerrada, versiones de reglas, fechas, montos y razón de ajustes autorizados.

## Invariantes monetarias
Propinas conserva su algoritmo original: reparto de fondos 70/30, participaciones Completa/Media/Nada, racionales exactos y redondeo final por mayores restos. **0 CLP de diferencia** frente al original con las mismas entradas. No recalcular semanas cerradas durante importación. Si cambia el modelo, la semántica no cambia sin aprobación explícita.

## Fechas y privacidad
Tiempos de evento y fechas laborales no se mezclan; `America/Santiago` tiene horario de verano, por lo que fechas locales sin zona no se pueden interpretar ciegamente como UTC. Los datos clínicos se guardan separados y protegidos aun dentro de una misma PostgreSQL.
