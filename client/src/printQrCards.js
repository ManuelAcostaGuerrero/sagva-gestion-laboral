import {paginateQrCredentials,qrCredentialPrintCss} from './qrCredentialPrintLayout.js';

const qrImage = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Ilustración vectorial integrada: no depende de fondos activados en la impresora.
const ART = [
  '<defs><linearGradient id="redWave" x1="0" x2="1"><stop stop-color="#3f0004"/><stop offset=".40" stop-color="#f90015"/><stop offset=".74" stop-color="#b7000a"/><stop offset="1" stop-color="#3a0006"/></linearGradient></defs>',
  '<rect width="540" height="850" fill="#060506"/>',
  '<path d="M0 0H210Q60 80 0 256Z" fill="url(#redWave)"/>',
  '<path d="M540 190Q485 340 345 385Q155 435 0 565V620Q183 474 359 453Q505 410 540 320Z" fill="url(#redWave)"/>',
  '<path d="M540 679Q390 782 115 850H310Q466 808 540 754Z" fill="#d70913"/>',
  '<path d="M0 758Q112 709 219 708Q112 754 0 832Z" fill="url(#redWave)"/>',
  '<path d="M162 67Q192 98 214 95Q231 85 222 71Q251 97 288 92Q315 88 337 70Q319 111 292 113Q314 125 329 156Q347 188 318 195Q304 196 289 187L276 204Q249 213 235 190L211 185Q203 174 219 155L234 134Q195 130 175 110Z" fill="#fc0019"/>',
  '<path d="M0 836H540" stroke="#ee1522" stroke-width="4"/>'
].join('');

function printableFace(doc, card, mainFace) {
  const face = doc.createElement('section');
  face.className = 'qr-face';
  const art = doc.createElementNS(SVG_NS,'svg');
  art.setAttribute('class','qr-face-art');
  art.setAttribute('viewBox','0 0 540 850');
  art.setAttribute('aria-hidden','true');
  art.innerHTML = ART;

  const brand = doc.createElement('div');
  brand.className = 'qr-face-brand';
  brand.textContent = 'RED TAURUS';
  const subtitle = doc.createElement('div');
  subtitle.className = 'qr-face-subtitle';
  subtitle.textContent = 'GASTRO-BAR';

  const name = doc.createElement(mainFace ? 'h1' : 'div');
  name.className = 'qr-face-name';
  name.textContent = String(card.name || 'TRABAJADOR').trim();
  name.title = name.textContent;

  const role = doc.createElement('div');
  role.className = 'qr-face-role';
  role.textContent = String(card.role || 'PERSONAL').trim();

  const img = doc.createElement('img');
  img.className = 'qr-face-image';
  img.alt = 'QR personal de asistencia de ' + name.textContent;
  img.width = 360;
  img.height = 360;
  const loaded = new Promise((resolve,reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('No se pudo cargar el QR para imprimir.'));
  });
  img.src = card.qrDataUrl;

  const footer = doc.createElement('div');
  footer.className = 'qr-face-footer';
  const left = doc.createElement('span');
  left.textContent = 'USO INTERNO';
  const divider = doc.createElement('span');
  divider.className = 'qr-face-footer-divider';
  const right = doc.createElement('span');
  right.textContent = 'ASISTENCIA';
  footer.append(left,divider,right);
  face.append(art,brand,subtitle,name,role,img,footer);
  return {face,loaded:loaded.then(() => img.decode ? img.decode() : undefined)};
}

export async function printQrCards(cards) {
  const pages = paginateQrCredentials(cards);
  if (cards.some(card => !qrImage.test(card?.qrDataUrl || '')))
    throw new Error('No hay códigos QR válidos para imprimir.');

  // Abrir antes de cualquier await para no perder la activación por clic.
  const page = window.open('','_blank','width=1100,height=920');
  if (!page) throw new Error('Permite ventanas emergentes para imprimir las credenciales.');
  try {
    page.opener = null;
    const doc = page.document;
    doc.title = 'RED TAURUS | Credenciales carta 100%';
    const style = doc.createElement('style');
    style.textContent = qrCredentialPrintCss();
    doc.head.append(style);
    const pending = [];
    for (const batch of pages) {
      const sheet = doc.createElement('main');
      sheet.className = 'qr-sheet';
      for (const card of batch) {
        const slot = doc.createElement('div');
        slot.className = 'qr-slot';
        const pair = doc.createElement('article');
        pair.className = 'qr-pair';
        for (const index of [0,1]) {
          const result = printableFace(doc,card,index === 0);
          pair.append(result.face);
          pending.push(result.loaded);
        }
        slot.append(pair);
        sheet.append(slot);
      }
      doc.body.append(sheet);
    }
    await Promise.all(pending);
    await new Promise(resolve => page.requestAnimationFrame(() => page.requestAnimationFrame(resolve)));
    page.addEventListener('afterprint',() => page.close(),{once:true});
    page.focus();
    page.print();
  } catch (error) {
    page.close();
    throw error;
  }
}
