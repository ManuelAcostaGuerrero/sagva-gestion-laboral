# Terminal Samsung SM-P613 · configuración y aceptación

**Objetivo:** utilizar Galaxy Tab S6 Lite SM-P613 como terminal fijo de SAGVA Gestión Laboral en Chile. **Esta guía no configura físicamente la tablet.** 

## Puesta en marcha

1. Conectar la tablet a una red Wi-Fi estable y a fuente de poder adecuada. Habilitar hora y zona horaria automáticas de Android.
2. En Android, revisar **Ajustes → Acerca de la tablet → Información de software → Número de compilación**. Si corresponde, pulsar varias veces para habilitar **Opciones de desarrollador** y activar **Permanecer activo mientras se carga**. Las opciones pueden variar según One UI. No asumir que la protección de batería permite pantalla encendida sin cargador.
3. Activar protección de batería disponible, reducir brillo y comprobar ventilación. Evaluar funcionamiento térmico continuo con soporte físico seguro.
4. Abrir SAGVA mediante **HTTPS con certificado confiable** en Chrome actualizado. Instalar la PWA «Agregar a pantalla de inicio / Instalar aplicación» para evitar barras del navegador.
5. Seleccionar **ASISTENCIA**, activar la terminal con código/QR emitido desde Administración, asignándola a la empresa correcta.
6. En el kiosco tradicional pulsar **Activar pantalla tablet**. Quedará persistido en ese navegador; al recargar abre el reloj gigante, incluso si existe una sesión administrativa guardada.
7. Pulsar **ESCANEAR QR**; predeterminada cámara frontal, opción de alternar a trasera. La lectura detiene la cámara antes de elegir el tipo.
8. Revisar opción recomendada grande y demás alternativas pequeñas. La marca se guarda **en la confirmación**, con hora oficial del servidor. La hora de identificación no es una marcación laboral.
9. Resultado y comprobante quedan visibles 10 segundos y después el sistema vuelve al reloj sin datos personales.
10. Configurar un kiosco administrado empresarial si se requiere impedir salida de la app. El anclaje de Android/PWA por sí solo no es seguridad fuerte.

## Día operativo
El rango comienza **06:00:00** hasta **05:59:59** del día siguiente. Ejemplo: viernes 23:00 a sábado 01:00 pertenece al viernes. Al iniciar sábado 06:00 se ofrece una nueva entrada; la jornada anterior abierta no se cierra, corrige ni borra automáticamente. Las intervenciones de Administración → Marcaciones requieren motivo y auditoría, con procedimiento DT A02 aún pendiente.

## Pruebas físicas obligatorias
- SM-P613 real, orientación vertical y horizontal; reloj visible y sin scroll accidental.
- Cámara frontal y trasera con las tarjetas QR realmente impresas; foco, distancia, luz nocturna y permiso HTTPS.
- Wi-Fi intermitente; comprobar que **nunca se anuncie como registrada** una petición que no fue confirmada por servidor; reintento idempotente.
- Prueba de entrada 23:00, colación 01:00 y corte 05:59:59/06:00.
- Pantalla encendida durante toda la operación y protección térmica/batería.
- Varias personas seguidas, confirmación a 10 segundos, revocación de terminal y acceso administrativo.
- Validación laboral independiente antes de uso como sistema legal de asistencia: Resolución Exenta DT 38/2024, mecanismos y rectificaciones, autorización/registro/certificación.

El sistema mantiene los mecanismos anteriores de activación, QR, PIN de respaldo y corrección administrativa. **No se ha probado ni configurado aquí la tablet física.**

## Mejoras de lectura de QR (14-11-2026)

- En Administración → Credenciales y terminales → Reimprimir carnets existentes, imprimir la misma credencial con el QR **28 × 28 mm**; el código interno sigue siendo el mismo y se conserva en la bóveda cifrada.
- En el kiosco, probar «Cambiar a cámara trasera» (8 MP, enfoque automático según Samsung) si el montaje lo permite. La cámara frontal queda predeterminada por su orientación hacia el trabajador, pero puede enfocar peor de cerca.
- Probar distancia aproximada inicial 20–40 cm y ajustar según nitidez: ni muy cerca ni tan lejos que se pierda detalle. Evitar reflejos de plastificado, sombra, pantalla sucia y contraluz.
- getUserMedia solicita resolución **ideal** 1280 × 720, no requisito obligatorio. No confundir un QR más grande en pantalla de PC con un código impreso físicamente mayor.
- Comprobar marca **solo después** de que se haya leído e identificado correctamente; nunca marcar al aumentar tamaño o al abrir la cámara.
