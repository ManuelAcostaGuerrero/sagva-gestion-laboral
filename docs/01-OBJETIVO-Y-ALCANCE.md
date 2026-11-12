> **Actualización de alcance, 12-11-2026:** este documento describe la planificación histórica original. El desarrollo vigente se limita a **SAGVA Gestión Laboral/Asistencia/Contratos/DT/Seguridad**. **No integrar Propinas ni Repartos en esta etapa**. `INT-003` y `INT-005` (Propinas) y la antigua base unificada `INT-004` quedan aplazados y **no bloquean** el desarrollo laboral. Ver [plan vigente y auditoría de ramas](40-CONSOLIDACION-RAMAS-Y-PENDIENTES-20261112.md). No se reescriben funcionalidades existentes.

# 01. Alcance, arquitectura y navegación

## Visión
Una aplicación denominada **SAGVA Gestión Laboral** cuyo centro es Personal y Asistencia. Propinas es opcional/complementaria. Una sesión de usuario, autorización modular y una sola base PostgreSQL objetivo. El usuario trabaja mediante menú por módulos/subcategorías, no mediante aplicaciones desconectadas.

## Menú lógico propuesto (no UI implementada)
- **Personal** → Trabajadores; Ficha general; Contratos/Anexos; Documentos laborales; Licencias médicas; Ficha médica (restringida).
- **Asistencia** → Marcación QR/PIN; Terminales; Armar horario; Turnos; Calendario; Reportes e historial.
- **Administración** → Empresas; Locales; Usuarios; Roles/Permisos; Áreas; Cargos; Auditoría; Configuración.
- **Propinas (extra)** → Planilla semanal (vista amplia original); Semanas anteriores; Participación/estados; Cálculo/Cierre; Entregas; Respaldos.

El catálogo se cotejará con pantallas reales de cada origen antes de implementarse. **No sustituir pestañas de la ficha ni el planificador original**. La navegación contenedora por módulos se podrá incorporar con aprobación y prueba visual, sin alterar contenido, flujos o densidad original. La ficha médica no debe mostrarse a operadores de Propinas.

## Propiedad de datos
- **Personal es la única autoridad** de identidad y ficha de trabajador, documento, nombres, contacto, empresa/relación laboral, área, cargo, condiciones laborales y vigencias. Un trabajador se crea/edita una vez.
- **Asistencia** administra eventos de marcación, terminales/QR/PIN, turnos, asignaciones semanales, licencias y estado operativo; consume referencias a Personal. Las licencias son datos laborales de acceso controlado, no autorización para leer contenido clínico.
- **Propinas** administra montos, semanas, participantes/figuras, estados diarios, cálculos, cierres y auditoría de reparto. Consume trabajadores de Personal y reglas de clasificación aprobadas. No mantiene otro padrón maestro de empleados.
- **Administración** administra empresa/local, roles, reglas/parametrización, seguridad y auditoría compartida.

**Una base de datos no equivale a una sola tabla.** Separar tablas por dominio y protegerlas por permisos. Crear solo relaciones y vistas que respondan a necesidades reales; no duplicar fichas de persona.

## Reglas laborales → propinas
Área y, cuando corresponda, cargo y local, se asignan en Personal. Propinas puede derivar grupo/categoría a partir de una **tabla configurable con empresa + local + área + cargo y vigencia**; excepciones individuales solo si el propietario las aprueba. No inventar qué porcentaje corresponde a un área. Estado diario (Completa/Media/Nada), trabajo realizado y cantidad de propina siguen siendo hechos operativos independientes, no se infieren automáticamente de un horario.

## Arquitectura por etapas
1. **INT-001/002:** transportar código de Huella **sin reescribirlo**; SQLite de laboratorio para paridad. Su código React/Vite + Express es la referencia inicial. En Windows, respetar scripts de inicio y procesos de origen.
2. **INT-003:** auditoría privada de personas. Aún no es migración.
3. **INT-004:** evolución interna hacia un solo esquema PostgreSQL en laboratorio, preservando API, interfaz, semántica y datos. Prisma/TypeScript, si se reutilizan, se introducen solo por necesidad y pruebas; no exigir reescritura general.
4. **INT-005:** insertar módulo Propinas manteniendo presentación y motor original. Una sola sesión y permisos.
5. **INT-006:** componentes del legado revisados uno por uno; sin rediseñar UX.

## Límites del producto
- Fuera: Reparto/Delivery independiente; ERP Sagva-System, caja/ventas, cámaras/mesas y nómina completa salvo futura solicitud explícita.
- Dentro: documentación, respaldo, auditoría, permisos y pruebas necesarios para operar con seguridad.
- Sin despliegue público automático, servidor contratado o migración productiva por defecto.
