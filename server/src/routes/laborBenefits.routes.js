
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import {pool} from '../db.js';
import {runMigrations} from '../migrations.js';
import {recordAudit} from '../auditLog.js';
import {requireRoles} from '../auth.js';
import {asyncHandler} from '../asyncHandler.js';
import {mayConfigureLabor,restricted} from '../benefitSecurity.js';

export const laborBenefitsRouter=Router();
laborBenefitsRouter.use(requireRoles('admin','supervisor','operator'));
laborBenefitsRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
laborBenefitsRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const label=z.string().trim().min(2).max(120);
const reason=z.string().trim().min(10).max(500);
const bankCreate=z.object({code:z.string().trim().regex(/^[0-9A-Z_]{2,40}$/),name:label,reason,sourceUrl:z.string().url().max(500).optional()}).strict();
const bankUpdate=z.object({name:label,active:z.boolean(),revision:z.number().int().positive(),reason}).strict();
const tier=z.object({tier:z.number().int().min(1).max(4),incomeFrom:z.number().int().nonnegative(),incomeTo:z.number().int().nonnegative().nullable(),amountClp:z.number().int().nonnegative()});
const bandsSchema=z.object({effectiveFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),incomeReference:z.string().trim().min(5).max(150),reason,sourceUrl:z.string().url().max(500),tiers:z.array(tier).length(4)}).strict();
const fail=(msg,status=400)=>Object.assign(new Error(msg),{status});

laborBenefitsRouter.get('/banks',asyncHandler(async(req,res)=>{
  const [rows]=await pool.execute('SELECT id,code,name,active,revision,source_url AS sourceUrl FROM labor_banks ORDER BY active DESC,name');
  res.json({banks:rows.filter(x=>x.active||mayConfigureLabor(req.admin)).map(x=>({...x,active:!!x.active})),canManage:mayConfigureLabor(req.admin)});
}));
laborBenefitsRouter.post('/banks',restricted(mayConfigureLabor),asyncHandler(async(req,res)=>{
  const parsed=bankCreate.safeParse(req.body);if(!parsed.success)throw fail('Banco y motivo inválidos.');
  const data=parsed.data,db=await pool.getConnection();
  try{
    await db.beginTransaction();
    const [old]=await db.execute('SELECT id FROM labor_banks WHERE code=? OR upper(name)=upper(?)',[data.code,data.name]);
    if(old.length)throw fail('Banco ya registrado.',409);
    const [saved]=await db.execute('INSERT INTO labor_banks(code,name,source_url) VALUES(?,?,?)',
      [data.code,data.name.toLocaleUpperCase('es-CL'),data.sourceUrl||null]);
    await db.execute('INSERT INTO labor_bank_history(bank_id,after_json,reason,changed_by) VALUES(?,?,?,?)',
      [saved.insertId,JSON.stringify({code:data.code,name:data.name,active:true}),data.reason,req.admin.id]);
    await recordAudit(req.admin,'create','labor_bank',saved.insertId,{code:data.code,reason:data.reason},db);
    await db.commit();res.status(201).json({id:saved.insertId});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
laborBenefitsRouter.put('/banks/:id',restricted(mayConfigureLabor),asyncHandler(async(req,res)=>{
  const id=Number(req.params.id),parsed=bankUpdate.safeParse(req.body);
  if(!Number.isSafeInteger(id)||id<1||!parsed.success)throw fail('Datos de banco inválidos.');
  const data=parsed.data,db=await pool.getConnection();
  try{
    await db.beginTransaction();
    const [rows]=await db.execute('SELECT id,code,name,active,revision FROM labor_banks WHERE id=?',[id]);
    if(!rows.length)throw fail('Banco no encontrado.',404);
    const before=rows[0];if(before.revision!==data.revision)throw fail('Banco modificado en otra sesión.',409);
    const name=data.name.toLocaleUpperCase('es-CL');
    if((await db.execute('SELECT id FROM labor_banks WHERE upper(name)=upper(?) AND id<>?',[name,id]))[0].length)
      throw fail('Banco duplicado.',409);
    await db.execute('UPDATE labor_banks SET name=?,active=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [name,data.active?1:0,id]);
    await db.execute('INSERT INTO labor_bank_history(bank_id,before_json,after_json,reason,changed_by) VALUES(?,?,?,?,?)',
      [id,JSON.stringify(before),JSON.stringify({...before,name,active:data.active?1:0,revision:before.revision+1}),data.reason,req.admin.id]);
    await recordAudit(req.admin,'update','labor_bank',id,{before:before.name,after:name,active:data.active,reason:data.reason},db);
    await db.commit();res.json({message:'Banco actualizado; historial conservado.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
laborBenefitsRouter.get('/family-brackets',asyncHandler(async(req,res)=>{
  const on=String(req.query.on||new Date().toISOString().slice(0,10));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(on))throw fail('Fecha inválida.');
  const [all]=await pool.execute('SELECT id,group_code AS groupCode,tier,income_from AS incomeFrom,income_to AS incomeTo,amount_clp AS amountClp,effective_from AS effectiveFrom,income_reference AS incomeReference,reason,source_url AS sourceUrl,created_at AS createdAt FROM labor_family_bracket_versions ORDER BY effective_from DESC,id DESC');
  const valid=all.find(x=>x.effectiveFrom<=on);
  res.json({asOf:on,current:valid?all.filter(x=>x.groupCode===valid.groupCode).sort((a,b)=>a.tier-b.tier):[],versions:mayConfigureLabor(req.admin)?all:[],canManage:mayConfigureLabor(req.admin)});
}));
laborBenefitsRouter.post('/family-brackets',restricted(mayConfigureLabor),asyncHandler(async(req,res)=>{
  const parsed=bandsSchema.safeParse(req.body);if(!parsed.success)throw fail('Revisa tramos, vigencia y fuente.');
  const d=parsed.data,t=[...d.tiers].sort((a,b)=>a.tier-b.tier);
  if(t.some((x,i)=>x.tier!==i+1||x.incomeFrom!==(i===0?0:t[i-1].incomeTo+1)|| (i<3 && (x.incomeTo===null||x.incomeTo<x.incomeFrom)) ||(i===3&&x.incomeTo!==null)))
    throw fail('Los cuatro tramos deben cubrir ingresos continuos desde cero sin solaparse.');
  const db=await pool.getConnection();
  try{
    await db.beginTransaction();
    const group=crypto.randomUUID();
    for(const item of t)await db.execute('INSERT INTO labor_family_bracket_versions(group_code,tier,income_from,income_to,amount_clp,effective_from,income_reference,reason,source_url,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [group,item.tier,item.incomeFrom,item.incomeTo,item.amountClp,d.effectiveFrom,d.incomeReference,d.reason,d.sourceUrl,req.admin.id]);
    await recordAudit(req.admin,'create','family_bracket_version',group,{effectiveFrom:d.effectiveFrom,tiers:t,reason:d.reason},db);
    await db.commit();res.status(201).json({groupCode:group});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
