// Estado digital y respaldo físico son independientes. Ninguno acredita validez legal.
export function documentEvidenceLabels(latest,status='UNVERIFIED'){
 const hasDigital=Boolean(latest?.attachments?.length),hasPhysical=status==='AVAILABLE';
 const digital=hasDigital?{text:'Carga digital',kind:'success'}:!hasPhysical?{text:'Sin documento cargado',kind:'danger'}:{text:'Sin carga digital',kind:'warning'};
 const physical=hasPhysical?{text:'Disponible en físico',kind:'success'}:status==='MISSING'?{text:'Sin respaldo físico disponible',kind:hasDigital?'warning':'danger'}:{text:'Físico sin verificar',kind:'warning'};
 return {digital,physical};
}
