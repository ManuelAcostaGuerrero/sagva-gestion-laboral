// Lote imprimible de hasta 20 credenciales nuevas. No genera QR en cliente.
const qrImage=/^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
export async function printQrCards(cards) {
  if(!Array.isArray(cards)||!cards.length||cards.length>20||
     cards.some(card=>!qrImage.test(card?.qrDataUrl||'')))
    throw new Error('No hay tarjetas QR válidas para imprimir.');
  const page=window.open('','_blank','width=960,height=850');
  if(!page)throw new Error('Permite ventanas emergentes para imprimir varias tarjetas.');
  try {
    page.opener=null;
    const doc=page.document;
    doc.title='Tarjetas personales QR de Asistencia';
    const style=doc.createElement('style');
    style.textContent=[
      '@page { size:A4; margin:10mm; }',
      '* { box-sizing:border-box; }',
      'body { margin:0; background:white; color:#102722; font:12px Arial,sans-serif; }',
      '.sheet { display:grid; grid-template-columns:85.6mm 85.6mm; column-gap:6mm; row-gap:5mm; justify-content:start; }',
      '.card { width:85.6mm; height:54mm; border:0.3mm solid #bbcfc4; border-radius:2mm; display:flex; align-items:center; padding:3mm; gap:2.5mm; break-inside:avoid; page-break-inside:avoid; overflow:hidden; background:white; }',
      '.qr { width:45mm; height:45mm; display:block; flex:none; object-fit:contain; }',
      '.detail { min-width:0; flex:1; overflow-wrap:anywhere; }',
      '.detail .brand { font:bold 10px Arial,sans-serif; letter-spacing:.04em; margin-bottom:3mm; }',
      '.detail .name { font:bold 12px Arial,sans-serif; line-height:1.17; text-transform:uppercase; }',
      '.detail .hint { font:9px Arial,sans-serif; margin-top:3mm; }',
      '@media screen { body { padding:12mm; } .card { box-shadow:0 1px 5px #ddd; } }',
      '@media print { body { padding:0; } .card { box-shadow:none; } }'
    ].join('');
    doc.head.append(style);
    const sheet=doc.createElement('div');sheet.className='sheet';
    const pending=[];
    for(const card of cards){
      const item=doc.createElement('article');item.className='card';
      const image=doc.createElement('img');image.className='qr';image.alt='QR de asistencia';
      const loaded=new Promise((resolve,reject)=>{
        image.onload=resolve;image.onerror=()=>reject(new Error('No se pudo cargar una tarjeta QR.'));});
      image.src=card.qrDataUrl;
      const detail=doc.createElement('div');detail.className='detail';
      const brand=doc.createElement('div');brand.className='brand';brand.textContent='ASISTENCIA';
      const name=doc.createElement('div');name.className='name';name.textContent=card.name||'Trabajador';
      const hint=doc.createElement('div');hint.className='hint';hint.textContent='Tarjeta personal · uso exclusivo';
      detail.append(brand,name,hint);item.append(image,detail);sheet.append(item);
      pending.push(loaded.then(()=>image.decode?image.decode():undefined));
    }
    doc.body.append(sheet);
    await Promise.all(pending);
    await new Promise(resolve=>page.requestAnimationFrame(()=>page.requestAnimationFrame(resolve)));
    page.addEventListener('afterprint',()=>page.close(),{once:true});
    page.focus();page.print();
  }catch(e){page.close();throw e;}
}
