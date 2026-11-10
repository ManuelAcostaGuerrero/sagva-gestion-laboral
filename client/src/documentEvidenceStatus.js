// Estado digital y respaldo físico son independientes. Ninguno acredita validez legal.
export function documentEvidenceLabels(latest,status='UNVERIFIED'){
 const digital=latest?.attachments?.length
  ? {text:'PDF ingresado al sistema',kind:'success'}
  : latest ? {text:'Falta cargar PDF',kind:'warning'}
  : {text:'Sin entrega registrada',kind:'warning'};
 const physical=status==='AVAILABLE'
  ? {text:'Respaldo físico declarado',kind:'success'}
  : status==='MISSING' ? {text:'Sin respaldo físico disponible',kind:'danger'}
  : {text:'Existencia física sin verificar',kind:'muted'};
 return {digital,physical};
}
