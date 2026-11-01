import test from 'node:test';
import assert from 'node:assert/strict';
import {validIsoDate, displayDate, maskDate, isoFromDisplay, inRange} from '../../../client/src/dateFormat.js';

test('fecha DD/MM/AAAA siempre limita el año a cuatro dígitos',()=>{
  assert.equal(maskDate('0310222222'),'03/10/2222');
  assert.equal(maskDate('03/10/2026222'),'03/10/2026');
  assert.equal(maskDate('03102026'),'03/10/2026');
  assert.equal(maskDate('3'),'3');
  assert.equal(maskDate(''), '');
  assert.equal(maskDate('abc'), '');
  assert.equal(isoFromDisplay('03/10/2026'),'2026-10-03');
  assert.equal(displayDate('2026-10-03'),'03/10/2026');
  assert.equal(isoFromDisplay('03/10/222222'),'');
  assert.equal(validIsoDate('222222-10-03'),false);
  assert.equal(validIsoDate('2026-10-03'),true);
});
test('fecha rechaza días, meses y límites inválidos antes de actualizar el valor ISO',()=>{
  for(const text of ['31/02/2026','29/02/2025','00/10/2026','01/13/2026','01/01/0000','1/1/2026','2026-10-03']){
    assert.equal(isoFromDisplay(text),'',text);
  }
  assert.equal(isoFromDisplay('29/02/2024'),'2024-02-29');
  assert.equal(inRange('2026-10-03','2026-10-01','2026-10-31'),true);
  assert.equal(inRange('2026-10-03','2026-10-04','2026-10-31'),false);
  assert.equal(inRange('2026-10-03',undefined,'2026-10-02'),false);
  assert.equal(displayDate('99999-10-03'),'');
});
