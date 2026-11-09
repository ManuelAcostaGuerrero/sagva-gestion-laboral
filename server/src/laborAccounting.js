// Precarga regulatoria: las tasas son registros versionados, nunca se
// actualizan sobrescribiendo una liquidación ni se eliminan valores históricos.
export const LABOR_MIGRATION='20261109_022_labor_accounting';
const SP='https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9897.html';
const SALUD='https://www.superdesalud.gob.cl/preguntas-frecuentes/cual-es-la-cotizacion-legal-para-salud-y-en-que-plazo-deben-ser-declaradas-y-pagadas/';
const ISAPRES='https://www.superdesalud.gob.cl/registro/isapres/';
const TOPES='https://www71.spensiones.cl/portal/institucional/594/w3-article-16921.html';
const TOPES_ENE='https://www.spensiones.cl/portal/institucional/594/w3-article-16885.html';
const REFORMA='https://previsionsocial.gob.cl/superintendencia-de-pensiones-publica-norma-en-consulta-para-regular-nueva-cotizacion-del-empleador/';
export const officialLaborSources={SP,SALUD,ISAPRES,TOPES,TOPES_ENE,REFORMA};

export async function migrateLaborAccounting(db){
 const [applied]=await db.execute('SELECT id FROM schema_migrations WHERE id=?',[LABOR_MIGRATION]);
 if(applied.length)return;
 await db.execScript(
  "CREATE TABLE labor_entities ("+
  "id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK(kind IN ('AFP','ISAPRE','FONASA')),"+
  "code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),"+
  "revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),"+
  "updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));"+
  "CREATE TABLE labor_entity_history ("+
  "id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id INTEGER NOT NULL REFERENCES labor_entities(id) ON DELETE RESTRICT,"+
  "before_json TEXT, after_json TEXT NOT NULL, reason TEXT NOT NULL, changed_by INTEGER REFERENCES admins(id),"+
  "changed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));"+
  "CREATE TABLE labor_parameter_versions ("+
  "id INTEGER PRIMARY KEY AUTOINCREMENT, metric TEXT NOT NULL,"+
  "entity_id INTEGER REFERENCES labor_entities(id) ON DELETE RESTRICT,"+
  "value_hundredths INTEGER NOT NULL CHECK(value_hundredths>=0 AND value_hundredths<=10000000000),"+
  "unit TEXT NOT NULL CHECK(unit IN ('PERCENT','UF','CLP')),"+
  "effective_from TEXT NOT NULL, reason TEXT NOT NULL, source_url TEXT,"+
  "created_by INTEGER REFERENCES admins(id), created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));"+
  "CREATE INDEX labor_parameter_asof ON labor_parameter_versions(metric,entity_id,effective_from,id);"
 );
 const afps=[
   ['CAPITAL','AFP CAPITAL',144],['CUPRUM','AFP CUPRUM',144],
   ['HABITAT','AFP HABITAT',127],['MODELO','AFP MODELO',58],
   ['PLANVITAL','AFP PLANVITAL',116],['PROVIDA','AFP PROVIDA',145],
   ['UNO','AFP UNO',46]
 ];
 const isapres=[
  ['BANMEDICA','BANMÉDICA'],['COLMENA','COLMENA GOLDEN CROSS'],
  ['CONSALUD','CONSALUD'],['CRUZ_BLANCA','CRUZ BLANCA'],
  ['NUEVA_MASVIDA','NUEVA MASVIDA'],['VIDA_TRES','VIDA TRES'],
  ['ESENCIAL','ESENCIAL'],['ISALUD','ISALUD (CERRADA)'],
  ['CRUZ_DEL_NORTE','CRUZ DEL NORTE (CERRADA)'],['FUNDACION','FUNDACIÓN (CERRADA)']
 ];
 const ids={};
 for(const [code,name,commission] of afps){
  const [created]=await db.execute('INSERT INTO labor_entities(kind,code,name) VALUES(?,?,?)',
    ['AFP',code,name]);
  ids[code]=created.insertId;
  await seed(db,'AFP_COMISION',created.insertId,commission,'PERCENT','2025-10-01',SP);
 }
 for(const [code,name] of isapres){
  await db.execute('INSERT INTO labor_entities(kind,code,name) VALUES(?,?,?)',['ISAPRE',code,name]);
 }
 await db.execute('INSERT INTO labor_entities(kind,code,name) VALUES(?,?,?)',
   ['FONASA','FONASA','FONASA']);
 await seed(db,'AFP_OBLIGATORIA',null,1000,'PERCENT','2026-01-01',SP);
 await seed(db,'SALUD_LEGAL',null,700,'PERCENT','2026-01-01',SALUD);
 await seed(db,'TOPE_PREVISION_UF',null,8990,'UF','2026-01-01',TOPES_ENE);
 await seed(db,'TOPE_CESANTIA_UF',null,13510,'UF','2026-01-01',TOPES_ENE);
 await seed(db,'TOPE_PREVISION_UF',null,9000,'UF','2026-02-01',TOPES);
 await seed(db,'TOPE_CESANTIA_UF',null,13520,'UF','2026-02-01',TOPES);
 // Porcentajes de los componentes empleador, en centésimas de punto porcentual.
 // EMPLEADOR_TOTAL ya incluye los demás componentes: NUNCA sumar otra vez.
 const employer=[
  ['2025-08-01',100,10,0,90],
  ['2026-08-01',350,10,90,250],
  ['2027-08-01',425,25,150,250],
  ['2028-08-01',500,100,150,250],
  ['2029-08-01',570,170,150,250],
  ['2030-08-01',640,240,150,250],
  ['2031-08-01',710,310,150,250],
  ['2032-08-01',780,380,150,250],
  ['2033-08-01',850,450,150,250]
 ];
 for(const [date,total,account,crp,fapp] of employer){
   for(const [code,value] of [['EMPLEADOR_TOTAL',total],['EMPLEADOR_CUENTA',account],
     ['EMPLEADOR_CRP',crp],['EMPLEADOR_FAPP_SIS',fapp]]){
     await seed(db,code,null,value,'PERCENT',date,REFORMA);
   }
 }
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[LABOR_MIGRATION]);
}

async function seed(db,metric,entityId,valueHundredths,unit,effectiveFrom,sourceUrl){
 await db.execute(
   'INSERT INTO labor_parameter_versions(metric,entity_id,value_hundredths,unit,effective_from,reason,source_url) VALUES(?,?,?,?,?,?,?)',
   [metric,entityId,valueHundredths,unit,effectiveFrom,'PRECARGA INICIAL - verificar normativa antes de liquidar',sourceUrl]
 );
}
