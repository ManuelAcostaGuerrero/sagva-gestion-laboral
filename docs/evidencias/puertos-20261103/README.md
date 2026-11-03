# Evidencias Windows: orden local y puertos

[Informe y límites](../../15-ORDEN-LOCAL-Y-PUERTOS-20261103.md).

Código funcional comprobado en este repositorio: 3244b2007153c25fdd9c9783344c8240bcc1ff3b. Las pruebas de servidor y controlador se repitieron después del commit. La navegación e integridad reales se ejecutaron sobre los mismos archivos antes de confirmarlos en Git; se verificó que coinciden con los commits indicados en operacion.json.

[Operación real](operacion.json) · [Aislamiento y estado final](aislamiento.json) · [Hashes](SHA256.json). Los registros solo normalizan saltos de línea y sustituyen la raíz local por <PROYECTOS>. No contienen credenciales, bases, PDFs, personas ni sus cantidades. Capturas de acceso sin sesión y manifiestos de respaldo se conservan únicamente en archivo privado.

Pruebas controlador: dobles de procesos/comandos, sin abrir bases. La prueba aislamiento.json sí ejercita procesos y puertos reales. Esto no certifica DT, integración completa ni recuperación externa.
