// Medidas aprobadas e invariables: tarjeta vertical, dos caras plegables idénticas.
// Se giran los pares enteros 90 grados solo para distribuirlos en hoja carta.
export const QR_CREDENTIAL_PRINT = Object.freeze({
  faceWidthMm: 54,
  faceHeightMm: 85,
  qrSizeMm: 28,
  unfoldedWidthMm: 108,
  unfoldedHeightMm: 85,
  letterWidthMm: 215.9,
  letterHeightMm: 279.4,
  printMarginMm: 12,
  perSheet: 4,
  maxBatch: 20
});

export function paginateQrCredentials(cards) {
  if (!Array.isArray(cards) || !cards.length || cards.length > QR_CREDENTIAL_PRINT.maxBatch)
    throw new Error('Selecciona entre 1 y 20 credenciales para imprimir.');
  const pages = [];
  for (let start = 0; start < cards.length; start += QR_CREDENTIAL_PRINT.perSheet)
    pages.push(cards.slice(start, start + QR_CREDENTIAL_PRINT.perSheet));
  return pages;
}

export function qrCredentialPrintCss() {
  return [
    '@page{size:letter;margin:12mm}',
    '*{box-sizing:border-box}',
    'html,body{padding:0;margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif}',
    '.qr-sheet{width:191.9mm;height:255.4mm;display:grid;grid-template-columns:85mm 85mm;grid-template-rows:108mm 108mm;column-gap:7mm;row-gap:9mm;align-content:center;justify-content:center;page-break-after:always;break-after:page;overflow:hidden}',
    '.qr-sheet:last-child{page-break-after:auto;break-after:auto}',
    '.qr-slot{width:85mm;height:108mm;position:relative;overflow:visible}',
    '.qr-pair{position:absolute;left:85mm;top:0;width:108mm;height:85mm;display:flex;flex-wrap:nowrap;transform-origin:top left;transform:rotate(90deg);outline:0.18mm dashed #333;outline-offset:0.7mm;break-inside:avoid;page-break-inside:avoid}',
    '.qr-pair:after{content:"";position:absolute;left:54mm;top:0;width:0;height:85mm;border-left:0.18mm dashed #fff;pointer-events:none;z-index:5}',
    '.qr-face{position:relative;width:54mm;height:85mm;flex:0 0 54mm;overflow:hidden;background:#050505;color:#fff;isolation:isolate}',
    '.qr-face-art{position:absolute;inset:0;width:54mm;height:85mm;display:block;z-index:0}',
    '.qr-face-brand{position:absolute;left:2mm;top:18.2mm;width:50mm;text-align:center;color:#fff;font-size:12pt;line-height:1.05;letter-spacing:-0.2pt;font-weight:800;white-space:nowrap;z-index:1}',
    '.qr-face-subtitle{position:absolute;left:2mm;top:25.2mm;width:50mm;text-align:center;color:#fff;font-size:5.7pt;font-weight:750;letter-spacing:1.9pt;z-index:1}',
    '.qr-face-name{position:absolute;left:3.5mm;top:32mm;width:47mm;height:7.6mm;display:flex;align-items:center;justify-content:center;padding:0 1.1mm;margin:0;border-radius:3.5mm;background:#fff;color:#080808;font-size:8.6pt;line-height:1.1;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:1}',
    '.qr-face-role{position:absolute;left:7mm;top:40.8mm;width:40mm;height:5.6mm;display:flex;align-items:center;justify-content:center;padding:0 0.7mm;border-radius:2.8mm;background:#df0c16;color:#fff;font-size:7pt;line-height:1;font-weight:750;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:1}',
    '.qr-face-image{position:absolute;left:13mm;top:47mm;width:28mm;height:28mm;max-width:none;max-height:none;padding:0;margin:0;background:#fff;object-fit:fill;border:0;image-rendering:pixelated;z-index:2}',
    '.qr-face-footer{position:absolute;left:6.2mm;top:76.4mm;width:41.6mm;height:6mm;border:0.35mm solid #fff;border-radius:2mm;display:flex;align-items:center;justify-content:center;gap:1.2mm;font-size:5.8pt;line-height:1;font-weight:750;color:#fff;white-space:nowrap;z-index:1}',
    '.qr-face-footer-divider{height:3.3mm;border-left:0.4mm solid #ed1d24}',
    '@media screen{body{background:#e9e9e9;padding:12px}.qr-sheet{margin:12px auto;background:#fff;box-shadow:0 1px 10px #999}}',
    '@media print{html,body{width:auto;height:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}.qr-sheet{margin:0;box-shadow:none}}'
  ].join('\n');
}
