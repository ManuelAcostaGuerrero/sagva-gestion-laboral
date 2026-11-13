// Tiempo que resta para ocultar un comprobante de la terminal compartida.
// Usar una hora límite evita prolongar la privacidad si el navegador pausa intervalos.
export function remainingKioskSeconds(deadlineEpochMs,nowEpochMs=Date.now()){
 if(!Number.isFinite(deadlineEpochMs)||!Number.isFinite(nowEpochMs))return 0;
 return Math.max(0,Math.ceil((deadlineEpochMs-nowEpochMs)/1000));
}
