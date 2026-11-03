const fieldLabels = {first_name:'Primer nombre',second_name:'Segundo nombre',other_names:'Otros nombres',first_last_name:'Primer apellido',second_last_name:'Segundo apellido',email:'Correo personal',position_name:'Cargo',birth_date:'Fecha de nacimiento',address:'Dirección',mobile:'Celular',phone:'Teléfono',hire_date:'Fecha de contratación',termination_date:'Fecha de término',legal_full_name:'Nombre legal completo',document_id:'RUT'};
export function importDifference(key, proposed, current) {
  const display = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : String(value || 'Sin informar');
  return `${fieldLabels[key] || 'Dato del trabajador'}: el informe indica «${display(proposed)}», pero la ficha tiene «${display(current)}». Se conserva el valor de la ficha. Revisar.`;
}
