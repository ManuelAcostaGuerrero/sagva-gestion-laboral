# Habilitación local de cifrado bancario — 10-11-2026

Código instalado: `03688b8`. Entorno Windows, SAGVA Gestión Laboral local.

## Diagnóstico y corrección

El servidor no tenía configurada la clave de cifrado. Se verificó privadamente que no había cuentas ni historial cifrado existentes antes de generar una clave inicial; no se reemplazó una clave anterior. Respaldo SQLite consistente con integridad y referencias verificados antes del cambio. Clave aleatoria de 256 bits configurada únicamente en el entorno privado del servidor. Copia de recuperación protegida mediante Windows DPAPI, recuperada y comparada correctamente bajo el usuario autorizado; ACL restringida. Esta copia depende de ese usuario/equipo Windows y no acredita recuperación externa.

Se reiniciaron exclusivamente los procesos identificados de Gestión Laboral. El servidor respondió correctamente en el puerto local 5183.

## Resultados ejecutados

- Cifrado AES-256-GCM y descifrado con un objeto sintético: correcto.
- Alteración del tag autenticado rechazada: correcto.
- API real `bank-capability` con sesión Root: HTTP 200, lectura y escritura habilitadas.
- No se guardaron cuentas bancarias ni se modificaron fichas de trabajadores para probar.
- No hubo cambio de código ni rotación de JWT, claves de usuarios o secretos anteriores.

La comprobación visual del formulario y el registro de una cuenta autorizada por su titular quedan para el propietario. No publicar claves ni datos bancarios. Producción y recuperación externa siguen sin acreditarse.
