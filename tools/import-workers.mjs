import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[process.argv.indexOf("--file") + 1];
if (!process.argv.includes("--file") || !file)
  throw new Error('Indica --file "ruta al Excel". Solo se leerán A–F.');
if (!process.argv.includes("--under-control")) {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(root, "tools/control-local.ps1"),
      "-Accion",
      "Importar",
      "-Archivo",
      path.resolve(file),
    ],
    { cwd: root, stdio: "inherit" },
  );
  process.exit(0);
}
if (!fs.existsSync(path.join(root, "server/.env")))
  throw new Error("Falta server/.env.");
Object.assign(
  process.env,
  dotenv.parse(fs.readFileSync(path.join(root, "server/.env"))),
);
const folder = fs.mkdtempSync(path.join(root, ".local", "workers-import-"));
const json = path.join(folder, "columns-af.json");
try {
  // The parent local control holds its mutex and has checked ports and backup.
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(root, "tools/read-workers.ps1"),
      "-Workbook",
      path.resolve(file),
      "-OutputJson",
      json,
    ],
    { cwd: root, stdio: "inherit" },
  );
  const { importWorkers } = await import("../server/src/importWorkers.js");
  const { pool } = await import("../server/src/db.js");
  try {
    const result = await importWorkers(
      JSON.parse(fs.readFileSync(json, "utf8")),
    );
    console.log(
      `Importación A–F: ${result.created} creados, ${result.linked} vinculados, ${result.skipped} ya importados. ${result.changedSources} fuentes cambiadas requieren revisión manual.`,
    );
  } finally {
    await pool.end();
  }
} finally {
  if (fs.existsSync(json)) fs.unlinkSync(json);
  fs.rmdirSync(folder);
}
