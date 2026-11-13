// Formulario impreso, nunca enviado a un servicio externo ni guardado automáticamente.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function printBankAuthorization(details){
 const fields=['workerName','workerRut','holderName','holderRut','bankName','accountType','accountNumber'];
 if(fields.some(name=>!String(details[name]??'').trim()))throw new Error('Completa los datos bancarios para generar el documento.');
 const x=name=>escapeHtml(details[name]);const date=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'});
 const page=`<!doctype html><html lang="es"><head><meta charset="utf-8">
 <title>Solicitud de pago en cuenta de tercero</title><style>
 body{font:15px/1.6 Arial,sans-serif;color:#111;margin:13mm 16mm;}h1{font-size:20px;text-align:center;margin:20px 0;}
 .field{border-bottom:1px solid #888;padding:7px 0}.note{font-size:12px;color:#444;margin-top:24px}
 .sign{display:flex;gap:30px;margin-top:85px}.sign div{flex:1;border-top:1px solid #222;text-align:center;padding-top:6px}
 @media print{@page{size:A4;margin:15mm}body{margin:0}}
 </style></head><body>
 <h1>SOLICITUD DE DEPÓSITO EN CUENTA DE UN TERCERO</h1>
 <p><b>Empleador:</b> ${x('employerName')||'________________________________'}</p>
 <p><b>Trabajador:</b> ${x('workerName')}<br><b>RUT:</b> ${x('workerRut')}</p>
 <p>Por medio de la presente solicito que se evalúe realizar el depósito de los pagos que correspondan a mi relación laboral en la siguiente cuenta, cuyo titular es una persona distinta de mí:</p>
 <div class="field"><b>Titular:</b> ${x('holderName')}</div>
 <div class="field"><b>RUT del titular:</b> ${x('holderRut')}</div>
 <div class="field"><b>Banco:</b> ${x('bankName')}</div>
 <div class="field"><b>Tipo de cuenta:</b> ${x('accountType')}</div>
 <div class="field"><b>Número de cuenta:</b> ${x('accountNumber')}</div>
 <p>Declaro haber proporcionado voluntariamente esta información y solicito su revisión y respaldo por parte de mi empleador.</p>
 <p>Fecha de emisión del formulario: ${escapeHtml(date)}</p>
 <div class="sign"><div>Firma del trabajador<br>Nombre y RUT</div><div>Recepción del empleador<br>Nombre y cargo</div></div>
 <p class="note"><b>Control interno:</b> esta solicitud firmada no acredita por sí sola que sea jurídicamente procedente pagar remuneraciones a un tercero. Debe revisarse la normativa laboral aplicable antes de utilizarla. Conservar PDF firmado en la ficha bancaria.</p>
 <script>window.addEventListener('load',()=>{window.focus();window.print();});<\/script>
 </body></html>`;
 const popup=window.open('','_blank','width=850,height=1000');
 if(!popup)throw new Error('El navegador bloqueó la ventana de impresión.');
 popup.opener=null;popup.document.open();popup.document.write(page);popup.document.close();
}
