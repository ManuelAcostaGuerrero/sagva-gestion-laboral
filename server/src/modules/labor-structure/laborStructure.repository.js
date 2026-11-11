// Repositorio de lectura del agregado laboral. Nunca modifica fichas legadas ni JSON.
export async function laborCatalog(db) {
 const [companies]=await db.execute(`SELECT id,legal_name AS legalName,tax_id AS taxId,is_active AS isActive
  FROM company_profiles ORDER BY is_active DESC,legal_name`);
 const [branches]=await db.execute(`SELECT id,company_id AS companyId,code,name,address,active,revision
  FROM company_branches ORDER BY company_id,active DESC,name`);
 const [workers]=await db.execute(`SELECT id,document_id AS documentId,full_name AS fullName,is_active AS isActive
  FROM employees ORDER BY full_name,id`);
 const [areas]=await db.execute(`SELECT id,name,is_active AS isActive FROM work_areas ORDER BY name`);
 const [positions]=await db.execute(`SELECT id,name,is_active AS isActive FROM work_positions ORDER BY name`);
 const [entities]=await db.execute(`SELECT id,kind,name,active FROM labor_entities WHERE active=1 ORDER BY kind,name`);
 const [shifts]=await db.execute(`SELECT id,name,start_time AS startTime,end_time AS endTime,break_minutes AS breakMinutes
  FROM work_shifts WHERE is_active=1 ORDER BY name`);
 return {companies,branches,workers,areas,positions,entities,shifts};
}

export async function laborWorker(db,employeeId){
 const [workers]=await db.execute(`SELECT id,document_id AS documentId,full_name AS fullName
 FROM employees WHERE id=?`,[employeeId]);
 if(!workers.length)return null;
 const [relations]=await db.execute(`SELECT r.id,r.company_id AS companyId,c.legal_name AS companyName,
 r.started_on AS startedOn,r.ended_on AS endedOn,r.status,r.review_status AS reviewStatus,
 r.review_reason AS evidenceRef,r.created_at AS createdAt
 FROM employment_relationships r JOIN company_profiles c ON c.id=r.company_id
 WHERE r.employee_id=? ORDER BY r.started_on DESC,r.id DESC`,[employeeId]);
 const [assignments]=await db.execute(`SELECT a.id,a.employment_id AS employmentId,a.branch_id AS branchId,
 b.name AS branchName,a.work_area_id AS areaId,wa.name AS areaName,a.position_id AS positionId,
 wp.name AS positionName,a.valid_from AS validFrom,a.valid_until AS validUntil,
 a.evidence_ref AS evidenceRef
 FROM employment_assignments a JOIN employment_relationships r ON r.id=a.employment_id
 LEFT JOIN company_branches b ON b.id=a.branch_id LEFT JOIN work_areas wa ON wa.id=a.work_area_id
 LEFT JOIN work_positions wp ON wp.id=a.position_id
 WHERE r.employee_id=? ORDER BY a.valid_from DESC,a.id DESC`,[employeeId]);
 const [terms]=await db.execute(`SELECT t.id,t.employment_id AS employmentId,t.effective_from AS effectiveFrom,
 t.effective_until AS effectiveUntil,t.monthly_base_salary_clp AS monthlyBaseSalaryClp,
 t.weekly_hours AS weeklyHours,t.break_minutes AS breakMinutes,
 t.source_document_ref AS sourceDocumentRef,t.terms_snapshot_json AS termsSnapshotJson
 FROM employment_terms_versions t JOIN employment_relationships r ON r.id=t.employment_id
 WHERE r.employee_id=? ORDER BY t.effective_from DESC,t.id DESC`,[employeeId]);
 const [shifts]=await db.execute(`SELECT v.id,v.employment_id AS employmentId,v.shift_id AS shiftId,
 s.name AS shiftName,v.valid_from AS validFrom,v.valid_until AS validUntil,
 v.evidence_ref AS evidenceRef
 FROM employment_shift_versions v JOIN employment_relationships r ON r.id=v.employment_id
 JOIN work_shifts s ON s.id=v.shift_id
 WHERE r.employee_id=? ORDER BY v.valid_from DESC,v.id DESC`,[employeeId]);
 const [prevision]=await db.execute(`SELECT p.id,p.valid_from AS validFrom,p.valid_until AS validUntil,
 p.afp_entity_id AS afpEntityId,afp.name AS afpName,p.health_entity_id AS healthEntityId,
 health.name AS healthName,p.plan_amount_hundredths AS planAmountHundredths,
 p.plan_unit AS planUnit,p.source_ref AS sourceRef
 FROM employee_prevision_versions p
 LEFT JOIN labor_entities afp ON afp.id=p.afp_entity_id
 LEFT JOIN labor_entities health ON health.id=p.health_entity_id
 WHERE p.employee_id=? ORDER BY p.valid_from DESC,p.id DESC`,[employeeId]);
 const [documents]=await db.execute(`SELECT l.id,l.employment_id AS employmentId,l.contract_file_id AS fileId,
 l.document_kind AS kind,l.document_date AS documentDate,l.evidence_ref AS evidenceRef,f.filename,f.sha256,
 l.linked_at AS linkedAt FROM employment_documents l
 JOIN employment_relationships r ON r.id=l.employment_id
 JOIN employee_contract_files f ON f.id=l.contract_file_id
 WHERE r.employee_id=? ORDER BY l.id DESC`,[employeeId]);
 const [availableDocuments]=await db.execute(`SELECT id,filename,sha256,uploaded_at AS uploadedAt
 FROM employee_contract_files WHERE employee_id=? ORDER BY id DESC`,[employeeId]);
 const [events]=await db.execute(`SELECT ev.id,ev.employment_id AS employmentId,ev.kind,
 ev.effective_on AS effectiveOn,ev.evidence_ref AS evidenceRef,ev.created_at AS createdAt,
 ev.created_by AS createdBy
 FROM labor_lifecycle_events ev JOIN employment_relationships r ON r.id=ev.employment_id
 WHERE r.employee_id=? ORDER BY ev.id DESC`,[employeeId]);
 return {worker:workers[0],relations,assignments,terms,shifts,prevision,documents,availableDocuments,events};
}
