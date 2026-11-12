// Impresión local exclusivamente por gesto del trabajador; no almacena credenciales ni PII.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function printAttendanceReceipt(bundle){
  if(!bundle?.receipt||!bundle?.checksum)return false;
  const r=bundle.receipt,w=r.workplace||{},link=new URL(
    '/api/attendance/receipts/'+encodeURIComponent(r.recordId)+'/verify?checksum='+encodeURIComponent(bundle.checksum),
    window.location.origin).href;
  const items=[
    ['Folio',r.recordId],['Fecha',r.date],['Hora',r.time],['Marcación',r.type],
    ['Método',r.markMethod],['Trabajador',r.worker?.name],['RUT trabajador',r.worker?.rut],
    ['Empleador',r.employer?.name],['RUT empleador',r.employer?.rut],
    ['Lugar',w.name],['Dirección informada',w.address],
    ['Comuna',w.commune],['Ciudad',w.city],['Región',w.region],
    ['Régimen excepcional',r.exceptionalRegime],
    ['SHA-256 marcación',r.attendanceProof?.checksum],
    ['SHA-256 comprobante',bundle.checksum],
    ['Firma HMAC',bundle.signature||'No configurada']
  ];
  const rows=items.map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value||'Pendiente')+'</dd>').join('');
  const warnings=(r.reviewWarnings||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante de asistencia #'+
    esc(r.recordId)+'</title><style>body{font:15px system-ui,sans-serif;max-width:800px;margin:26px auto;padding:0 18px;color:#142b24}'+
    'dl{display:grid;grid-template-columns:180px 1fr;border-top:1px solid #bbb}dt,dd{padding:9px 0;margin:0;border-bottom:1px solid #ddd;overflow-wrap:anywhere}'+
    'dt{font-weight:bold}a{overflow-wrap:anywhere}aside{background:#fff7e4;padding:12px}'+
    '@media print{body{margin:0.8cm;padding:0;font-size:12px}}</style></head><body><h1>Comprobante de marcación</h1>'+
    '<p>SAGVA Gestión Laboral · Comprobante emitido por el sistema</p><dl>'+rows+'</dl>'+
    (warnings?'<aside><strong>Datos pendientes de validación</strong><ul>'+warnings+'</ul></aside>':'')+
    '<p>Verificación de autenticidad e integridad: <a href="'+esc(link)+'">'+esc(link)+'</a></p>'+
    '<p>Este comprobante no reemplaza la certificación y autorización de la Dirección del Trabajo.</p></body></html>';
  const opened=window.open('','_blank');
  if(!opened)return false;
  opened.document.open();opened.document.write(html);opened.document.close();opened.focus();
  opened.print();
  return true;
}
