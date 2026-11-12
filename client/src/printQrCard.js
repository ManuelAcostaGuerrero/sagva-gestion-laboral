import {printQrCards} from './printQrCards.js';

// La emisión individual usa exactamente la misma plantilla y medidas del lote.
export function printQrCard(card) {
  return printQrCards([card]);
}
