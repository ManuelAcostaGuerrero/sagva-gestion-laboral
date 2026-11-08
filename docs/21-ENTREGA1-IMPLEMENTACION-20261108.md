# Entrega 1: Personal, empresas e identidad (rama de revisión)

Fecha: 08-11-2026. Repo: sagva-gestion-laboral. Trabajo independiente de INT-002 y de Propinas.

## Requisitos de la entrega, **sin alterar la numeración original**
1. Buscar por RUT con o sin puntos y guion, incluyendo K/k.
2. Formato automático del RUT: presentación en ficha y empresas.
3. Nombre completo calculado: gris, sin foco ni edición directa.
4. Región → Provincia → Comuna; Ciudad/Localidad editable.
5. Empresa recién creada visible al regresar a la ficha, sin F5; recarga manual adicional segura.
6. Sucursal predeterminada del nombre comercial hasta edición explícita, solo en creación.
7. Valores sugeridos plegables y opcionales para fichas nuevas.
8. Dirección particular y localidad del trabajador independientes de la empresa.
15. RUT formateado en Ficha médica, sin alterar el dato persistido.

## Decisiones de seguridad
- Se mantiene la base original de Huella intacta. No importar ni crear trabajadores reales para ensayos.
- La localización del trabajador se persiste como claves opcionales en extra_json sin migración destructiva.
- Empresa añade region/province/city mediante migración aditiva y transaccional. Conservar comuna histórica aun si su región es desconocida.
- Se valida jerarquía nueva cuando se selecciona región; valores históricos sin región se preservan hasta revisión humana.
- Catálogo jerárquico local: 16 regiones, 56 provincias, 346 comunas. Fuente secundaria https://github.com/climoralesg/api-regiones-provincias-comunas-Chile/blob/main/territoriochile.json; se conservan solamente nombres, NO códigos no oficiales. Antes de producción, contrastar nombres/códigos CUT con SUBDERE/INE actualizados.
- Ciudad/Localidad es texto libre porque no existe un catálogo oficial de todas las localidades equivalente al de comunas. No mezclar localidad con comuna.
- RUT empresarial es validado antes de guardar; búsqueda de duplicados ignora separadores y espacios.
- Los datos existentes no se sobrescriben por cambiar de empresa, ciudad o sucursal sin intervención explícita.
- Si la ficha está abierta con borradores, recargar empresas no borra la ficha.

## Criterios de aceptación faltantes antes de fusionar
- CI servidor y build cliente en SHA final; regresión de ficha, empresas, documentos y permisos.
- Prueba de migración sobre copia sintética y base antigua con valores históricos incompletos.
- Prueba manual de todos los selectores, RUT durante escritura y etiquetas, errores, pantalla móvil y accesibilidad.
- Comprobar que desde Empresas se regresa a Personal y la nueva empresa puede asignarse y conservarse tras recarga.
- Aceptación del propietario y revisión de catálogo CUT para publicación. No autorizar instalación/actualización productiva automáticamente.
