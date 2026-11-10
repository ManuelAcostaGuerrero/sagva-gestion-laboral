export async function saveEmployeeSections({
  needsCreation = false, generalDirty = false, medicalDirty = false,
  contractDirty = false, familyDirty = false, bankDirty = false,
  configuredDirty = false, contractConfiguredDirty = false, completing = false,
  saveGeneral, saveMedical, saveContract, saveFamily, saveBank,
  saveConfigured, saveContractConfigured
}) {
  const completed = [];
  const tasks = [
    [completing && configuredDirty, 'Campos complementarios', saveConfigured],
    [completing && contractConfiguredDirty, 'Campos contractuales configurados', saveContractConfigured],
    [needsCreation || generalDirty || completing, 'Ficha general', saveGeneral],
    [!completing && configuredDirty, 'Campos complementarios', saveConfigured],
    [!completing && contractConfiguredDirty, 'Campos contractuales configurados', saveContractConfigured],
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
