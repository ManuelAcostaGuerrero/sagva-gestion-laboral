export async function saveEmployeeSections({
  needsCreation = false, generalDirty = false, medicalDirty = false,
  contractDirty = false, familyDirty = false, bankDirty = false, completing = false,
  saveGeneral, saveMedical, saveContract, saveFamily, saveBank
}) {
  const completed = [];
  const tasks = [
    [needsCreation || generalDirty || completing, 'Ficha general', saveGeneral],
    [medicalDirty, 'Ficha médica', saveMedical],
    [contractDirty, 'Condiciones contractuales', saveContract],
    [familyDirty, 'Cargas familiares', saveFamily],
    [bankDirty, 'Cuenta bancaria', saveBank]
  ];
  for (const [required, label, action] of tasks) {
    if (!required) continue;
    try {
      await action();
      completed.push(label);
    } catch (error) {
      const problem = new Error(
        (completed.length ? 'Se guardó: ' + completed.join(', ') + '. ' : '') +
        'No se pudo guardar ' + label + ': ' + (error?.message || 'Error desconocido') +
        '. Los demás cambios pendientes se conservan.'
      );
      problem.completedSections = completed;
      throw problem;
    }
  }
  return completed;
}
