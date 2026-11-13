import test from 'node:test';
import assert from 'node:assert/strict';
import {remainingKioskSeconds} from '../../../client/src/kioskCountdown.js';

test('Cuenta regresiva del comprobante 10 a 0 segundos',()=>{
 const end=100000;
 assert.equal(remainingKioskSeconds(end,90000),10);
 assert.equal(remainingKioskSeconds(end,90999),10);
 assert.equal(remainingKioskSeconds(end,91000),9);
 assert.equal(remainingKioskSeconds(end,99000),1);
 assert.equal(remainingKioskSeconds(end,99999),1);
 assert.equal(remainingKioskSeconds(end,100000),0);
 assert.equal(remainingKioskSeconds(end,101000),0);
});
