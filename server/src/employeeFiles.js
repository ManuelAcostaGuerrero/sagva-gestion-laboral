import { z } from "zod";
import { pool } from "./db.js";
import { recordAudit } from "./auditLog.js";
import { workerName } from './workerNames.js';
import { normalizeRut, checkRut } from './rut.js';
import {territoryPathValid} from '../../shared/chileTerritory.js';
import { currentContractEnd, validateContract, validContractDate } from './employeeContracts.js';
import { importDifference } from './importReview.js';
import { resolvePosition } from './workPositions.js';
import { normalizeLabel, workerNumberFromRut, assembledWorkerName, phoneResult, completeFileMissing } from './workerFileStandards.js';

const text = z.string().trim().max(2000).nullable().optional();
export const fileSchema = z.object({
  fullName: z.string().max(255).optional(),
  legalFullName: z.string().max(255).nullable().optional(),
  firstName: text,
  secondName: text,
  otherNames: text,
  firstLastName: text,
  secondLastName: text,
  validationNotes: text,
  clearFields: z.array(z.string()).default([]),
  documentId: text,
  email: text,
  positionName: text,
  workAreaId: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .or(z.literal("")),
  validationStatus: z.enum(["NO_VALIDADO", "VALIDADO"]).optional(),
  company: text,
  companyId: z.union([z.number().int().positive(),z.literal(''),z.null()]).optional(),
  completeProfile: z.boolean().optional(),
  workSchedule: text,
  hireDate: text,
  terminationDate: text,
  contractType: text,
  employmentStatus: z.enum(['ACTIVO','INACTIVO','FINIQUITADO']).nullable().optional(),
  terminationReason: text,
  annexes: z.array(z.object({annexDate: z.string(), endDate: z.string()})).max(2).optional(),
  birthDate: text,
  address: text,
  phone: text,
  mobile: text,
  observations: text,
  extra: z
    .object({
      workerNumber: text,
      legacyWorkerNumber: text,
      civilStatus: text,
      nationalityDetail: text,
      afp: text,
      healthSystem: text,
      isapreName: text,
      healthPlanAmount: text,
      healthPlanUnit: text,
      temporaryDocument: text,
      firstName: text,
      paternalLastName: text,
      maternalLastName: text,
      sex: text,
      nationality: text,
      hierarchyUnit: text,
      costCenter: text,
    branch: text,
    region: text,
    province: text,
    commune: text,
    city: text,
    sourceContractCode: text,
    companyDocumentId: text,
    })
    .default({}),
  revision: z.number().int().nonnegative().optional(),
  documentChangeReason: text,
});
export const normalizeDocument = normalizeRut;
export const normalizeSchedule = (value) => {
  const raw = String(value || "").trim();
  return (
    {
      FULLTIME: "FULL_TIME",
      PARTTIME: "PART_TIME",
      PICTIME: "PEAK_TIME",
      PEAKTIME: "PEAK_TIME",
    }[raw.toUpperCase().replace(/[-_\s]/g, "")] ||
    raw ||
    null
  );
};
export const empty = (value) =>
  value == null || String(value).trim() === "" ? null : String(value).trim();
