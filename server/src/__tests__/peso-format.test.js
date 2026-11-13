import test from 'node:test';import assert from 'node:assert/strict';
import {formatPeso,pesoDigits} from '../../../client/src/pesoFormat.js';
test('CLP formatea sin alterar número guardado',()=>{
 assert.equal(formatPeso(650000),'$ 650.000');assert.equal(formatPeso('1000000'),'$ 1.000.000');
 assert.equal(pesoDigits('$ 1.234.500'),'1234500');assert.equal(formatPeso(null),'');
});
