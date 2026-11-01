import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingFileSections, canCloseAfterValidation, showReviewAction} from '../../../client/src/employeeFileReview.js';

test('Guardar correctamente elimina la advertencia de la ficha general', () => {
  assert.deepEqual(pendingFileSections({}), []);
  assert.deepEqual(pendingFileSections({general:true}), ['Ficha general']);
  assert.deepEqual(pendingFileSections({general:false,medical:false,contract:false}), []);
});

test('Solo hay advertencia si quedaron cambios reales en otra pestaña', () => {
  assert.deepEqual(pendingFileSections({medical:true}), ['Ficha médica']);
  assert.deepEqual(pendingFileSections({contract:true}), ['Condiciones contractuales']);
  assert.deepEqual(pendingFileSections({general:true,medical:true,contract:true}),
    ['Ficha general','Ficha médica','Condiciones contractuales']);
});

test('Al completar y validar se cierra la ficha si no hay cambios ajenos sin guardar', () => {
  assert.equal(canCloseAfterValidation({completed:true,validated:true}), true);
  assert.equal(canCloseAfterValidation({completed:false,validated:true}), false);
  assert.equal(canCloseAfterValidation({completed:true,validated:false}), false);
  assert.equal(canCloseAfterValidation({completed:true,validated:true,medical:true}), false);
  assert.equal(canCloseAfterValidation({completed:true,validated:true,contract:true}), false);
});

test('Control de revisión temporal: aparece solo en fichas aún no validadas', () => {
  assert.equal(showReviewAction({status:'NO_VALIDADO'}), true);
  assert.equal(showReviewAction({status:'VALIDADO'}), false);
  assert.equal(showReviewAction(), true);
});