export function fileWarnings(data) {
  const warnings = [];
  if (!empty(data.documentId))
    warnings.push("RUT pendiente; ficha provisional.");
  else {
    if (!checkRut(data.documentId).valid)
      warnings.push(
        "Revisar formato o dígito verificador del RUT; no impide guardar.",
      );
  }
  if (empty(data.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    warnings.push("Revisar correo; no impide guardar.");
  for (const key of ["hireDate", "terminationDate", "birthDate"]) {
    if (
      empty(data[key]) &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(data[key]) ||
        !Number.isFinite(Date.parse(data[key])) ||
        new Date(data[key]).toISOString().slice(0, 10) !== data[key])
    )
      warnings.push(`Revisar ${ {hireDate:'fecha de inicio',terminationDate:'fecha de término inicial',birthDate:'fecha de nacimiento'}[key] }; no impide guardar.`);
  }
  if (
    data.hireDate &&
    data.terminationDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.hireDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.terminationDate) &&
    data.terminationDate < data.hireDate
  )
    warnings.push("Fechas inconsistentes: término anterior a contratación.");
  return warnings;
}
export const fileSelect = `SELECT e.id,e.full_name AS fullName,e.document_id AS documentId,e.email,
  e.first_name AS firstName,e.second_name AS secondName,e.other_names AS otherNames,
  e.first_last_name AS firstLastName,e.second_last_name AS secondLastName,e.legal_full_name AS legalFullName,
  COALESCE(f.is_validated,0) AS isValidated,f.validated_at AS validatedAt,f.validated_by AS validatedBy,
  f.validation_notes AS validationNotes,(SELECT full_name FROM admins WHERE id=f.validated_by) AS validatorName,
  e.position_name AS positionName,e.work_area_id AS workAreaId,e.is_active AS isActive,
  wa.name AS workAreaName,COALESCE(f.validation_status,'NO_VALIDADO') AS validationStatus,
  f.company,f.company_id AS companyId,f.work_schedule AS workSchedule,f.hire_date AS hireDate,f.termination_date AS terminationDate,
  f.contract_type AS contractType,f.employment_status AS employmentStatus,f.birth_date AS birthDate,
  f.termination_reason AS terminationReason,f.review_notes AS reviewNotes,
  (SELECT json_group_array(json_object('annexDate',a.annex_date,'endDate',a.end_date)) FROM
    (SELECT annex_date,end_date FROM employee_contract_annexes WHERE employee_id=e.id ORDER BY annex_order) a) AS annexesJson,
  (SELECT source_values_json FROM employee_import_sources WHERE employee_id=e.id AND source_key LIKE 'worker-info:%' LIMIT 1) AS reportJson,
  f.address,f.phone,f.mobile,f.observations,f.extra_json AS extraJson,COALESCE(f.revision,0) AS revision,
  f.updated_at AS updatedAt, (SELECT COUNT(*) FROM fingerprints WHERE employee_id=e.id) AS fingerprints
  FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id LEFT JOIN work_areas wa ON wa.id=e.work_area_id`;
export const presentFile = (row) => {
  const { extraJson, annexesJson, reportJson, ...file } = row;
  file.annexes = JSON.parse(annexesJson || '[]');
  if (file.isActive === 0 && file.employmentStatus !== 'FINIQUITADO') file.employmentStatus = 'INACTIVO';
  const report = JSON.parse(reportJson || '{}');
  const legacyWarnings = [];
  const legacyKeys = {hire_date:['hireDate','FECHA CONTRATO'],termination_date:['terminationDate','FECHA FINIQUITO'],birth_date:['birthDate','FECHA NACIMIENTO'],email:['email','EMAIL'],position_name:['positionName','CARGO'],address:['address','DIRECCION'],phone:['phone','TELEFONO PARTICULAR'],mobile:['mobile','TELEFONO CELULAR'],first_name:['firstName','NOMBRE'],second_name:['secondName','NOMBRE'],other_names:['otherNames','NOMBRE'],first_last_name:['firstLastName','APELLIDO PATERNO'],second_last_name:['secondLastName','APELLIDO MATERNO']};
  // Present old technical notices in the review panel without rewriting historical records.
  file.readableObservations = (file.observations || '').split('\n').filter(line => {
    const match = line.match(/^Informe: (\w+) distinto\. Se conserva el valor actual\.$/);
    if (!match) return true;
    const [key,header] = legacyKeys[match[1]] || [];
    const proposed = report[header];
    legacyWarnings.push(proposed ? importDifference(match[1],proposed,file[key]) : `${importDifference(match[1], 'No disponible en el informe guardado',file[key])}`);
    return false;
  }).join('\n');
  return {
    ...file,
    displayName: workerName(row),
    extra: {...JSON.parse(extraJson || "{}"),workerNumber:workerNumberFromRut(file.documentId)||JSON.parse(extraJson || "{}").workerNumber||""},
    currentContractEnd: currentContractEnd(file),
    warnings: [...fileWarnings(file), ...(file.reviewNotes || '').split('\n').filter(Boolean), ...legacyWarnings],
    rut: checkRut(file.documentId),
    pendingFields: ['documentId','firstName','firstLastName','company','workSchedule','hireDate','email','address','phone','birthDate']
      .filter(key => !empty(file[key]) && !(key === 'phone' && empty(file.mobile))),
  };
};
const problem = (message, status = 409) =>
  Object.assign(new Error(message), { status });
