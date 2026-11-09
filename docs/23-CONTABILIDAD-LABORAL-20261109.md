# Contabilidad Laboral: Parámetros Previsionales

Integración: Gestión > Contabilidad Laboral. Proyecto: sagva-gestion-laboral. Implementación: 2026-11-09.

## Alcance

- Precarga de las siete AFP y comisiones vigentes publicadas por la Superintendencia de Pensiones.
- Precarga de FONASA e Isapres (abiertas y cerradas) según la Superintendencia de Salud.
- Parámetros de trabajador: AFP obligatoria 10 %, salud 7 %.
- Topes imponibles 2026: enero 89,9 UF / 135,1 UF; desde febrero 90 UF / 135,2 UF.
- Aportes empleador: calendario 2025-2033; el total YA INCLUYE los componentes individuales y no se debe sumar otra vez. No se calcula nómina desde este módulo.
- Administrador: crear instituciones, cambiar nombre/estado, registrar nuevas versiones de tasas y vigencias con motivo y auditoría. Supervisor: lectura. Operador: solo catálogo para fichas.
- Ficha de trabajador: desplegables AFP e Isapre, conserva valores heredados; precio de plan Isapre individual en UF o CLP.
- Historial: no hay UPDATE ni DELETE en labor_parameter_versions. La consulta de una fecha usa la versión con mayor fecha de vigencia (y mayor id si hubo corrección en la misma fecha). Es posible consultar los valores anteriores.
- Se mantiene totalmente separada la instalación original Huella Digital, y no se altera ninguna ficha al introducir el catálogo.

## Límites explícitos

No se ha introducido perfil root o permisos universales, ni motor de liquidaciones, ni conexión automática con Previred, ni sincronización diaria de UF, ni cálculo de impuesto único/seguro de cesantía. Aunque las tasas están precargadas, antes de declarar obligaciones reales deberán revisarse vigencia, sujeción a tope imponible y particularidades contractuales. Correcciones retroactivas registran una nueva versión: no borran historial, pero deben revisarse antes de usarse para recalcular períodos anteriores. La migración es aditiva y no toca trabajadores existentes.

## Fuentes normativas

AFP y comisiones: https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9897.html
Cotización salud: https://www.superdesalud.gob.cl/preguntas-frecuentes/cual-es-la-cotizacion-legal-para-salud-y-en-que-plazo-deben-ser-declaradas-y-pagadas/
Isapres: https://www.superdesalud.gob.cl/registro/isapres/
Topes 2026 enero: https://www.spensiones.cl/portal/institucional/594/w3-article-16885.html
Topes 2026 desde febrero: https://www71.spensiones.cl/portal/institucional/594/w3-article-16921.html
Cronograma empleador: https://previsionsocial.gob.cl/superintendencia-de-pensiones-publica-norma-en-consulta-para-regular-nueva-cotizacion-del-empleador/

## Pruebas

Ejecutar npm ci, npm run test:server, npm run build --workspace client. Comprobar actualizador Windows y funcionalidad móvil con copia de datos respaldada antes de dar el despliegue por validado.
