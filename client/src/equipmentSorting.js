// Orden visual, sin modificar IDs ni historial de las entregas.
const labelOf=item=>typeof item==='string'?item:String(item?.name??'');
export function sortEquipmentItems(items=[]){
 return [...items].sort((a,b)=>labelOf(a).localeCompare(labelOf(b),'es',{sensitivity:'base',numeric:true}));
}
