import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUpdateSource} from '../../../tools/validate-update.mjs';

test('Prevalidación detecta JSX truncado y JavaScript/manifiestos incorrectos antes de instalar',()=>{
  validateUpdateSource('client/src/Planner.jsx','export default function Planner(){return <div>{true && <span>Turno</span>}</div>;}');
  assert.throws(()=>validateUpdateSource('client/src/Planner.jsx','export default function Planner(){return <div>{true && ('),/Unexpected end|Expected/);
  validateUpdateSource('server/src/check.js','export const value = 1;');
  assert.throws(()=>validateUpdateSource('server/src/check.js','export const value = ;'),/SyntaxError/);
  validateUpdateSource('package.json','{"name":"test"}');
  assert.throws(()=>validateUpdateSource('package.json','{"name":'),SyntaxError);
});
