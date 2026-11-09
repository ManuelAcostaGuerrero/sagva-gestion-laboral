# 24. Cierre funcional reciente y hoja de ruta vigente — 09-11-2026

**Producto:** SAGVA Gestión Laboral  
**Repositorio:** `ManuelAcostaGuerrero/sagva-gestion-laboral`  
**Corte de código:** `281b9182d18613a35f25298a5fc376610a38a5ba` (`main`, antes de este registro documental).  
**Versión que muestran los manifiestos:** `1.19.2`; no equivale a lanzamiento `v1.0.0`.  
**Tipo de evidencia:** integración y CI constatados en GitHub; pruebas físicas y aprobación comunicadas por el propietario, sin inspección remota de su PC, respaldo o registros privados.

## A. Dos esquemas de fases que NO deben confundirse

1. **Entregas funcionales 1 y 2 + mejora Contabilidad Laboral + "Fase 3" de validación reciente.** Son los trabajos de noviembre de 2026 sobre la aplicación local. El propietario confirmó las pruebas y aprobó expresamente esta fase funcional el 09-11-2026. No incluye por sí mismo la totalidad del plan INT.
2. **Plan de integración original `INT-001` a `INT-006`.** Tiene puertas independientes de aceptación: paridad con Huella original, restauración de respaldos, conciliación de personas, migración de datos, Propinas, seguridad y liberación final. Ver [plan](02-PLAN-DE-INTEGRACION.md) y [matriz](06-PRUEBAS-Y-ACEPTACION.md).

La numeración informal de "puntos 1 a 21" de mejoras **no** es la misma que los identificadores `D-018` a `D-038` del registro de decisiones. No interpretar coincidencias numéricas como equivalencias.

## B. Entregas que están en `main`

