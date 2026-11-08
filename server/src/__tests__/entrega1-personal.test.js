import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesEmployeeSearch } from '../../../client/src/employeeSearch.js';
import { getRegions, getProvinces, getCommunes, territoryPathValid, CHILE_TERRITORY } from '../../../shared/chileTerritory.js';
import { companyPayload } from '../companyProfiles.js';

test('Entrega 1: buscador independiente del formato RUT sin modificar búsqueda textual', () => {
  const person={fullName:'MARÍA NÚÑEZ', company:'RED TAURUS', documentId:'12.345.678-5'};
  for(const term of ['12.345.678-5','12345678-5','12.345.6785','123456785','678-5','MARÍA','RED TAURUS']) {
    assert.equal(matchesEmployeeSearch(person,term),true,term);
  }
  assert.equal(matchesEmployeeSearch({...person,documentId:'12.345.678-K'},'12345678k'),true);
  assert.equal(matchesEmployeeSearch(person,'PEREZ'),false);
});

test('Entrega 1: catálogo encadenado completo y selectores sin localidades inventadas',()=>{
  assert.equal(CHILE_TERRITORY.length,16);
  assert.equal(CHILE_TERRITORY.reduce((n,r)=>n+r.provinces.length,0),56);
  assert.equal(CHILE_TERRITORY.reduce((n,r)=>n+r.provinces.reduce((m,p)=>m+p.communes.length,0),0),346);
  assert.ok(getRegions().some(x=>x.includes('BIOBÍO')));
  const biobio = getRegions().find(x=>x.includes('BIOBÍO'));
  assert.ok(getProvinces(biobio).includes('CONCEPCIÓN'));
  assert.ok(getCommunes(biobio,'CONCEPCIÓN').includes('TALCAHUANO'));
  assert.equal(territoryPathValid({region:biobio,province:'CONCEPCIÓN',commune:'TALCAHUANO'}),true);
  assert.equal(territoryPathValid({region:biobio,province:'ARICA',commune:'TALCAHUANO'}),false);
  assert.equal(territoryPathValid({region:'',province:'',commune:'TALCAHUANO'}),true); // histórico
});

test('Entrega 1: payload empresarial normaliza para validación sin inventar RUT',()=>{
  const company=companyPayload({legalName:'Empresa ensayo',taxId:'77.376.536-7',tradeName:'RED TAURUS'});
  assert.equal(company.legalName,'EMPRESA ENSAYO');
  assert.equal(company.taxId,'77.376.536-7');
});
