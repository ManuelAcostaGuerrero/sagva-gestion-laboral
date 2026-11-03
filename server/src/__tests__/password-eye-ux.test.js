import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../../../client/src/PressToRevealPassword.jsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../../client/src/main.jsx', import.meta.url), 'utf8');

test('Ojo de clave: se muestra solo durante pulsación y vuelve a ocultarse al soltar, salir o perder foco', () => {
  assert.match(component, /type=\{revealed \? 'text' : 'password'\}/);
  assert.match(component, /onPointerDown=\{showOnPointerDown\}/);
  for (const action of ['onPointerUp', 'onPointerCancel', 'onPointerLeave', 'onLostPointerCapture', 'onBlur']) {
    assert.match(component, new RegExp(action + '=\\{hide\\}'));
  }
  assert.match(component, /onKeyDown=\{showOnKeyDown\}/);
  assert.match(component, /onKeyUp=\{hideOnKeyUp\}/);
  assert.match(component, /window\.addEventListener\('blur', hideOnBlur\)/);
  assert.match(component, /document\.addEventListener\('visibilitychange', hideOnVisibilityChange\)/);
  assert.doesNotMatch(component, /onClick=\{[^}]*setRevealed/);
});

test('Crear usuario exige confirmación idéntica antes de enviar y no expone la confirmación al API', () => {
  const start = main.indexOf('async function createAdminUser(event)');
  const end = main.indexOf('async function changeAdminRole', start);
  const body = main.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(body, /adminUserForm\.password !== confirmAdminUserPassword/);
  assert.ok(body.indexOf('return;') < body.indexOf("api('/admin/users'"));
  assert.match(body, /JSON\.stringify\(adminUserForm\)/);
  assert.match(body, /setConfirmAdminUserPassword\(''\)/);
  assert.match(main, /label="Confirmar clave inicial"/);
  assert.match(main, /Las claves no coinciden/);
  assert.match(main, /label="Clave" autoComplete="current-password"/);
});