| Trabajo | Alcance implementado | Evidencia GitHub | Aceptación informada |
|---|---|---|---|
| Entrega 1: Personal, Empresas e Identidad | Puntos 1–8 y 15: búsqueda/formato RUT; nombre derivado; regiones/provincias/comunas y localidad; empresa/sucursal sugerida; domicilio particular; RUT médico | [PR #4](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/4); [detalle](21-ENTREGA1-IMPLEMENTACION-20261108.md) | Sí, dentro de revisión funcional comunicada |
| Entrega 2: Contratos, anexos, datos de previsión | Puntos 9, 10, 11, 12, 13, 16, 17 y 21: indefinidos; aumento/reemplazo de sueldo base con PDF firmado y aprobación explícita; lugar de prestación; AFP y salud; fechas; guardado seguro y borradores | [PR #7](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/7), `f1cff679539e`; [detalle](22-ENTREGA2-CONTRATOS-20261109.md) | Sí, dentro de revisión funcional comunicada |
| Extra: Gestión → Contabilidad Laboral → Parámetros Previsionales | Catálogos AFP, FONASA e Isapres; tasas, comisiones, topes y componentes de aportes precargados; edición por administrador, motivo, vigencias e historial; AFP/Isapre seleccionables en ficha y plan individual UF/CLP | [PR #8](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/pull/8), `281b9182d186`; [detalle](23-CONTABILIDAD-LABORAL-20261109.md) | Sí, incluida en pruebas de propietario |

En los tres casos, los PR están fusionados. Para la Entrega 2 y Contabilidad Laboral se integró el avance de rama directamente a `main` mediante fast-forward con SHA esperado; los PR de validación quedaron registrados como fusionados.

**CI de la revisión final de Contabilidad Laboral:** `Verificar proyecto` [run 42560860962](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/actions/runs/42560860962) y `Validar mejoras QR móvil` [run 42560860965](https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral/actions/runs/42560860965): `success`. Las pruebas utilizan datos sintéticos/SQLite temporal; no reemplazan ensayos con datos privados y restauración externa.

## C. Validación funcional del propietario: "Fase 3" aprobada

**Comunicación del propietario el 09-11-2026:**
- Declaró haber probado en su Windows `Actualizar.bat`, respaldos/migraciones y persistencia.
- Declaró haber probado fichas, AFP, Isapres, sueldo base, anexos, historial y permisos.
- Para acceso móvil en la LAN, `/api/health` respondía correctamente mediante HTTP, pero la pantalla del celular quedaba en blanco. El acceso por el túnel **HTTPS** de Cloudflare funcionó; el propietario informó **detalles visuales**, no un bloqueo funcional.
- Tras esa comprobación, dio **aprobación expresa** a la Fase 3 de validación funcional reciente.

**Distinción de evidencia:** los puntos anteriores son pruebas y aceptación **reportadas por el propietario**, no auditoría independiente de este documento. No se publica información real de trabajadores, capturas autenticadas, claves, enlaces temporales ni archivos de respaldo.

**Pendiente no bloqueante de esa aceptación:** pulir el diseño adaptable al celular. Antes de cerrar seguridad/productivo, comprobar por separado cámara QR en origen HTTPS seguro, permisos, terminal autorizada y flujo de marcación real, sin asumir que abrir la página equivale a probar todo.

### Acceso local y acceso móvil seguro

- **Gestión Laboral:** pantalla HTTP local `5183`, API `4010`. **Huella original:** pantalla `5173`, API `4000`. No confundir las instalaciones ni las bases.
- El origen `http://localhost:5183` en la propia PC y `http://<IP-LAN>:5183` en un celular tienen **distintas garantías de contexto seguro**; no asumir que la API sana acredita capacidades de cámara, PWA o notificaciones.
- El repositorio ya incorpora `IniciarCloudflare.bat`, `EstadoCloudflare.bat` y `DetenerCloudflare.bat`, con túnel HTTPS temporal hacia `127.0.0.1:5183`. Se necesita que el programa y la PC permanezcan encendidos.
- **Seguridad:** el túnel publica temporalmente la pantalla mediante una URL accesible desde Internet; tratarlo como acceso de prueba, no compartir URL, cerrar después con `DetenerCloudflare.bat`. Para uso permanente decidir dominio estable, HTTPS, controles de autenticación/autorización y revisión de exposición.
- Existe configuración HTTPS LAN opcional en `tools/configurar-qr-movil.ps1` sobre `5184`, que requiere certificados válidos y confianza del teléfono. **No afirmar que quedó instalada o probada** solo porque existe el script.
- El diagnóstico móvil por USB/Chrome queda como procedimiento de contingencia, **no necesario para certificar la conectividad que el propietario ya probó por HTTPS**.

### Actualizador y punto de mejora

- `Actualizar.bat` es manual, con verificación de Git, SHA, respaldo y control exclusivo de procesos propios. Conservar ramas y fuentes históricas, no usar `reset --hard`, `stash` automático ni destruir datos. [Informe de implementación](23-ACTUALIZADOR-LOCAL-20261108.md).
- La pantalla incorpora un aviso que detecta el cambio de versión y **ofrece** recargar una pestaña existente, tras confirmar que se guardaron cambios. **No afirmar recarga completamente automática**, ni que el actualizador abra/cierre el navegador.
- Los puntos informales 18 y 19 (ojo de contraseña visible solo mientras se mantiene pulsado y confirmación de contraseñas en flujos administrativos) están implementados; el punto informal 20 (actualización/recarga) está implementado de manera controlada, con posible mejora UX de recarga.
- Los respaldos, estados de recuperación, credenciales, datos reales y rutas privadas permanecen **fuera del repositorio público**.

## D. Estado correcto de INT-001 a INT-006

| Hito del plan original | Estado al 09-11-2026 | Qué falta para cerrarlo |
|---|---|---|
| `INT-001` Huella base | Código de Huella incorporado a `main` y en uso de ensayo; validación funcional reciente aceptada | Acta formal de equivalencia y cierre de puerta del hito original con el alcance exigido |
| `INT-002` Paridad completa Huella + restauración privada | **Evidencia parcial** de Windows y móvil reportada, no cierre formal acreditado | Matriz frente a Huella original, restauración en carpeta/equipo aislado, integridad de SQLite/archivos/permisos, QR/PIN y funciones sensibles, evidencias privadas verificables |
| `INT-003` Conciliación de identidades Propinas | **Aplazado**; no autorizado | Solo después de `INT-002`, confirmar correspondencia de personas individualmente y en privado |
| `INT-004` Base única PostgreSQL | **Aplazado**, no realizado | Esquema, migración idempotente y reversible sobre copias verificadas, sin duplicados |
| `INT-005` Integración Propinas | **Aplazado**, no realizado | Paridad exacta de reparto (diferencia 0 CLP), semanas históricas, permisos y respaldos |
| `INT-006` Rescate selectivo y lanzamiento general | **Pendiente**, no aprobado | Pruebas transversales Windows/Linux/DB/móvil, privacidad, restauración externa y aceptación formal |
| `v1.0.0` | **No liberada** | Cierre técnico y autorización explícita de producto |

**Regla:** la aprobación de la "Fase 3" de mejoras **no es aceptación de `INT-003`, `INT-004`, `INT-005`, `INT-006` ni autorización productiva**. No iniciar conciliación de Propinas, migrar bases o desplazar los sistemas originales automáticamente.

## E. Cartera de trabajo pendiente, priorizada

### Próximo ciclo: consolidar sin ampliar alcance
1. Registrar en privado el checklist de paridad y el ensayo de restauración de `INT-001/002`, si se decide formalizar esos hitos. Sin publicar datos reales en Git.
2. Mejoras de visualización responsiva en teléfono. Revisar navegación, anchos, tablas y formularios, sin rediseñar flujos aprobados.
3. Mejorar la experiencia del aviso de recarga de pestaña tras una actualización, sin autoactualización de archivos ni pérdida de formularios.
4. Mantener documentación y evidencias sincronizadas con cada cambio, y verificar tablas de parámetros legales vigentes antes de usarlas para declaraciones reales.

### En estudio o congelado por decisión del propietario
- **Perfil `root` / superadministrador universal:** idea aprobada solo para estudio; **no implementada**. El rol `admin` actual es quien modifica parámetros previsionales, con auditoría.
- **Cargas familiares, protección maternal y subsidios:** **investigación pendiente** de normativa, privacidad y responsabilidades; sin capturar datos sensibles ni generar pagos o automatismos.
- **Liquidaciones de sueldo y motor de cotizaciones:** **no implementado**; el catálogo Contabilidad Laboral no calcula remuneraciones, Previred, impuestos o conversiones diarias de UF automáticamente.
- **Propinas + trabajador maestro + PostgreSQL:** **en evaluación / aplazado** hasta tener información y decisión expresa del propietario. No iniciar desarrollo ni migraciones.
- **Acceso remoto permanente:** el túnel temporal funcional no implica despliegue público definitivo.

## F. Reglas de continuidad

1. Fuente de código `main`; verificar siempre SHA y CI, distinguir PR integrado de prueba física y de aceptación de hito INT.
2. Actualizaciones Windows **manuales** con respaldos y recuperación controlada; original Huella y Propinas aislados.
3. Ningún registro personal, contraseña, token, enlace temporal, documento laboral/médico, SQLite real o respaldo en GitHub público.
4. No sustituir valores legales oficiales ni sobreescribir liquidaciones históricas por cambiar parámetros de referencia. Los cambios de tasa usan vigencias, motivos y auditoría; parámetros editables **no** equivalen a validez legal.
5. No considerar la futura plataforma integrada lista para producción hasta cierre de las puertas INT exigidas.

**Nota de documentación:** este archivo registra el corte conocido y las decisiones comunicadas. No ejecuta pruebas adicionales, despliegues, cambios de bases ni nuevas funciones.
