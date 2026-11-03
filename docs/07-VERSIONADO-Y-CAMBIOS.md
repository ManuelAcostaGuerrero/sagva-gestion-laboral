# 07. Versionado de integración y de producto

## Etapa 1: integración (no versiones públicas de producto)
Etiquetas de hitos: `INT-001`, `INT-002`, `INT-003`, etc. El número identifica **qué resultado funcional se comprobó**, no una cantidad de PR. Hito inicial `INT-000` = documentación, sin aplicación instalada. La fase INT termina **solo** cuando se completen todas las integraciones y se obtenga aprobación final.

**Identificación de desarrollo recomendada:** `INT-001+<sha-corto>` en diagnóstico/entorno cuando exista una aplicación; mientras no exista, solo documento. Nunca inventar versión visible. Registrar commit, fecha, DB migración aplicada, versión fuente, evidencia. Los números de PR son independientes.

## Etapa 2: producto aprobado, iniciar `v1.0.0`
Convención propia acordada `X.Y.Z`:
| Componente | Alcance | Ejemplo desde v1.0.0 |
|---|---|---|
| **X** | Nueva funcionalidad o módulo | `v1.0.0 → v2.0.0` |
| **Y** | Mejora estética/interfaz y experiencia **autorizada** | `v1.0.0 → v1.1.0` |
| **Z** | Corrección de código, fallos y ajustes técnicos sin nueva función | `v1.0.0 → v1.0.1` |

Cuando incrementa X, Y/Z vuelven a cero; cuando incrementa Y, Z vuelve a cero. En una entrega mixta se usa el nivel de mayor jerarquía. Ninguna corrección autoriza alterar comportamiento ni interfaz silenciosamente. Esta nomenclatura **es convención de SAGVA**, no interpretación estricta de SemVer estándar.

## Ejemplos
- Error al guardar PDF sin modificar interfaz → `v1.0.1`.
- Reorganización visual aprobada de una planilla → `v1.1.0`.
- Nuevo módulo de remuneraciones (solo si se autoriza más adelante) → `v2.0.0`.

## Controles de una publicación
1. Conjunto de PR aprobados y verificación de versión/commit exacto.
2. Registro de migraciones, respaldo y procedimiento reversible.
3. Pruebas de equivalencia y seguridad, Windows/Linux/móvil según alcance.
4. Mostrar versión instalada y SHA corto en pantalla/diagnóstico, **solo cuando exista la aplicación nueva**.
5. Etiquetar solo releases comprobadas; no prometer actualización local al fusionar en GitHub.
6. Registrar notas: qué cambió, problemas corregidos, pasos de actualización, advertencias y reversión.

## Orden obligatorio para el archivo manual `Actualizar.bat`

**Se refiere al `.bat` manual que el usuario ejecutará en Windows, como en los proyectos anteriores; NO a un actualizador automático.** Durante INT-001 no se usará. Cuando se adapte y habilite `Actualizar.bat`, deberá ejecutar estrictamente:

1. **Comprobar si hay actualización** comparando versión/commit local con la publicación aprobada. Si coincide, terminar sin detener ni abrir pestañas.
2. **Detener el sistema solo si está iniciado**, validando que los procesos pertenecen a SAGVA Gestión Laboral. Nunca tocar otros sistemas.
3. **Actualizar** con backup privado verificado, comprobación de cambios locales, descarga y validaciones seguras, pruebas, migraciones controladas y recuperación ante errores; conservar estado previo de ejecución.
4. **Volver a mostrar el sistema en la misma pestaña del navegador**, recargándola después de confirmar salud del servicio. Si no había pestaña, permitir abrir una nueva; nunca duplicar la que ya existe.

**Límite técnico:** el `.bat` sigue siendo el punto de entrada de la actualización manual, pero abrir una URL desde PowerShell/BAT no garantiza reutilizar la pestaña existente. Para cumplir el punto 4 se requiere cooperación del frontend, por ejemplo detectar el cambio de versión desde la pestaña actualmente abierta y recargarla allí; probarlo en navegador real. No afirmar que el script puede localizar cualquier pestaña abierta sin esa integración. Nunca cerrar todo el navegador para actualizar el backend.

**Pruebas de aceptación futuras:** (a) sistema ya actualizado: sin reinicio ni pestaña adicional; (b) sistema abierto en una pestaña: parada/actualización/inicio y recarga de la misma pestaña; (c) sistema detenido: actualización sin abrir navegador espontáneamente; (d) puertos ocupados por terceros: abortar sin tocar otros procesos; (e) fallo de migración/compilación: reportar error, preservar datos y restaurar conforme a procedimiento probado.

## Identidad y actualizaciones locales
Nunca sobrescribir datos y credenciales con `git pull` ni suponer que `main` actualiza automáticamente la PC. Reutilizar `Actualizar.bat` de Huella solo tras inspección y adaptación segura de rutas; no introducir de inmediato el actualizador problemático del legado. Los originales retienen sus versiones (Huella 1.19.2, Propinas 4.4.0 al inventario).
