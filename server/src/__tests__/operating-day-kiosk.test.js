import test from 'node:test';import assert from 'node:assert/strict';
import {operatingDay,recommendType} from '../attendanceOperatingDay.js';
test('23:00 y 01:00 siguen el mismo día operativo hasta 06:00',()=>{
 assert.deepEqual(operatingDay('2026-11-13 23:00:00'),operatingDay('2026-11-14 01:00:00'));
 assert.equal(operatingDay('2026-11-14 05:59:59').date,'2026-11-13');
 assert.equal(operatingDay('2026-11-14 06:00:00').date,'2026-11-14');
 assert.equal(operatingDay('2026-11-14 06:00:00').start,'2026-11-14 06:00:00');
});
test('recomendación por última marcación no cierra turnos ni bloquea tipos alternativos',()=>{
 assert.equal(recommendType([]).recommendedType,'entrada');
 for(const [last,want] of [['entrada','salida_colacion'],['salida_colacion','entrada_colacion'],['entrada_colacion','salida'],['salida',null]])assert.equal(recommendType([{type:last}]).recommendedType,want);
});
