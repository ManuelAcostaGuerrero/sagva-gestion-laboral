import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeExportRows, employeesToXml, employeesToXlsx, createEmployeeExport } from '../../../client/src/employeeExport.js';

const workers = [
  { id: 9, fullName: 'José & <Rojas>', documentId: '11.222.333-K',
    email: 'jose@example.com', positionName: 'Garzón', workAreaName: 'Barra',
    isActive: 1, extraJson: '{"diagnostico":"NO EXPORTAR"}', accessCodeHash: 'CLAVE_SECRETA' },
  { id: 2, fullName: '=SUM(1+1)', documentId: null, email: null,
    positionName: null, workAreaName: null, isActive: 0 }
];

test('Exporta lista mínima de trabajadores, incluidos inactivos, sin datos privados extra', () => {
  assert.deepEqual(employeeExportRows(workers)[1], ['2', '=SUM(1+1)', '', '', '', '', 'Inactivo']);
  const xml = employeesToXml(workers);
  assert.match(xml, /<trabajadores version="1" total="2">/);
  assert.match(xml, /José &amp; &lt;Rojas&gt;/);
  assert.match(xml, /11\.222\.333-K/);
  assert.doesNotMatch(xml, /diagnostico|NO EXPORTAR|CLAVE_SECRETA|extraJson|accessCodeHash/);
  assert.equal((xml.match(/<trabajador>/g) || []).length, 2);
  assert.match(employeesToXml([]), /total="0"/);
});

test('XLSX es un ZIP OOXML con hoja Trabajadores y texto literal, no fórmulas', async () => {
  const blob = employeesToXlsx(workers);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const files = new Map();
  let at = 0;
  while (at + 4 <= bytes.length && view.getUint32(at, true) === 0x04034B50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const name = decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength + extraLength;
    files.set(name, decoder.decode(bytes.subarray(start, start + size)));
    at = start + size;
  }
  assert.equal(files.size, 5);
  assert.ok(files.has('[Content_Types].xml'));
  assert.ok(files.has('xl/workbook.xml'));
  const sheet = files.get('xl/worksheets/sheet1.xml');
  assert.match(sheet, /dimension ref="A1:G3"/);
  assert.match(sheet, /t="inlineStr"/);
  assert.match(sheet, /José &amp; &lt;Rojas&gt;/);
  assert.match(sheet, /=SUM\(1\+1\)/);
  assert.doesNotMatch(sheet, /<f>|diagnostico|NO EXPORTAR|CLAVE_SECRETA/);
  assert.equal(view.getUint32(at, true), 0x02014B50); // ZIP central directory exists
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054B50);
});

test('Nombres de archivos consistentes en ambos sistemas y formato validado', () => {
  assert.match(createEmployeeExport([], 'xml', 'huella-original').filename, /^huella-original-trabajadores-\d{4}-\d{2}-\d{2}\.xml$/);
  assert.match(createEmployeeExport([], 'xlsx', 'sagva-laboral').filename, /^sagva-laboral-trabajadores-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.throws(() => createEmployeeExport([], 'csv'), /no admitido/);
});
