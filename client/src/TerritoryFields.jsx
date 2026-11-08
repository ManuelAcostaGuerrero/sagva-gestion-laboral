import React from 'react';
import { getRegions, getProvinces, getCommunes, territoryKey } from '../../shared/chileTerritory.js';

// Se usa idéntica selección en domicilio particular y empresa; nunca copia entre ambos.
export default function TerritoryFields({ value = {}, onChange, prefix = 'Domicilio' }) {
  const region = value.region || '', province = value.province || '';
  const commune = value.commune || '', city = value.city || '';
  const choices = [
    ['region', 'Región', getRegions(), false],
    ['province', 'Provincia', getProvinces(region), !region && !province],
    ['commune', 'Comuna', getCommunes(region, province), !province && !commune]
  ];
  const update = (key, text) => {
    if (key === 'region') onChange({ region:text, province:'', commune:'', city:'' });
    else if (key === 'province') onChange({ province:text, commune:'', city:'' });
    else if (key === 'commune') onChange({ commune:text, city:'' });
  };
  return <>
    {choices.map(([key, label, items, disabled]) => {
      const current = value[key] || '';
      const historical = current && !items.includes(territoryKey(current));
      return <label key={key}>{prefix}: {label}
        <select aria-label={prefix + ': ' + label} value={current ? territoryKey(current) : ''} disabled={disabled}
          onChange={e => update(key,e.target.value)}>
          <option value="">Sin informar</option>
          {items.map(item => <option key={item} value={item}>{item}</option>)}
          {historical && <option value={territoryKey(current)}>{current} (histórico, revisar)</option>}
        </select>
      </label>;
    })}
    <label>{prefix}: Ciudad / localidad
      <input type="text" maxLength={250} aria-label={prefix + ': Ciudad / localidad'}
        value={city} onChange={e => onChange({ city:e.target.value.toLocaleUpperCase('es-CL') })}
        placeholder="Opcional; no equivale a comuna" />
    </label>
  </>;
}
