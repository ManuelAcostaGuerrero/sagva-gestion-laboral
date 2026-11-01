const clean=value=>String(value||'').trim().replace(/\s+/g,' ');
export const nameKey=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
export function workerName(file) {
  const extra=file.extra || JSON.parse(file.extra_json || file.extraJson || '{}');
  const first=clean(file.firstName || file.first_name || extra.firstName).split(' ')[0];
  const last=clean(file.firstLastName || file.first_last_name || extra.paternalLastName);
  return first && last ? `${first} ${last}` : clean(file.fullName || file.full_name);
}
export function resolveWorkerNames(current, source) {
  const first=clean(source.firstName), paternal=clean(source.paternalLastName), maternal=clean(source.maternalLastName);
  const sourceFull=[first,paternal,maternal].filter(Boolean).join(' ');
  if(!current) return {fullName:sourceFull,firstName:first,paternalLastName:paternal,maternalLastName:maternal};
  const tokens=clean(current).split(' '), family=paternal.split(' ');
  const index=tokens.findIndex((_,i)=>{
    const stored=nameKey(tokens.slice(i,i+family.length).join(' ')),source=nameKey(paternal);
    return stored===source || stored===`${source}S`;
  });
  // The current name is often more complete than the exported abbreviation.
  if(index>0) return {fullName:clean(current),firstName:tokens.slice(0,index).join(' '),paternalLastName:tokens.slice(index,index+family.length).join(' '),maternalLastName:tokens.slice(index+family.length).join(' ')};
  if(tokens.length<sourceFull.split(' ').length && !first.includes('.')) return {fullName:sourceFull,firstName:first,paternalLastName:paternal,maternalLastName:maternal};
  return {fullName:clean(current),firstName:first,paternalLastName:paternal,maternalLastName:maternal};
}
