// Chromium REAL en runner GitHub, sobre web/API/SQLite beta persistente: nunca mock.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
if(process.env.SAGVA_LABOR_BETA_CI!=='1')throw Error('Sólo beta de CI autorizada.');
const {chromium,expect}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const config=JSON.parse(fs.readFileSync('.local/beta-dt.json','utf8'));
const ctx=JSON.parse(fs.readFileSync('.local/beta-context.json','utf8'));
assert.equal(config.purpose,'DT_TEST_ONLY');
assert.equal(config.webPort,5195);
const browser=await chromium.launch({headless:true,...(process.env.SAGVA_BROWSER_CHANNEL?{channel:process.env.SAGVA_BROWSER_CHANNEL}:{})});
const reports=[];
const suffix=crypto.randomBytes(3).toString('hex').toUpperCase();
async function check(label,fn){
 try{await fn();reports.push({label,status:'PASS'});console.log('PASS',label);}
 catch(e){reports.push({label,status:'FAIL',error:e.message});console.error('FAIL',label,e.message);throw e;}
}
let page;
try{
 const context=await browser.newContext({viewport:{width:1360,height:900}});
 await context.addInitScript(token=>localStorage.setItem('token',token),ctx.token);
 page=await context.newPage();
 page.setDefaultTimeout(12000);
 await check('1E menú Root y vista React funcional',async()=>{
  await page.goto('http://127.0.0.1:5195');
  await page.getByRole('button',{name:'Estructura laboral',exact:true}).waitFor();
  await page.getByRole('button',{name:'Estructura laboral',exact:true}).click();
  await expect(page.getByRole('region',{name:'Ciclo laboral versionado'})).toBeVisible();
  await expect(page.getByText('Modelo laboral por vigencias')).toBeVisible();
 });
 const mod=page.getByRole('region',{name:'Ciclo laboral versionado'});
 await expect(mod.getByLabel('Persona con identidad única')).toBeVisible();
 const local=mod.locator('details').filter({hasText:'1A. Locales'}).first();
 await check('1A registrar local desde UI, persistir y refrescar catálogo',async()=>{
  await local.locator('form').first().locator('select').first().selectOption(String(ctx.otherCompany));
  await local.getByLabel('Código de local',{exact:true}).fill('UITEST-'+suffix);
  await local.getByLabel('Nombre del local',{exact:true}).fill('LOCAL FICTICIO UI');
  await local.getByLabel('Dirección',{exact:true}).first().fill('DIRECCION UI FICTICIA');
  const saved=page.waitForResponse(r=>r.url().includes('/api/labor-structure/branches')&&r.request().method()==='POST');
  await local.getByRole('button',{name:'Registrar local'}).click();
  assert.equal((await saved).status(),201);
  await expect(local.locator('select').last()).toContainText('LOCAL FICTICIO UI');
 });
 await check('1B seleccionar persona existente y contratar sin duplicarla',async()=>{
  await mod.getByLabel('Persona con identidad única').selectOption(String(ctx.otherWorker));
  const hiring=mod.locator('details').filter({hasText:'1B. Contratación'}).first();
  await hiring.getByLabel('Empresa',{exact:true}).selectOption(String(ctx.otherCompany));
  await hiring.getByLabel('Fecha de ingreso').fill('2026-01-01');
  await hiring.getByLabel('Documento o evidencia de contratación').fill('CONTRATO SINTETICO '+suffix);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/labor-structure/employments')&&r.request().method()==='POST');
  await hiring.getByRole('button',{name:'Registrar relación confirmada'}).click();
  assert.equal((await saved).status(),201);
  await expect(hiring.locator('p').filter({hasText:'Estado:'})).toContainText('ACTIVE');
 });
 await check('1C asignación de cargo/local y sueldo desde UI',async()=>{
  const a=mod.locator('details').filter({hasText:'1C. Movimientos'}).first();
  await a.locator('summary').click();
  await a.getByLabel('Desde',{exact:true}).fill('2026-01-01');
  await a.getByLabel('Local de la empresa').selectOption({label:'LOCAL FICTICIO UI'});
  await a.getByLabel('Área',{exact:true}).selectOption(String(ctx.area));
  const catalog=await page.request.get('http://127.0.0.1:5195/api/labor-structure/catalog',
   {headers:{Authorization:'Bearer '+ctx.token}});
  assert.equal(catalog.status(),200);
  const position=(await catalog.json()).positions.find(p=>p.name===ctx.position);
  assert.ok(position);
  await a.getByLabel('Cargo',{exact:true}).selectOption(String(position.id));
  await a.getByLabel('Referencia del traslado o asignación').fill('ASIGNACION UI SINTETICA '+suffix);
  let saved=page.waitForResponse(r=>r.url().includes('/assignments')&&r.request().method()==='POST');
  await a.getByRole('button',{name:'Guardar nueva vigencia del cargo/local'}).click();
  assert.equal((await saved).status(),201);
  const c=mod.locator('details').filter({hasText:'1C–1D. Condiciones'}).first();
  await c.locator('summary').click();
  await c.getByLabel('Desde',{exact:true}).fill('2026-01-01');
  await c.getByLabel('Sueldo base (CLP)').fill('550000');
  await c.getByLabel('Horas semanales pactadas').fill('42');
  await c.getByLabel('Colación (minutos)').fill('60');
  await c.getByLabel('Régimen para evaluar la jornada').selectOption('GENERAL');
  await c.getByLabel('Documento/anexo que respalda las condiciones').fill('CONTRATO UI SINTETICO '+suffix);
  saved=page.waitForResponse(r=>r.url().includes('/conditions')&&r.request().method()==='POST');
  await c.getByRole('button',{name:'Registrar nueva versión contractual'}).click();
  assert.equal((await saved).status(),201);
 });
 await check('1E consulta histórica a fecha desde UI',async()=>{
  const history=mod.locator('details').filter({hasText:'1E. Historial'}).first();
  await history.getByLabel('Fecha de consulta').fill('2026-06-01');
  await history.getByRole('button',{name:'Consultar datos vigentes'}).click();
  await expect(history.getByText(/550000 CLP/).first()).toBeVisible();
  await expect(history.getByText('Relaciones (1)')).toBeVisible();
 });
 await page.screenshot({path:'.local/beta-labor-ui-desktop.png',fullPage:true});
 await check('1E vista móvil emulada sin error fatal',async()=>{
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.addInitScript(token=>localStorage.setItem('token',token),ctx.token);
  const phone=await mobile.newPage();
  await phone.goto('http://127.0.0.1:5195');
  await phone.getByRole('button',{name:'Estructura laboral',exact:true}).click();
  await expect(phone.getByText('Modelo laboral por vigencias')).toBeVisible();
  await phone.screenshot({path:'.local/beta-labor-ui-mobile-emulated.png',fullPage:true});
  await mobile.close();
 });
} catch(e){
 if(page)console.error('LABOR UI VISIBLE: '+(await page.locator('body').innerText().catch(()=>'' )).slice(0,2800));
 if(page)await page.screenshot({path:'.local/beta-labor-ui-error.png',fullPage:true}).catch(()=>{});
 process.exitCode=1;
} finally {
 await browser.close();
 fs.writeFileSync('.local/beta-labor-browser-results.json',JSON.stringify(reports,null,2));
 console.log('CHROMIUM LABOR:',reports.filter(x=>x.status==='PASS').length,'PASS /',reports.filter(x=>x.status==='FAIL').length,'FAIL');
}
