import { Router } from "express";
import { requireAdmin,permitted } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";
import { pool } from "../db.js";
import { runMigrations } from "../migrations.js";
import {
  fileSchema,
  fileSelect,
  presentFile,
  saveEmployeeFile,
} from "../employeeFiles.js";

export const employeeFilesRouter = Router();
employeeFilesRouter.use(requireAdmin);
const fileScope=f=>({companyId:f.companyId||null,branch:f.extra?.branch||null});
const allowed=(admin,file,write=false)=>permitted(admin,write?'personal.file.write':'personal.file.read',fileScope(file));
employeeFilesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await runMigrations();
    const [rows] = await pool.execute(
      `${fileSelect} ORDER BY e.is_active DESC,e.full_name`,
    );
    const files = rows.map(presentFile).filter(f=>allowed(req.admin,f));
    const counts = {
      all: files.length,
      pending: files.filter((f) => f.validationStatus === "NO_VALIDADO").length,
      validated: files.filter((f) => f.validationStatus === "VALIDADO").length,
    };
    const requested = req.query.validation;
    res.json({
      files: ["VALIDADO", "NO_VALIDADO"].includes(requested)
        ? files.filter((f) => f.validationStatus === requested)
        : files,
      counts,
    });
  }),
);
const save = asyncHandler(async (req, res) => {
  await runMigrations();
  const data = fileSchema.safeParse(req.body);
  if (!data.success)
    return res
      .status(400)
      .json({
        message:
          "Revisa el nombre y el formato de los campos enviados. Los campos adicionales pueden estar vacíos.",
      });
  const id = req.params.id ? Number(req.params.id) : null;
  if (req.params.id && (!Number.isInteger(id) || id < 1))
    return res.status(400).json({ message: "Trabajador inválido" });
  if(id){
    const [previous]=await pool.execute(`${fileSelect} WHERE e.id=?`,[id]);
    if(!previous.length)return res.status(404).json({message:'Trabajador no encontrado'});
    if(!allowed(req.admin,presentFile(previous[0]),true))
      return res.status(403).json({message:'Sin autorización para editar este trabajador.'});
  }
  const target={companyId:data.data.companyId||null,extra:data.data.extra||{}};
  if(!id||data.data.companyId){
    if(!allowed(req.admin,target,true))
      return res.status(403).json({message:'Sin autorización para crear o mover la ficha a este ámbito.'});
  }
  const employeeId = await saveEmployeeFile(id, data.data, req.admin);
  const [rows] = await pool.execute(`${fileSelect} WHERE e.id=?`, [employeeId]);
  res
    .status(id ? 200 : 201)
    .json({ file: presentFile(rows[0]), message: "Ficha guardada" });
});
employeeFilesRouter.post("/", save);
employeeFilesRouter.put("/:id", save);
