# Etapa 2 — Root y permisos individuales (primera entrega de seguridad)

**Solicitada el 10-11-2026. PR de revisión; no habilitada en instalaciones ni fusionada a main.**

## Implementado en este PR

- Migración **aditiva** `20261110_025_individual_access` con perfiles separados de la columna heredada `admins.role`, concesiones/denegaciones individuales y auditoría. No se pierde ninguna cuenta, contraseña o rol antiguo.
- Autenticación reevalúa roles y concesiones desde la base de datos **en cada solicitud**, para aplicar revocaciones sin caducar el JWT.
- Root puede consultar usuarios, asignar perfil de Contabilidad, conceder/denegar permisos individuales, consultar y revocar historial desde **Seguridad → Root · Permisos individuales**. Cada asignación tiene motivo y vencimiento opcional.
- El rol existente `admin` **no se convierte automáticamente en Root**. El propietario debe configurar en el entorno privado `SAGVA_ROOT_USER_ID` con el **ID existente** de su cuenta `admin`, verificar respaldo local y reiniciar. Si ya hay Root, la variable no puede trasladar Root a otra cuenta.
- Una vez creado Root, los cambios de usuarios y parámetros legales dejan de estar abiertos a otras cuentas `admin` legadas. Contabilidad solo puede editar parámetros si Root concede `labor.parameters.manage`; permisos de lectura y escritura bancaria están separados.
- El perfil Administrador Local **todavía no se puede activar**: requiere primero aplicar y probar filtros por empresa/sucursal **en TODAS las rutas de personal, documentos, marcaciones, exportaciones y reportes**, no solo ocultar menús. El backend devuelve error controlado, evitando la filtración cruzada.
- Se conservan los mecanismos temporales de IDs autorizados para parámetros/bancos **solo mientras no exista Root**, para no bloquear a los usuarios locales antes de una transición aprobada. Root puede otorgar permisos individuales después.

## Límites conocidos que bloquean producción

- Las concesiones mediante UI son **GLOBAL** por ahora. La base admite COMPANY/BRANCH, pero **no** se deben habilitar esas variantes hasta que los endpoints de cada dominio comprueben el ámbito para cada operación. Un permiso de lectura de banco no concede edición.
- Solo se protegen de forma granular los endpoints conectados en este PR: **parámetros previsionales, catálogos/beneficios centrales, banco personal** y nuevas funciones de administración de acceso. Otros módulos mantienen sus autorizaciones históricas y requieren auditoría antes de activar `admin_local`.
- Las rutas genéricas antiguas todavía necesitan revisión de alcance y controles de privilegios. El propietario debe revisar y aprobar política antes de fusionar.
- La clave `SAGVA_BANK_DATA_KEY` **nunca se imprime, rota o genera automáticamente**; debe mantenerse en entorno seguro y respaldarse de forma cifrada por separado. La pérdida de esa clave imposibilita descifrar cuentas ya guardadas.
- Probar CI, restauración en copia, navegador, Windows, móvil HTTPS y revisión de propietario antes de actualizar manualmente.

## Pruebas esperadas

- Sin Root, se mantiene acceso de transición y nadie recibe rol nuevo por accidente.
- Root solo aparece cuando se configura explícitamente el ID válido de un admin preexistente.
- Una cuenta de Contabilidad puede recibir solo un permiso; otra del mismo perfil permanece igual.
- DENY prevalece sobre ALLOW, revocación efectiva en la siguiente solicitud con el mismo token.
- Root no puede degradar su última cuenta; roles locales quedan bloqueados hasta la política multiempresa.
- Comprobar API contra accesos directos, no solo que el menú oculte controles.
