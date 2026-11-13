// Documento imprimible: el respaldo firmado se adjunta mediante el flujo PDF ya existente.
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function printEquipmentReceipt({workerName,entry,typeName}){
 if(!entry?.equipmentItems?.length)throw new Error('Sin implementos para imprimir.');
 const rows=entry.equipmentItems.map(x=>'<tr><td>'+escapeHtml(x.name)+'</td><td>'+Number(x.quantity)+'</td></tr>').join('');
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acta de entrega</title><style>
 body{font:15px/1.5 Arial,sans-serif;color:#111;margin:18mm}h1{text-align:center;font-size:21px}
 table{border-collapse:collapse;width:100%;margin:25px 0}td,th{border:1px solid #666;padding:10px;text-align:left}
 .sign{display:flex;gap:35px;margin-top:80px}.sign>div{border-top:1px solid #111;flex:1;text-align:center}
 @media print{@page{size:A4;margin:16mm}body{margin:0}}
 </style></head><body><h1>${escapeHtml(typeName)}</h1><p><b>Trabajador:</b> ${escapeHtml(workerName)}</p>
 <p><b>Fecha de entrega:</b> ${escapeHtml(entry.deliveredOn)}</p><p><b>Nº de registro:</b> ${Number(entry.id)}</p>
 <table><thead><tr><th>Implemento</th><th>Cantidad entregada</th></tr></thead><tbody>${rows}</tbody></table>
 <p>El trabajador declara recibir los elementos detallados. Observaciones adicionales deberán documentarse en el respaldo firmado.</p>
 <div class="sign"><div>Firma del trabajador</div><div>Firma de quien entrega</div></div>
 <script>window.addEventListener('load',()=>{window.focus();window.print();});<\/script></body></html>`;
 const popup=window.open('','_blank','width=850,height=1000');if(!popup)throw new Error('El navegador bloqueó la impresión.');
 popup.opener=null;popup.document.open();popup.document.write(html);popup.document.close();
}
