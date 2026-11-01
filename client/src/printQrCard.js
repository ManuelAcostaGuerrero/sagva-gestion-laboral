export async function printQrCard(card) {
 if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(card?.qrDataUrl||''))throw new Error('No hay una imagen QR válida para imprimir.');
 const page=window.open('','_blank','width=600,height=720');
 if(!page)throw new Error('Permite ventanas emergentes para imprimir la tarjeta QR.');
 try {
  page.opener=null;
  const doc=page.document;doc.title='Tarjeta QR de asistencia';
  const style=doc.createElement('style');style.textContent='body{font:18px sans-serif;text-align:center;padding:24px;color:#000;background:#fff}img{width:300px;height:300px;display:block;margin:20px auto} @page{margin:15mm}';doc.head.append(style);
  const name=doc.createElement('h1');name.textContent=card.name||'Tarjeta personal';
  const img=doc.createElement('img');img.alt='QR personal de asistencia';img.width=360;img.height=360;
  const loaded=new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('No se pudo cargar el QR para imprimir.'));});
  img.src=card.qrDataUrl;doc.body.append(name,img);await loaded;
  if(img.decode)await img.decode();
  await new Promise(resolve=>page.requestAnimationFrame(()=>page.requestAnimationFrame(resolve)));
  page.addEventListener('afterprint',()=>page.close(),{once:true});page.focus();page.print();
 }catch(error){page.close();throw error;}
}