export async function saveEmployeeFile(id, data, admin) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = id
      ? await connection.execute(`${fileSelect} WHERE e.id=?`, [id])
      : [[]];
    const before = existing[0];
    if (id && !before) throw problem("Trabajador no encontrado", 404);
    if (id && data.revision !== before.revision)
      throw problem(
        "La ficha cambió en otra sesión. Recarga antes de guardar.",
      );
    // Empty/missing form values never silently erase known information.
    const clearable = ['email','positionName','workAreaId','company','workSchedule','hireDate','terminationDate','contractType','birthDate','address','phone','mobile','observations',
      'firstName','secondName','otherNames','firstLastName','secondLastName','validationNotes','terminationReason','employmentStatus'];
    const requestedClears = new Set(data.clearFields || []);
    if ([...requestedClears].some(key => !clearable.includes(key))) throw problem('Campo no permitido para vaciado.',400);
    const merged = {...data};
    if (before) for (const key of [...clearable,'documentId','fullName','legalFullName'])
      if (!empty(data[key]) && !requestedClears.has(key)) merged[key] = before[key];
    data = merged;
    const editableNameParts=['firstName','secondName','otherNames','firstLastName','secondLastName'];
    const namePartsChanged=editableNameParts.some(key=>empty(data[key])!==empty(before?.[key]));
    for(const key of [...editableNameParts,'address'])
      if(!before || empty(data[key])!==empty(before?.[key]))data[key]=normalizeLabel(data[key])||null;
    if(namePartsChanged){const assembled=assembledWorkerName(data);if(assembled)data.fullName=assembled;}
    for(const key of ['phone','mobile']){
      if(!before || empty(data[key])!==empty(before?.[key])){
        const phone=phoneResult(data[key],{mobile:key==='mobile'});
        if(!phone.valid)throw problem(key==='mobile'?'El celular debe tener 9 dígitos en Chile, comenzar en 9 y usar un código internacional válido.':'El teléfono fijo debe tener 9 dígitos en Chile o un formato internacional válido.',400);
        data[key]=phone.value||null;
      }
    }
    const oldAnnexes = JSON.parse(before?.annexesJson || '[]');
    data.annexes ??= oldAnnexes;
    if (data.annexes.length < oldAnnexes.length) throw problem('Los anexos guardados forman parte del historial y no pueden eliminarse.',400);
    // Preserve legacy incomplete contracts on unrelated edits, validating any new contract changes.
    const changed = key => empty(data[key]) !== empty(before?.[key]);
    for (const [key,label] of [['birthDate','nacimiento']])
      if (changed(key) && empty(data[key]) && !validContractDate(data[key])) throw problem(`Revisa la fecha de ${label}. Usa una fecha válida del calendario.`,400);
    if (oldAnnexes.length && !empty(data.terminationDate)) throw problem('La fecha de término inicial debe conservarse junto al historial de anexos.',400);
    // No programar vencimiento en un indefinido activo; conservar fechas históricas no editadas.
    if(data.contractType==='INDEFINIDO' && data.employmentStatus==='ACTIVO' &&
      before?.isActive!==0 && empty(data.terminationDate) &&
      empty(data.terminationDate)!==empty(before?.terminationDate))
      throw problem('Un contrato indefinido activo no admite una nueva fecha de término.',400);
    const sameAnnexes = JSON.stringify(data.annexes) === JSON.stringify(oldAnnexes);
    const contractChanged = ['contractType','hireDate','terminationDate'].some(changed) || !sameAnnexes;
    if (contractChanged) validateContract({...data, birthDate:undefined,
      terminationDate:data.contractType === 'INDEFINIDO' && !changed('terminationDate') ? undefined : data.terminationDate,
      annexes:data.contractType === 'INDEFINIDO' && sameAnnexes ? [] : data.annexes});
    if (before?.isActive === 0 && data.employmentStatus === 'ACTIVO' && before.employmentStatus !== 'ACTIVO')
      throw problem('Este trabajador está inactivo. Su reactivación se gestiona en Usuarios.',400);
    data.fullName = normalizeLabel(empty(data.fullName) || empty(data.legalFullName));
    if (data.email) data.email=data.email.trim().toUpperCase();
    if (!data.fullName) throw problem('Indica el nombre conocido del trabajador.',400);
    // Keep literal legal text, including its original accents/spacing.
    const legalName = data.legalFullName || before?.legalFullName || data.fullName;
    data.validationStatus ||= before?.validationStatus || 'NO_VALIDADO';
    if (!empty(data.documentId)) data.validationStatus = 'NO_VALIDADO';
    const previousExtra = JSON.parse(before?.extraJson || '{}');
    const incomingExtra = data.extra || {};
    data.extra = {...previousExtra};
    for (const [key,value] of Object.entries(incomingExtra)) if (empty(value)) data.extra[key] = value;
    // Al cambiar de Región/Provincia se limpian las selecciones dependientes.
    // No se borran campos históricos ajenos al domicilio.
    for(const key of ['region','province','commune','city']) {
      if(Object.prototype.hasOwnProperty.call(incomingExtra,key)) data.extra[key]=normalizeLabel(incomingExtra[key])||null;
    }
    if(!territoryPathValid(data.extra))throw problem('Revisa la Región, Provincia y Comuna del domicilio particular.',400);
    data.extra.firstName = [data.firstName,data.secondName,data.otherNames].filter(Boolean).join(' ') || null;
    data.extra.paternalLastName = data.firstLastName || null;
    for(const key of ['sex','nationality','civilStatus','hierarchyUnit','costCenter','branch','afp','healthSystem','isapreName']){
      if(!before || empty(incomingExtra[key])!==empty(previousExtra[key]))
        if(empty(incomingExtra[key]))data.extra[key]=normalizeLabel(incomingExtra[key]);
    }
    // Permitir vaciar expresamente los datos previsionales al cambiar de institución
    // sin borrar otros datos históricos ni reemplazar campos no enviados.
    for(const key of ['afp','healthSystem','isapreName','healthPlanAmount','healthPlanUnit']){
      if(Object.prototype.hasOwnProperty.call(incomingExtra,key)&&!empty(incomingExtra[key]))
        data.extra[key]=null;
    }
    const plan=empty(incomingExtra.healthPlanAmount);
    const previousPlan=empty(previousExtra.healthPlanAmount);
    if(plan!==previousPlan && plan!==null){
      const unit=empty(incomingExtra.healthPlanUnit)||empty(data.extra.healthPlanUnit)||'UF';
      const number=Number(plan);
      if(!['UF','CLP'].includes(unit)||!Number.isFinite(number)||number<=0||
         number>100000000||Math.abs(number*100-Math.round(number*100))>1e-6||
         (unit==='CLP'&&!Number.isInteger(number)))
        throw problem('El precio del plan Isapre debe ser mayor a cero: UF con hasta 2 decimales o CLP enteros.',400);
    }
    data.extra.maternalLastName = data.secondLastName || null;
    const doc = empty(data.documentId);
    const number=workerNumberFromRut(doc);
    if(number){
      if(data.extra.workerNumber && data.extra.workerNumber!==number)
        data.extra.legacyWorkerNumber ||= data.extra.workerNumber;
      data.extra.workerNumber=number;
    }
    if(data.completeProfile){
      const missing=completeFileMissing({...data,documentId:doc});
      // Un campo configurado como obligatorio bloquea SOLO el cierre validado,
      // no el guardado provisional.
      const [requiredFields]=await connection.execute(
        "SELECT d.label FROM labor_config_fields d LEFT JOIN employee_config_field_values v ON v.field_id=d.id AND v.employee_id=? WHERE d.active=1 AND d.required=1 AND d.target='FICHA' AND (v.value_json IS NULL OR v.value_json='null' OR v.value_json='\\\"\\\"') ORDER BY d.label",
        [id||0]);
      if(requiredFields.length)missing.push(...requiredFields.map(x=>x.label+' (campo configurado)'));
      if(missing.length)throw problem('No se puede validar la ficha. Campos pendientes: '+missing.join(', ')+'.',400);
      data.validationStatus='VALIDADO';
    }
    if (doc) {
      const [duplicates] = await connection.execute(
        "SELECT id FROM employees WHERE upper(replace(replace(replace(trim(document_id),'.',''),'-',''),' ',''))=? AND id<>?",
        [normalizeDocument(doc), id || 0],
      );
      if (duplicates.length)
        throw problem(
          "Este RUT ya pertenece a otro trabajador. Se conserva su historial.",
        );
    }
    const positionName=await resolvePosition(data.positionName,connection,before?.positionName);
    const companyId=data.companyId||null;
    if(companyId){
      const [companies]=await connection.execute('SELECT legal_name,default_branch AS defaultBranch,is_active AS isActive FROM company_profiles WHERE id=?',[companyId]);
      if(!companies.length)throw problem('Empresa no encontrada.',400);
      if(!companies[0].isActive && (!before || Number(before.companyId)!==companyId))throw problem('Selecciona una empresa activa.',400);
      if(!before || Number(before.companyId)!==companyId){
        data.company=companies[0].legal_name;
        data.extra.branch=companies[0].defaultBranch || null;
      } else if(!empty(data.extra.branch)) data.extra.branch=companies[0].defaultBranch || null;
    }
    const area = data.workAreaId || null;
    if (area) {
      const [areas] = await connection.execute(
        "SELECT id FROM work_areas WHERE id=?",
        [area],
      );
      if (!areas.length) throw problem("Área no encontrada", 400);
    }
    if (id)
      await connection.execute(
        "UPDATE employees SET full_name=?,document_id=?,email=?,position_name=?,work_area_id=? WHERE id=?",
        [
          data.fullName,
          doc,
          empty(data.email),
          positionName,
          area,
          id,
        ],
      );
    else {
      const [result] = await connection.execute(
        "INSERT INTO employees(full_name,document_id,email,position_name,work_area_id) VALUES(?,?,?,?,?)",
        [data.fullName, doc, empty(data.email), positionName, area],
      );
      id = result.insertId;
    }
    if (before && normalizeDocument(before.documentId) !== normalizeDocument(doc))
      await connection.execute(
        "INSERT INTO employee_document_history(employee_id,old_document_id,new_document_id,changed_by,reason) VALUES(?,?,?,?,?)",
        [
          id,
          before.documentId || "",
          doc || "",
          admin?.id || null,
          empty(data.documentChangeReason) || 'Corrección del RUT desde la ficha del trabajador',
        ],
      );
    await connection.execute('UPDATE employees SET legal_full_name=?,first_name=?,second_name=?,other_names=?,first_last_name=?,second_last_name=? WHERE id=?',
      [legalName,empty(data.firstName),empty(data.secondName),empty(data.otherNames),empty(data.firstLastName),empty(data.secondLastName),id]);
    await connection.execute(
      `INSERT INTO employee_files(employee_id,validation_status,company,company_id,work_schedule,hire_date,termination_date,contract_type,birth_date,address,phone,mobile,observations,extra_json,updated_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET validation_status=excluded.validation_status,
      company=excluded.company,company_id=excluded.company_id,work_schedule=excluded.work_schedule,hire_date=excluded.hire_date,termination_date=excluded.termination_date,
      contract_type=excluded.contract_type,birth_date=excluded.birth_date,address=excluded.address,phone=excluded.phone,mobile=excluded.mobile,
      observations=excluded.observations,extra_json=excluded.extra_json,updated_by=excluded.updated_by,
      revision=employee_files.revision+1,updated_at=datetime('now','localtime')`,
      [
        id,
        data.validationStatus,
        empty(data.company),
        companyId,
        normalizeSchedule(data.workSchedule),
        empty(data.hireDate),
        empty(data.terminationDate),
        empty(data.contractType),
        empty(data.birthDate),
        empty(data.address),
        empty(data.phone),
        empty(data.mobile),
        empty(data.observations),
        JSON.stringify(data.extra),
        admin?.id || null,
      ],
    );
    const validated = data.validationStatus === 'VALIDADO';
    await connection.execute('UPDATE employee_files SET employment_status=?,termination_reason=? WHERE employee_id=?',
      [empty(data.employmentStatus) || (before?.isActive === 0 ? 'INACTIVO' : 'ACTIVO'),empty(data.terminationReason),id]);
    if (['INACTIVO','FINIQUITADO'].includes(data.employmentStatus))
      await connection.execute('UPDATE employees SET is_active=0 WHERE id=?',[id]);
    for (const [index,annex] of data.annexes.entries()) {
      if (JSON.stringify(annex) === JSON.stringify(oldAnnexes[index])) continue;
      await connection.execute(`INSERT INTO employee_contract_annexes(employee_id,annex_order,annex_date,end_date,created_by,updated_by)
        VALUES(?,?,?,?,?,?) ON CONFLICT(employee_id,annex_order) DO UPDATE SET annex_date=excluded.annex_date,end_date=excluded.end_date,
        updated_by=excluded.updated_by,updated_at=datetime('now','localtime')`,
        [id,index+1,annex.annexDate,annex.endDate,admin?.id || null,admin?.id || null]);
    }
    await connection.execute(`UPDATE employee_files SET is_validated=?,validation_notes=?,
      validated_at=CASE WHEN ?=1 AND COALESCE(?,0)=0 THEN datetime('now','localtime') WHEN ?=0 THEN NULL ELSE validated_at END,
      validated_by=CASE WHEN ?=1 AND COALESCE(?,0)=0 THEN ? WHEN ?=0 THEN NULL ELSE validated_by END WHERE employee_id=?`,
      [validated?1:0,empty(data.validationNotes),validated?1:0,before?.isValidated || 0,validated?1:0,
        validated?1:0,before?.isValidated || 0,admin?.id || null,validated?1:0,id]);
    await recordAudit(
      admin,
      before ? "update_file" : "create_file",
      "employee",
      id,
      { before: before ? presentFile(before) : null, after: data },
      connection,
    );
    await connection.commit();
    return id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
