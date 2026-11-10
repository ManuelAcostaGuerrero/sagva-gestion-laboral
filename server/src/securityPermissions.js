export const ACCESS_MIGRATION='20261110_025_individual_access';
export const ACCESS_CATALOG=[
 ['security.access.manage','Seguridad','Gestionar perfiles y permisos'],
 ['labor.catalog.read','Contabilidad Laboral','Consultar catálogos previsionales'],
 ['labor.parameters.read','Contabilidad Laboral','Consultar parámetros y vigencias'],
 ['labor.parameters.manage','Contabilidad Laboral','Modificar tasas y parámetros'],
 ['labor.benefits.manage','Contabilidad Laboral','Configurar bancos y tramos familiares'],
 ['labor.fields.manage','Contabilidad Laboral','Configurar definiciones de campos'],
 ['personal.bank.read','Ficha','Ver cuenta bancaria'],
 ['personal.bank.write','Ficha','Registrar o modificar cuenta bancaria'],
 ['personal.contract.read','Ficha','Ver condiciones contractuales'],
 ['personal.contract.write','Ficha','Editar condiciones contractuales'],
 ['personal.file.read','Ficha','Ver datos generales'],
 ['personal.file.write','Ficha','Editar datos generales']
];
const allKeys=new Set(ACCESS_CATALOG.map(x=>x[0]));
export const permissionKnown=x=>allKeys.has(x);
export async function migrateAccessControl(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[ACCESS_MIGRATION]))[0].length)return;
 await db.execScript([
  "CREATE TABLE security_user_profiles (user_id INTEGER PRIMARY KEY REFERENCES admins(id) ON DELETE RESTRICT,profile TEXT NOT NULL CHECK(profile IN ('root','accounting','admin_local')),assigned_by INTEGER REFERENCES admins(id),assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE security_permission_overrides (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,permission_key TEXT NOT NULL,effect TEXT NOT NULL CHECK(effect IN ('ALLOW','DENY')),scope_kind TEXT NOT NULL CHECK(scope_kind IN ('GLOBAL','COMPANY','BRANCH')),company_id INTEGER REFERENCES company_profiles(id),branch TEXT,valid_until TEXT,reason TEXT NOT NULL,created_by INTEGER NOT NULL REFERENCES admins(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,revoked_at TEXT,revoked_by INTEGER REFERENCES admins(id));",
  "CREATE INDEX security_overrides_by_user ON security_permission_overrides(user_id,permission_key,revoked_at);"
 ].join('\n'));
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[ACCESS_MIGRATION]);
}
// ROOT se crea solo por autorización local explícita sobre cuenta ya existente.
// Si una cuenta root ya existe, cambiar variable de entorno no reasigna privilegios.
export async function bootstrapRoot(db){
 const [roots]=await db.execute("SELECT user_id FROM security_user_profiles WHERE profile='root' LIMIT 1");
 if(roots.length)return false;
 const id=String(process.env.SAGVA_ROOT_USER_ID||'').trim();
 if(!/^[1-9][0-9]*$/.test(id))return false;
 const [users]=await db.execute('SELECT id,role FROM admins WHERE id=?',[Number(id)]);
 if(!users.length||users[0].role!=='admin')throw new Error('SAGVA_ROOT_USER_ID debe indicar el ID de un usuario admin existente.');
 await db.execute("INSERT INTO security_user_profiles(user_id,profile) VALUES(?,'root')",[Number(id)]);
 return true;
}
export async function accessContext(db,id){
 const [roots]=await db.execute("SELECT 1 AS active FROM security_user_profiles WHERE profile='root' LIMIT 1");
 const [profiles]=await db.execute('SELECT profile FROM security_user_profiles WHERE user_id=?',[id]);
 const [grants]=await db.execute('SELECT id,permission_key AS key,effect,scope_kind AS scopeKind,company_id AS companyId,branch,valid_until AS validUntil FROM security_permission_overrides WHERE user_id=? AND revoked_at IS NULL',[id]);
 return {profile:profiles[0]?.profile||null,hasRoot:!!roots.length,grants};
}
function scopeMatch(g,scope){
 if(g.scopeKind==='GLOBAL')return true;
 if(!scope?.companyId||Number(scope.companyId)!==Number(g.companyId))return false;
 return g.scopeKind==='COMPANY'||String(scope.branch||'').trim()===String(g.branch||'').trim();
}
const set=value=>new Set(String(value||'').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s)));
export function permitted(admin,key,scope=null){
 if(!admin||!permissionKnown(key))return false;
 const profile=admin.profile;
 if(profile==='admin_local'&&key.startsWith('labor.')&&key.endsWith('.manage'))return false;
 if(key==='security.access.manage')return profile==='root';
 if(profile==='root')return true;
 const now=Date.now();
 const rules=(admin.grants||[]).filter(g=>g.key===key&&scopeMatch(g,scope)&&(!g.validUntil||Date.parse(g.validUntil)>now));
 if(rules.some(g=>g.effect==='DENY'))return false;
 if(rules.some(g=>g.effect==='ALLOW'))return true;
 if(profile==='accounting')return ['labor.catalog.read','labor.parameters.read'].includes(key);
 if(profile==='admin_local')return ['labor.catalog.read','labor.parameters.read'].includes(key);
 if(profile)return false;
 if(admin.role==='operator')return key==='labor.catalog.read';
 if(admin.role==='supervisor')return ['labor.catalog.read','labor.parameters.read'].includes(key);
 if(admin.role!=='admin')return false;
 if(key.startsWith('personal.bank.'))return !admin.hasRoot&&set(process.env.SAGVA_BANK_ACCESS_USER_IDS).has(String(admin.id));
 if(key==='labor.benefits.manage')return !admin.hasRoot&&set(process.env.SAGVA_CONFIGURATION_USER_IDS).has(String(admin.id));
 if(key==='labor.fields.manage')return false;
 if(key==='labor.parameters.manage')return !admin.hasRoot;
 return true;
}
export const requirePermission=key=>{
 if(!permissionKnown(key))throw Error('Permiso desconocido: '+key);
 return (req,res,next)=>permitted(req.admin,key)?next():res.status(403).json({message:'Acceso no autorizado.'});
};
