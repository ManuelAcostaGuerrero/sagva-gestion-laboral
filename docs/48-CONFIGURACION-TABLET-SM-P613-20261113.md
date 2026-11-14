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

## Decisión operativa: tablet instalada fija en pared (14-11-2026)

- La **cámara trasera se descarta** porque quedará orientada hacia la pared. El kiosco usa **exclusivamente la frontal** (5 MP). Se retiró el botón de alternancia frontal/trasera del kiosco de pared. Se recomienda colocar el QR frente al lente, no en el centro físico de la tablet si la cámara está desplazada.
- Se mantiene el QR ampliado a **28 × 28 mm** (misma credencial y token). Antes de emitir códigos nuevos, usar **Reimprimir carnets existentes**, lo cual no invalida los anteriores.
- Para intentar ocultar la barra de estado con reloj, batería y controles del sistema, la PWA solicita `display: fullscreen` en el manifiesto. El botón **Activar pantalla tablet** también solicita Fullscreen API por gesto del usuario cuando está disponible. En Android, las barras pueden reaparecer al deslizar el borde o por restricciones del fabricante: no es modo kiosco administrado (MDM).
- **Actualizar la instalación de la PWA** y abrirla desde su ícono en la pantalla de inicio, no desde una pestaña normal; el cambio de manifiesto puede necesitar reinstalación. En Chrome normal Fullscreen API puede ocultar las barras mientras esté activa, pero no es garantía de persistencia.
- Reflejos físicos: bajar brillo y evitar contra luz directa; preferir funda/portacarnet mate, QR negro nítido en fondo blanco con zona de silencio intacta, lente frontal limpio. Ajustar la distancia de lectura y probar 3 usuarios distintos, dos condiciones de luz, pantalla instalada en el muro.
- No hay prueba física de lectura automática en la Galaxy Tab S6 Lite todavía. Si el QR de 28 mm sigue sin leerse por la frontal, considerar una plantilla con QR de 30–32 mm o un lector QR externo mirando al trabajador antes de invertir en otro hardware.


## Implementación P08: QR impreso de 30 mm (PR #43, 14-11-2026)

- La versión anterior de **28 × 28 mm** fue declarada funcional en prueba física por el propietario, pero con lectura algo lenta. P08 cambia únicamente la **impresión** a **30 × 30 mm** y reposiciona los elementos visuales; **no exige** cambiar tokens, volver a activar la terminal o sustituir la PWA.
- Para validación manual, tras integrar y actualizar la instalación, reimprimir **3 carnets existentes** (no usar «Emitir QR nuevos»), en carta al **100 %**. Medir con regla 30 × 30 mm en ambas caras y 54 × 85 mm cada cara. Usar el portacarnet real, sin brillo excesivo.
- Probar la **cámara frontal** de la SM-P613 montada en pared: cada carné 10 lecturas con buena iluminación y 10 con luz habitual. Comparar contra pruebas equivalentes del QR anterior de 28 mm. Registrar medianas de tiempo, fallos y lecturas erróneas sin divulgar códigos reales.
- Conservar carnets de 28 mm hasta verificar que 30 mm mejora efectivamente lectura y no causa problemas de impresión. Si no mejora, revertir solo CSS/tamaño de impresión; la identificación de trabajadores y sus marcas no debe alterarse.
- **Estado de aceptación física de 30 mm:** pendiente. Aprobación automática de CI no demuestra lectura en cámara física.
