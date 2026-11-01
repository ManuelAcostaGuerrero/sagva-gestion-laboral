# Reglas de contribución y revisión

## Flujo
- Trabajar en ramas de alcance pequeño: `int/001-huella-base`, `int/003-conciliacion`, `fix/...`, `docs/...`.
- PR separados por resultado comprobable, no por número artificial. No acumular cambios enormes sin probar paridad.
- Describir problema, archivos afectados, UI antes/después, cambios de datos, riesgos, pruebas realizadas y rollback.
- Antes de fusionar: revisión de diferencias, no secretos, CI aplicable en verde y aprobación del responsable según `docs/06-PRUEBAS-Y-ACEPTACION.md`.
- Si no hay protección automática de rama, mantener revisión manual obligatoria; no asumir que GitHub tiene controles activos.
- No reescribir `main` con `push --force`. No usar `git clean -fdx` en instalaciones con datos; evitar borrado indiscriminado.
- Cuando el repo aún no tenga aplicación copiada, no afirmar que pasó una prueba que no existe.

## Calidad
- Preservar algoritmo de Propinas; usar pesos enteros y diferencia **0 CLP** para entradas equivalentes.
- Conservar nombres completos en Personal; la presentación corta donde el original la usa es un asunto de visualización, no de identidad.
- Restringir datos médicos y documentos a permisos especializados.
- Migraciones aditivas, idempotentes, con rollback/restore ensayado sobre copias.
- Toda función rescatada de Integral necesita evaluación de dependencia, licencia, seguridad, compatibilidad y prueba antes de incorporarse.

Plantilla del PR: `.github/PULL_REQUEST_TEMPLATE.md`.
