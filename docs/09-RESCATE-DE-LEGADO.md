# 09. Rescate selectivo del proyecto SAGVA Gestión Integral

## Posición acordada
`sagva-gestion-integral` es **referencia de componentes técnicos**, no el producto base. No continuar sumándole PR, no trasladar su interfaz ni asumir que funcionó en PC. Preservar historial antiguo hasta verificar rescate y decidir posteriormente si archivarlo o eliminarlo.

## Candidatos, no aprobaciones de reutilización
| Pieza existente o propuesta | Acción | Condición |
|---|---|---|
| Modelo Prisma/PostgreSQL (aprox. 40 modelos al último inventario) | Comparar y adaptar | Cobertura completa de fichas originales, historia, versiones y restricciones |
| Usuarios, roles, permisos por empresa/local | Evaluar | No rompa autorización original ni privacidad médica |
| Auditoría de cambios | Evaluar | Integridad, desempeño, trazabilidad; sin PII en logs |
| Conciliación e identificadores de origen | Reusar ideas/pruebas | Identidad aprobada manualmente y contexto histórico |
| Importadores, backup y recuperación | Auditar cuidadosamente | Restauración real e idempotencia comprobadas |
| Pruebas de cálculo y segregación | Revisar y adaptar | Comparación directa con motor original y casos reales autorizados |
| Actualizador/etiqueta de versión | Rediseñar con cautela | Resolver fallos del antiguo controlador; no inventar instalación |
| UI de SAGVA Gestión Integral | **Descartar como base** | Solo reusar piezas invisibles y después de demostrar paridad |

## Proceso de rescate, INT-006
1. Describir problema concreto de la integración terminada; no agregar tecnología por moda.
2. Identificar archivo, commit, dependencias, contratos, permisos y cobertura de pruebas.
3. Probar en rama pequeña contra funcionamiento original y regresión.
4. Medir costo de mantenimiento, impacto en datos, interfaz y actualización.
5. Aprobar explícitamente incorporación; documentar reversión.

**No mezclar fase de rescate con INT-001**. La ventaja del nuevo proyecto es partir de algo que ya funciona, no reconstruir por adelantado.
