// Exportación local de un listado mínimo de trabajadores. No incluye credenciales,
// huellas, documentos laborales, fichas médicas ni historiales.
const HEADERS = ['ID interno', 'Nombre completo', 'Documento', 'Correo', 'Cargo', 'Área', 'Estado'];
const FIELDS = ['id', 'nombre', 'documento', 'correo', 'cargo', 'area', 'estado'];
const encoder = new TextEncoder();
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function employeeExportRows(employees) {
  if (!Array.isArray(employees)) throw new TypeError('Listado de empleados inválido');
  return employees.map((person) => [
    String(person.id ?? ''),
    String(person.fullName ?? ''),
    String(person.documentId ?? ''),
    String(person.email ?? ''),
    String(person.positionName ?? ''),
    String(person.workAreaName ?? ''),
    person.isActive ? 'Activo' : 'Inactivo'
  ]);
}

function xmlEscape(value) {
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function employeesToXml(employees) {
  const rows = employeeExportRows(employees);
  const records = rows.map((row) =>
    '  <trabajador>' + row.map((value, i) => '<' + FIELDS[i] + '>' +
      xmlEscape(value) + '</' + FIELDS[i] + '>').join('') + '</trabajador>'
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<trabajadores version="1" total="' + rows.length + '">\n' + records + '\n</trabajadores>\n';
}

// Excel real (.xlsx), no un CSV renombrado: paquete OOXML ZIP sin dependencias.
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const value of bytes) {
    crc ^= value;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16(view, at, n) { view.setUint16(at, n, true); }
function u32(view, at, n) { view.setUint32(at, n >>> 0, true); }

function makeZip(entries) {
  const parts = [];
  const directory = [];
  let offset = 0;
  let directoryLength = 0;
  for (const [name, content] of entries) {
    const fileName = encoder.encode(name);
    const bytes = encoder.encode(content);
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + fileName.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034B50); u16(lv, 4, 20);
    u32(lv, 14, crc); u32(lv, 18, bytes.length); u32(lv, 22, bytes.length);
    u16(lv, 26, fileName.length);
    local.set(fileName, 30);
    parts.push(local, bytes);
    const central = new Uint8Array(46 + fileName.length);
    const cv = new DataView(central.buffer);
    u32(cv, 0, 0x02014B50); u16(cv, 4, 20); u16(cv, 6, 20);
    u32(cv, 16, crc); u32(cv, 20, bytes.length); u32(cv, 24, bytes.length);
    u16(cv, 28, fileName.length); u32(cv, 42, offset);
    central.set(fileName, 46);
    directory.push(central);
    directoryLength += central.length;
    offset += local.length + bytes.length;
  }
  const footer = new Uint8Array(22);
  const fv = new DataView(footer.buffer);
  u32(fv, 0, 0x06054B50);
  u16(fv, 8, entries.length); u16(fv, 10, entries.length);
  u32(fv, 12, directoryLength); u32(fv, 16, offset);
  return new Blob([...parts, ...directory, footer], { type: EXCEL_MIME });
}

function spreadsheetCells(values, rowNumber) {
  return values.map((value, index) =>
    '<c r="' + String.fromCharCode(65 + index) + rowNumber +
    '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(value) +
    '</t></is></c>'
  ).join('');
}

export function employeesToXlsx(employees) {
  const rows = [HEADERS, ...employeeExportRows(employees)];
  const sheetData = rows.map((row, index) =>
    '<row r="' + (index + 1) + '">' + spreadsheetCells(row, index + 1) + '</row>'
  ).join('');
  const sheet = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="A1:G' + rows.length + '"/><sheetData>' + sheetData + '</sheetData></worksheet>';
  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>';
  const relationships = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  const workbook = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Trabajadores" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const workbookRels = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>';
  return makeZip([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', relationships],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', workbookRels],
    ['xl/worksheets/sheet1.xml', sheet]
  ]);
}

export function createEmployeeExport(employees, format, source = 'asistencia') {
  if (!['xlsx', 'xml'].includes(format)) throw new Error('Formato de exportación no admitido');
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const filename = source + '-trabajadores-' + date + '.' + format;
  const blob = format === 'xlsx' ? employeesToXlsx(employees) :
    new Blob([employeesToXml(employees)], { type: 'application/xml;charset=utf-8' });
  return { filename, blob };
}
