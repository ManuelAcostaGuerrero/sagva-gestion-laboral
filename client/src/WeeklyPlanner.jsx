import DateField from './DateField.jsx';
import React, { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { api } from "./services/api.js";
import "./weeklyPlanner.css";
import "./weeklyWorkspace.css";
import {
  HISTORY_LIMIT,
  restoreDraft,
  copySchedule,
  assignEmployeeToRow,
} from "./plannerDraft.js";

const weekdays = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const types = {
  rest: "Descanso",
  leave: "Licencia",
  vacation: "Vacaciones",
  permit: "Permiso",
  absence: "Falta",
};

const areaOrder = ["cocina", "garzones", "barra", "coperia", "caja", "bodega", "delivery"];
const normalizeArea = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const sortAreas = (items) =>
  [...items].sort((a, b) => {
    const ai = areaOrder.indexOf(normalizeArea(a.name));
    const bi = areaOrder.indexOf(normalizeArea(b.name));
    const ar = ai === -1 ? 999 : ai;
    const br = bi === -1 ? 999 : bi;
    return ar - br || String(a.name).localeCompare(String(b.name), "es");
  });

const areaColor = (name) =>
  ({
    cocina: "#e5eee5",
    coperia: "#f2ecd9",
    barra: "#e0eeeb",
    garzones: "#e2eaf3",
    delivery: "#f2e5dc",
    dely: "#f2e5dc",
    bodega: "#ece5f1",
    caja: "#e8ecef",
  })[
    String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  ] || "#e5eceb";

const clone = (value) => JSON.parse(JSON.stringify(value));
const rowId = () => `r-${crypto.randomUUID()}`;
const dateAdd = (value, days) =>
  new Date(Date.parse(`${value}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
const monday = (value) => {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return dateAdd(value, -((day + 6) % 7));
};
const hours = (minutes) =>
  `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
const shiftStart = (shift) =>
  String(shift?.segments?.[0]?.startTime || shift?.startTime || "99:99").slice(0, 5);
const shiftEnd = (shift) =>
  String(shift?.segments?.at(-1)?.endTime || shift?.endTime || "99:99").slice(0, 5);
const sortShiftLibrary = (items = []) =>
  [...items].sort(
    (a, b) =>
      shiftStart(a).localeCompare(shiftStart(b)) ||
      shiftEnd(a).localeCompare(shiftEnd(b)) ||
      String(a?.name || "").localeCompare(String(b?.name || ""), "es"),
  );
const compactShift = (shift) => {
  if (!shift) return "";
  return String(shift.label || shift.name || "")
    .replaceAll(":00", "")
    .replace(/\s+/g, " ")
    .trim();
};
const shiftChoiceLabel = (shift) =>
  `${String(shift?.label || "").replace(/\s+/g, " ").trim()} · ${hours(shift?.workMinutes || 0)}`;
const freshRow = (index = 0, label = "") => ({
  id: rowId(),
  label: String(label || `Personal ${index + 1}`).trim(),
  employeeId: null,
  days: Array(7).fill(null),
});


function AllAreasPlanner({
  areas,
  employees,
  start,
  setStart,
  onMessage,
  onDirtyChange,
  active: plannerActive = false,
}) {
  const [boards, setBoards] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dayClipboard, setDayClipboard] = useState(null);
  const [singleCopy, setSingleCopy] = useState(null);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const entries = await Promise.all(
        areas.map(async (area) => {
          const [weekData, models] = await Promise.all([
            api(`/planner/week?areaId=${area.id}&weekStart=${start}`),
            api(`/planner/library?areaId=${area.id}`),
          ]);
          const week = weekData.id ? weekData : { ...weekData, rows: [] };
          return [
            String(area.id),
            { area, week, saved: JSON.stringify(week), library: sortShiftLibrary(models.shifts) },
          ];
        }),
      );
      setBoards(Object.fromEntries(entries));
    } catch (e) {
      setError(e.message);
      onMessage?.(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [start, areas.map((a) => a.id).join(",")]);
  // Reconsultar licencias cuando se vuelve a abrir el planificador sin borrar borradores.
  useEffect(() => {
    if (!plannerActive) return;
    if (Object.values(boards).some(board => JSON.stringify(board.week) !== board.saved)) return;
    load();
  }, [plannerActive]);
  useEffect(() => {
    const changed=()=> {
      if (plannerActive && !Object.values(boards).some(board => JSON.stringify(board.week) !== board.saved)) load();
    };
    window.addEventListener('attendance:medical-leaves-changed',changed);
    return ()=>window.removeEventListener('attendance:medical-leaves-changed',changed);
  }, [plannerActive,boards,start]);

  const changeArea = (id, transform) => {
    setBoards((current) => {
      const board = current[id];
      if (!board || board.week.status === "published") return current;
      const week = clone(board.week);
      transform(week);
      return { ...current, [id]: { ...board, week } };
    });
  };

  const dirtyBoards = Object.values(boards).filter(
    (board) => JSON.stringify(board.week) !== board.saved,
  );

  useEffect(() => {
    onDirtyChange?.(dirtyBoards.length > 0);
  }, [dirtyBoards.length, onDirtyChange]);

  useEffect(() => {
    const guard = (event) => {
      if (dirtyBoards.length) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirtyBoards.length]);

  const saveAll = async (silent = false) => {
    if (!dirtyBoards.length) return true;
    setBusy(true);
    setError("");
    try {
      const next = { ...boards };
      for (const board of dirtyBoards) {
        const data = await api(
          `/planner/week?areaId=${board.area.id}&weekStart=${start}`,
          {
            method: "PUT",
            body: JSON.stringify({
              revision: board.week.revision,
              requiredStaff: board.week.requiredStaff,
              rows: board.week.rows,
            }),
          },
        );
        next[String(board.area.id)] = {
          ...board,
          week: data,
          saved: JSON.stringify(data),
        };
      }
      setBoards(next);
      if (!silent) onMessage?.("Borradores de todas las áreas guardados.");
      return true;
    } catch (e) {
      setError(e.message);
      onMessage?.(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!plannerActive || !dirtyBoards.length || busy) return undefined;
    const timer = window.setTimeout(() => {
      saveAll(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [plannerActive, boards, busy, start]);

  useEffect(() => {
    if (plannerActive || !dirtyBoards.length || busy) return;
    saveAll(true);
  }, [plannerActive]);

  useEffect(() => {
    const saveBeforeLogout = (event) => {
      if (!dirtyBoards.length || busy) return;
      const promise = saveAll(true);
      event.detail?.promises?.push(promise);
    };
    window.addEventListener("attendance:before-logout", saveBeforeLogout);
    return () =>
      window.removeEventListener("attendance:before-logout", saveBeforeLogout);
  }, [boards, start, busy]);

  async function repeatNextWeek() {
    if (!Object.keys(boards).length || busy) return;
    if (dirtyBoards.length && !(await saveAll(true))) return;

    const nextStart = dateAdd(start, 7);
    setBusy(true);
    setError("");
    try {
      const targets = await Promise.all(
        areas.map(async (area) => {
          const [weekData, models] = await Promise.all([
            api(`/planner/week?areaId=${area.id}&weekStart=${nextStart}`),
            api(`/planner/library?areaId=${area.id}`),
          ]);
          return {
            area,
            week: weekData.id ? weekData : { ...weekData, rows: [] },
            library: sortShiftLibrary(models.shifts),
          };
        }),
      );

      if (targets.some((target) => target.week.status === "published"))
        throw new Error(
          "La semana siguiente tiene al menos un área publicada. Ábrela para revisión antes de reemplazarla.",
        );

      const hasExisting = targets.some((target) => target.week.rows.length);
      if (
        hasExisting &&
        !window.confirm(
          "La semana siguiente ya contiene horarios. ¿Reemplazarlos usando esta semana como base?",
        )
      )
        return;

      const nextBoards = {};
      for (const target of targets) {
        const source = boards[String(target.area.id)]?.week;
        if (!source) continue;
        const activeEmployees = employees
          .filter(
            (person) =>
              person.isActive &&
              Number(person.workAreaId) === Number(target.area.id),
          )
          .map((person) => person.id);
        const copied = copySchedule(
          target.week,
          source,
          activeEmployees,
          true,
          rowId,
        );
        const data = await api(
          `/planner/week?areaId=${target.area.id}&weekStart=${nextStart}`,
          {
            method: "PUT",
            body: JSON.stringify({
              revision: copied.revision,
              requiredStaff: copied.requiredStaff,
              rows: copied.rows,
            }),
          },
        );
        nextBoards[String(target.area.id)] = {
          area: target.area,
          week: data,
          saved: JSON.stringify(data),
          library: target.library,
        };
      }

      setSingleCopy(null);
      setBoards(nextBoards);
      setStart(nextStart);
      onDirtyChange?.(false);
      onMessage?.(
        "Semana siguiente creada con el mismo horario y las mismas personas activas.",
      );
    } catch (e) {
      setError(e.message);
      onMessage?.(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wp-all">
      <div className="wp-toolbar wp-all-toolbar">
        <button onClick={() => setStart(dateAdd(start, -7))} disabled={busy} aria-label="Semana anterior">←</button>
        <label>
          Semana del lunes
          <DateField
            
            value={start}
            onChange={(e) => e.target.value && setStart(monday(e.target.value))}
          />
        </label>
        <button onClick={() => setStart(dateAdd(start, 7))} disabled={busy} aria-label="Semana siguiente">→</button>
        <button onClick={() => setStart(monday(new Date().toLocaleDateString("sv-SE")))} disabled={busy}>Esta semana</button>
        <button onClick={repeatNextWeek} disabled={busy || !Object.keys(boards).length}>
          Repetir en semana siguiente
        </button>
        <span className="wp-spacer" />
        {singleCopy && (
          <span className="wp-copy-status">Turno copiado · elige una celda para pegarlo una vez</span>
        )}
        <button onClick={() => window.print()} disabled={busy || !Object.keys(boards).length}>Imprimir horario</button>
        <button className="primary" onClick={() => saveAll(false)} disabled={busy || !dirtyBoards.length}>
          Guardar borradores ({dirtyBoards.length})
        </button>
      </div>

      {error && <p className="wp-error" role="alert">{error}</p>}
      {busy && <p role="status">Procesando…</p>}

      <div className="wp-all-scroll">
        <div className="wp-global-days" role="row">
          <div className="wp-global-day wp-global-personal">Personal</div>
          {weekdays.map((day, i) => {
            const date = dateAdd(start, i);
            return (
              <div className="wp-global-day" key={day}>
                <strong>{day}</strong>
                <span>{date.slice(8, 10)}/{date.slice(5, 7)}</span>
              </div>
            );
          })}
          <div className="wp-global-day wp-global-hours">Horas</div>
        </div>
        {areas.map((area) => {
          const id = String(area.id);
          const board = boards[id];
          if (!board) return null;
          const { week, library } = board;
          const locked = week.status === "published" || busy;
          const people = employees.filter(
            (p) => p.isActive && Number(p.workAreaId) === Number(area.id),
          );
          const used = new Set(week.rows.map((r) => r.employeeId).filter(Boolean));
          const getShift = (shiftId) => library.find((s) => s.id === shiftId);

          return (
            <section className="wp-area-block" key={area.id} style={{ "--wp-area": areaColor(area.name) }}>
              <header className="wp-area-header">
                <div className="wp-area-heading">
                  <h3>{area.name}</h3>
                  <small>{week.status === "published" ? "Publicado · abre el área para revisión antes de editar" : "Borrador editable"}</small>
                </div>
                <select
                  aria-label={`Agregar personal a ${area.name}`}
                  value=""
                  disabled={locked}
                  onChange={(e) => {
                    const employeeId = Number(e.target.value);
                    if (!employeeId) return;
                    const person = people.find((p) => p.id === employeeId);
                    const personName = person?.displayName || person?.fullName || "Personal";
                    changeArea(id, (draft) =>
                      draft.rows.push({
                        ...freshRow(draft.rows.length, personName),
                        employeeId,
                      }),
                    );
                  }}
                >
                  <option value="">+ Personal</option>
                  {people.filter((p) => !used.has(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.displayName || p.fullName}</option>
                  ))}
                </select>
              </header>

              <div className="wp-area-table-wrap">
                <table className="wp-area-table">
                  <thead className="wp-area-controls-head">
                    <tr>
                      <th aria-label="Controles de personal"></th>
                      {week.dates.map((date, i) => (
                        <th key={date}>
                          <div className="wp-day-tools">
                            <label className="wp-needed">
                              <span>Neces.</span>
                              <input
                                type="number"
                                min="0"
                                max="200"
                                disabled={locked}
                                value={week.requiredStaff[i]}
                                onChange={(e) =>
                                  changeArea(id, (draft) => {
                                    draft.requiredStaff[i] = Math.max(
                                      0,
                                      Math.min(200, Number(e.target.value)),
                                    );
                                  })
                                }
                              />
                            </label>
                            <div className="wp-day-copy">
                              <button
                                disabled={locked}
                                onClick={() => setDayClipboard({
                                  areaId: id,
                                  data: clone(week.rows.map((row) => row.days[i])),
                                  source: i,
                                })}
                              >
                                Copiar
                              </button>
                              <button
                                disabled={locked || !dayClipboard || dayClipboard.areaId !== id || dayClipboard.source === i}
                                onClick={() => changeArea(id, (draft) => {
                                  draft.rows.forEach((row, n) => {
                                    row.days[i] = clone(dayClipboard.data[n] || null);
                                  });
                                })}
                              >
                                Pegar
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                      <th aria-label="Horas"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.rows.map((row, rowIndex) => {
                      const total = row.days.reduce(
                        (sum, cell) => sum + (cell?.dayType === "work" ? getShift(cell.shiftId)?.workMinutes || 0 : 0),
                        0,
                      );
                      return (
                        <tr key={row.id}>
                          <th>
                            <select
                              aria-label={`Personal de ${area.name}`}
                              disabled={locked}
                              value={row.employeeId || ""}
                              onChange={(e) =>
                                changeArea(id, (draft) =>
                                  assignEmployeeToRow(
                                    draft.rows,
                                    rowIndex,
                                    e.target.value ? Number(e.target.value) : null,
                                    people,
                                  ),
                                )
                              }
                            >
                              <option value="">Por asignar</option>
                              {people.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.displayName || person.fullName}
                                  {person.id !== row.employeeId && used.has(person.id) ? " · mover aquí" : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              className="wp-remove-person"
                              disabled={locked}
                              onClick={() => changeArea(id, (draft) => draft.rows.splice(rowIndex, 1))}
                              aria-label="Quitar personal"
                              title="Quitar fila"
                            >
                              ×
                            </button>
                          </th>
                          {row.days.map((cell, i) => {
                            const shift = cell?.dayType === "work" ? getShift(cell.shiftId) : null;
                            const copyKey = `${id}|${row.id}|${i}`;
                            const isCopySource = singleCopy?.key === copyKey;
                            const canPasteHere = Boolean(singleCopy && !isCopySource && !locked);
                            const medicalConflict = Boolean(row.employeeId && cell?.dayType === "work" &&
                              week.medicalLeaveDays?.some(leave => leave.employeeId === row.employeeId && leave.date === week.dates[i]));
                            return (
                              <td
                                key={i}
                                className={`wp-compact-cell ${shift?.kind || cell?.dayType || "empty"} ${isCopySource ? "copy-source" : ""} ${canPasteHere ? "copy-ready" : ""} ${medicalConflict ? "medical-leave-conflict" : ""}`}
                                title={medicalConflict ? "LICENCIA MÉDICA: turno previo conservado. No cuenta como personal disponible." : undefined}
                                onClick={(event) => {
                                  if (
                                    locked ||
                                    !singleCopy ||
                                    event.target.closest("select, button")
                                  )
                                    return;
                                  if (isCopySource) {
                                    setSingleCopy(null);
                                    return;
                                  }
                                  changeArea(id, (draft) => {
                                    draft.rows[rowIndex].days[i] = clone(singleCopy.data);
                                  });
                                  setSingleCopy(null);
                                }}
                              >
                                <div className="wp-shift-inline">
                                  <select
                                    aria-label={`${area.name}, ${weekdays[i]}`}
                                    disabled={locked || medicalConflict}
                                    value={cell?.dayType === "work" ? `shift:${cell.shiftId}` : cell?.dayType || ""}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(e) => changeArea(id, (draft) => {
                                      const value = e.target.value;
                                      draft.rows[rowIndex].days[i] = value.startsWith("shift:")
                                        ? { dayType: "work", shiftId: Number(value.slice(6)), availability: null }
                                        : value
                                          ? { dayType: value, shiftId: null, availability: null }
                                          : null;
                                    })}
                                  >
                                    <option value="">—</option>
                                    {library.map((item, optionIndex) => (
                                      <option
                                        key={item.id}
                                        className={optionIndex % 2 === 0 ? "wp-option-tone-a" : "wp-option-tone-b"}
                                        value={`shift:${item.id}`}
                                      >
                                        {shiftChoiceLabel(item)}
                                      </option>
                                    ))}
                                    {Object.entries(types).map(([type, label]) => (
                                      <option key={type} value={type}>{label}</option>
                                    ))}
                                  </select>
                                  {shift && (
                                    <>
                                      <span className="wp-shift-hours">
                                        {hours(shift.workMinutes)}
                                      </span>
                                      <button
                                        type="button"
                                        className="wp-cell-copy"
                                        disabled={locked}
                                        title="Copiar este turno una vez"
                                        aria-label={`Copiar ${shift.label}`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSingleCopy({
                                            key: copyKey,
                                            data: {
                                              dayType: "work",
                                              shiftId: cell.shiftId,
                                              availability: null,
                                            },
                                          });
                                        }}
                                      >
                                        <Copy size={12} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="wp-total">{hours(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      <section className="wp-print-sheet" aria-hidden="true">
        <div className="wp-print-title">
          <h1>Horario semanal</h1>
          <p>Semana del {start} al {dateAdd(start, 6)}</p>
        </div>
        <div className="wp-print-grid">
          {areas.map((area) => {
            const board = boards[String(area.id)];
            if (!board) return null;
            const getShift = (shiftId) => board.library.find((s) => s.id === shiftId);
            return (
              <section key={area.id} className="wp-print-area" style={{ "--wp-area": areaColor(area.name) }}>
                <h2>{area.name}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Persona</th>
                      {weekdays.map((day) => <th key={day}>{day.slice(0, 3)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {board.week.rows.map((row) => {
                      const person = employees.find((p) => p.id === row.employeeId);
                      return (
                        <tr key={row.id}>
                          <th>{person?.displayName || person?.fullName || "Sin asignar"}</th>
                          {row.days.map((cell, index) => {
                            const shift = cell?.dayType === "work" ? getShift(cell.shiftId) : null;
                            return (
                              <td key={index}>
                                {shift ? compactShift(shift) : cell?.dayType ? types[cell.dayType] : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function WeeklyPlanner({
  areas,
  employees,
  onMessage,
  active: visible = false,
  onClose,
}) {
  const active = sortAreas(areas.filter((area) => area.isActive));
  const [areaId, setAreaId] = useState("all"),
    [start, setStart] = useState(() =>
      monday(new Date().toLocaleDateString("sv-SE")),
    );
  const [week, setWeek] = useState(null),
    [saved, setSaved] = useState(""),
    [library, setLibrary] = useState([]);
  const [selection, setSelection] = useState([]),
    [paint, setPaint] = useState("");
  const [undo, setUndo] = useState([]),
    [redo, setRedo] = useState([]),
    [clipboard, setClipboard] = useState(null),
    [singleCopy, setSingleCopy] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState(false);
  const [allowIncomplete, setAllowIncomplete] = useState(false),
    [replaceExisting, setReplaceExisting] = useState(false);
  const [newShift, setNewShift] = useState(null),
    [filter, setFilter] = useState("all");
  const [copySource, setCopySource] = useState(null);
  const [navigation, setNavigation] = useState(null);
  const [allDirty, setAllDirty] = useState(false);
  const request = useRef(0),
    dirty = week && JSON.stringify(week) !== saved,
    locked = !week || week.status === "published" || busy;
  const query = `?areaId=${areaId}&weekStart=${start}`;
  const notify = (message) => {
    setError(message);
    onMessage?.(message);
  };
  useEffect(() => {
    if (!active.length) setAreaId("");
    else if (!areaId) setAreaId("all");
  }, [areas, areaId]);
  useEffect(() => {
    if (!areaId || areaId === "all") return;
    const id = ++request.current;
    setBusy(true);
    setError("");
    setWeek(null);
    Promise.all([
      api(`/planner/week?areaId=${areaId}&weekStart=${start}`),
      api(`/planner/library?areaId=${areaId}`),
    ])
      .then(([data, models]) => {
        if (id !== request.current) return;
        const initial = data.id
          ? data
          : {
              ...data,
              rows: Array.from(
                { length: Math.min(30, Math.max(0, data.requiredStaff[0])) },
                (_, index) => freshRow(index),
              ),
            };
        setWeek(initial);
        setSaved(JSON.stringify(initial));
        setLibrary(sortShiftLibrary(models.shifts));
        setUndo([]);
        setRedo([]);
        setSelection([]);
      })
      .catch((e) => {
        if (id === request.current) notify(e.message);
      })
      .finally(() => {
        if (id === request.current) setBusy(false);
      });
  }, [areaId, start]);
  useEffect(() => {
    if (!visible || areaId === 'all' || !week || dirty) return;
    api('/planner/week'+query).then(data => {
      setWeek(current => {
        if (!current || JSON.stringify(current) !== saved) return current;
        const next={...current,medicalLeaveDays:data.medicalLeaveDays || []};
        setSaved(JSON.stringify(next));
        return next;
      });
    }).catch(e=>setError(e.message));
  }, [visible]);
  useEffect(() => {
    const guard = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  useEffect(() => {
    if (
      !visible ||
      areaId === "all" ||
      !dirty ||
      busy ||
      !week ||
      week.status === "published"
    )
      return undefined;
    const timer = window.setTimeout(() => {
      save(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [visible, areaId, week, saved, busy, start]);

  useEffect(() => {
    if (
      visible ||
      areaId === "all" ||
      !dirty ||
      busy ||
      !week ||
      week.status === "published"
    )
      return;
    save(true);
  }, [visible]);

  useEffect(() => {
    const saveBeforeLogout = (event) => {
      if (
        areaId === "all" ||
        !dirty ||
        busy ||
        !week ||
        week.status === "published"
      )
        return;
      const promise = save(true);
      event.detail?.promises?.push(promise);
    };
    window.addEventListener("attendance:before-logout", saveBeforeLogout);
    return () =>
      window.removeEventListener("attendance:before-logout", saveBeforeLogout);
  }, [areaId, week, saved, busy, start]);
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);
  const restore = (snapshot) => {
    setWeek((current) => restoreDraft(current, snapshot));
    setSelection([]);
  };
  const change = (transform) => {
    if (locked) return;
    const next = clone(week);
    transform(next);
    if (JSON.stringify(next) === JSON.stringify(week)) return;
    setUndo((old) => [...old.slice(-(HISTORY_LIMIT - 1)), clone(week)]);
    setRedo([]);
    setWeek(next);
  };
  const navigate = (nextArea, nextDate) => {
    if (nextArea === areaId && nextDate === start) return;
    if (areaId === "all" && allDirty && nextArea !== "all") {
      const discard = window.confirm(
        "Hay cambios sin guardar en la vista de todas las áreas. ¿Descartarlos y cambiar de área?",
      );
      if (!discard) return;
      setAllDirty(false);
    }
    if (dirty) {
      setNavigation({ areaId: nextArea, date: nextDate });
      return;
    }
    setAreaId(nextArea);
    setStart(nextDate);
  };
  const model = (id) => library.find((s) => s.id === id);
  const cellFrom = (value) =>
    value.startsWith("shift:")
      ? { dayType: "work", shiftId: Number(value.slice(6)), availability: null }
      : value
        ? { dayType: value, shiftId: null, availability: null }
        : null;
  const apply = (value, targets = selection) =>
    change((data) => {
      for (const key of targets) {
        const [id, index] = key.split("|");
        const row = data.rows.find((r) => r.id === id);
        if (row) row.days[Number(index)] = cellFrom(value);
      }
    });
  const chooseCell = (row, index, event) => {
    const key = `${row.id}|${index}`;
    if (singleCopy) {
      if (singleCopy.key === key) {
        setSingleCopy(null);
        setSelection([key]);
        return;
      }
      change((data) => {
        const target = data.rows.find((item) => item.id === row.id);
        if (target) target.days[index] = clone(singleCopy.data);
      });
      setSingleCopy(null);
      setSelection([key]);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey)
      setSelection((old) =>
        old.includes(key) ? old.filter((k) => k !== key) : [...old, key],
      );
    else setSelection([key]);
  };
  async function save(silent = false) {
    setBusy(true);
    setError("");
    try {
      const data = await api(`/planner/week${query}`, {
        method: "PUT",
        body: JSON.stringify({
          revision: week.revision,
          requiredStaff: week.requiredStaff,
          rows: week.rows,
        }),
      });
      setWeek(data);
      setSaved(JSON.stringify(data));
      if (!silent)
        onMessage?.(
          "Borrador guardado. Los turnos oficiales se mantienen hasta publicar.",
        );
      return data;
    } catch (e) {
      notify(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function repeatNextWeek() {
    if (!week || busy || areaId === "all") return;
    let source = week;
    if (dirty) {
      const savedWeek = await save(true);
      if (!savedWeek) return;
      source = savedWeek;
    }

    const nextStart = dateAdd(start, 7);
    setBusy(true);
    setError("");
    try {
      const targetData = await api(
        `/planner/week?areaId=${areaId}&weekStart=${nextStart}`,
      );
      if (targetData.status === "published")
        throw new Error(
          "La semana siguiente ya está publicada. Ábrela para revisión antes de reemplazarla.",
        );
      if (
        targetData.rows.length &&
        !window.confirm(
          "La semana siguiente ya contiene un horario. ¿Reemplazarlo usando esta semana como base?",
        )
      )
        return;

      const target = targetData.id
        ? targetData
        : { ...targetData, rows: [] };
      const copied = copySchedule(
        target,
        source,
        people.map((person) => person.id),
        true,
        rowId,
      );
      const data = await api(
        `/planner/week?areaId=${areaId}&weekStart=${nextStart}`,
        {
          method: "PUT",
          body: JSON.stringify({
            revision: copied.revision,
            requiredStaff: copied.requiredStaff,
            rows: copied.rows,
          }),
        },
      );
      setSingleCopy(null);
      setSelection([]);
      setStart(nextStart);
      setWeek(data);
      setSaved(JSON.stringify(data));
      setUndo([]);
      setRedo([]);
      onMessage?.(
        "Semana siguiente creada con el mismo horario y las mismas personas activas.",
      );
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function action(name) {
    setBusy(true);
    setError("");
    try {
      const data = await api(`/planner/week/${name}${query}`, {
        method: "POST",
        body: JSON.stringify({
          revision: week.revision,
          allowIncomplete,
          replaceExisting,
        }),
      });
      setWeek(data);
      setSaved(JSON.stringify(data));
      setReview(false);
      setUndo([]);
      setRedo([]);
      onMessage?.(
        name === "publish"
          ? "Semana publicada. Turnos oficiales actualizados."
          : "Revisión abierta. La versión oficial se conserva hasta publicar nuevamente.",
      );
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function copyPrevious(
    sourceDate = dateAdd(start, -7),
    keepPeople = false,
  ) {
    setBusy(true);
    try {
      const data = await api(
        `/planner/week?areaId=${areaId}&weekStart=${sourceDate}`,
      );
      if (!data.rows.length)
        throw new Error("El horario elegido no tiene puestos guardados.");
      const next = copySchedule(
        week,
        data,
        people.map((p) => p.id),
        keepPeople,
        rowId,
      );
      setUndo((old) => [...old.slice(-(HISTORY_LIMIT - 1)), clone(week)]);
      setRedo([]);
      setWeek(next);
      setSelection([]);
      setCopySource(null);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function createShift(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/planner/library", {
        method: "POST",
        body: JSON.stringify({
          ...newShift,
          areaId: Number(areaId),
          breakMinutes: Number(newShift.breakMinutes),
        }),
      });
      const data = await api(`/planner/library?areaId=${areaId}`);
      setLibrary(data.shifts);
      setNewShift(null);
      onMessage?.("Horario agregado a Rotativo y disponible en todas las áreas.");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  const people = employees.filter(
    (p) => p.isActive && Number(p.workAreaId) === Number(areaId),
  );
  const coverage =
    week?.dates.map((date, i) => {
      const rows = week.rows.filter((r) => r.days[i]?.dayType === "work"),
        assigned = rows.filter((r) => r.employeeId),
        available = assigned.filter(
          (r) =>
            people.some((p) => p.id === r.employeeId) &&
            !r.days[i].availability &&
            !week.medicalLeaveDays?.some(leave => leave.employeeId === r.employeeId && leave.date === date),
        );
      return {
        date,
        planned: rows.length,
        assigned: assigned.length,
        available: available.length,
        missing: Math.max(0, week.requiredStaff[i] - available.length),
      };
    }) || [];
  const unassigned =
    week?.rows.filter(
      (r) => !r.employeeId && r.days.some((c) => c?.dayType === "work"),
    ).length || 0;
  const selectedRow = selection.length ? selection[0].split("|")[0] : null;
  return (
    <section
      className="wp wp-workspace module-content"
      style={{
        "--wp-area": areaColor(
          active.find((a) => String(a.id) === areaId)?.name,
        ),
      }}
      aria-label="Armar horario"
    >
      <div className="wp-title">
        <div>
          <h2>Armar horario</h2>
          <p>
            Diseña la cobertura, asigna las personas y publica una semana por
            área.
          </p>
        </div>
        <span
          className={`wp-status ${week?.status === "published" ? "published" : ""}`}
        >
          {week?.status === "published"
            ? "Publicado"
            : dirty
              ? "Borrador · sin guardar"
              : "Borrador"}
        </span>
        <button
          type="button"
          className="wp-close"
          onClick={onClose}
          disabled={busy}
        >
          Volver al panel
        </button>
      </div>
      <nav className="wp-areas" aria-label="Área del horario">
        <button
          style={{ "--tab-color": "#e7edf3" }}
          aria-pressed={areaId === "all"}
          className={areaId === "all" ? "selected" : ""}
          onClick={() => navigate("all", start)}
          disabled={busy}
        >
          Todas las áreas
        </button>
        {active.map((area) => (
          <button
            key={area.id}
            style={{ "--tab-color": areaColor(area.name) }}
            aria-pressed={String(area.id) === areaId}
            className={String(area.id) === areaId ? "selected" : ""}
            onClick={() => navigate(String(area.id), start)}
            disabled={busy}
          >
            {area.name}
          </button>
        ))}
      </nav>
      {!active.length ? (
        <p>Crea un área activa para comenzar.</p>
      ) : areaId === "all" ? (
        <AllAreasPlanner
          areas={active}
          employees={employees}
          start={start}
          setStart={(value) => navigate("all", value)}
          onMessage={onMessage}
          onDirtyChange={setAllDirty}
          active={visible}
        />
      ) : (
        <>
          <div className="wp-toolbar">
            <button
              onClick={() => navigate(areaId, dateAdd(start, -7))}
              disabled={busy}
              aria-label="Semana anterior"
            >
              ←
            </button>
            <label>
              Semana del lunes
              <DateField
                aria-label="Semana del lunes"
                
                value={start}
                onChange={(e) =>
                  e.target.value && navigate(areaId, monday(e.target.value))
                }
              />
            </label>
            <button
              onClick={() => navigate(areaId, dateAdd(start, 7))}
              disabled={busy}
              aria-label="Semana siguiente"
            >
              →
            </button>
            <button
              onClick={() =>
                navigate(areaId, monday(new Date().toLocaleDateString("sv-SE")))
              }
              disabled={busy}
            >
              Esta semana
            </button>
            <button
              onClick={repeatNextWeek}
              disabled={busy || !week}
            >
              Repetir en semana siguiente
            </button>
            <span className="wp-spacer" />
            {singleCopy && (
              <span className="wp-copy-status">
                Turno copiado · elige una celda para pegarlo una vez
              </span>
            )}
            <button onClick={() => save(false)} disabled={locked || !dirty}>
              Guardar borrador
            </button>
            {week?.status === "published" ? (
              <button onClick={() => action("reopen")} disabled={busy}>
                Abrir revisión
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy || !week?.id || dirty}
                onClick={() => {
                  setReview(true);
                  setAllowIncomplete(false);
                  setReplaceExisting(false);
                }}
              >
                Revisar y publicar
              </button>
            )}
          </div>
          {error && (
            <p className="wp-error" role="alert">
              {error}
            </p>
          )}
          {busy && <p role="status">Procesando…</p>}
          {week && (
            <div className="wp-layout">
              <aside className="wp-library">
                <h3>Biblioteca de turnos</h3>
                <p>
                  Selecciona celdas y aplica un turno, o arrástralo a un día.
                  Ctrl o Mayús permite seleccionar varias.
                </p>
                <select
                  aria-label="Filtrar turnos"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="morning">Mañana</option>
                  <option value="middle">Intermedio</option>
                  <option value="night">Nocturno</option>
                  <option value="split">Partido</option>
                </select>
                <div className="wp-model-list">
                  {library
                    .filter((s) => filter === "all" || s.kind === filter)
                    .slice(0, 8)
                    .map((s, index) => (
                      <button
                        key={s.id}
                        className={`wp-model ${s.kind} ${index % 2 === 0 ? "tone-a" : "tone-b"} ${paint === `shift:${s.id}` ? "selected" : ""}`}
                        draggable={!locked}
                        disabled={locked}
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", `shift:${s.id}`)
                        }
                        onClick={() => {
                          setPaint(`shift:${s.id}`);
                          if (selection.length) apply(`shift:${s.id}`);
                        }}
                        title={`${s.label}. ${hours(s.workMinutes)} efectivas`}
                      >
                        <span className="wp-model-row">
                          <strong>{s.label}</strong>
                          <span className="wp-duration-badge">{hours(s.workMinutes)}</span>
                        </span>
                      </button>
                    ))}
                </div>
                <select
                  aria-label="Turno para aplicar"
                  className="wp-turn-picker"
                  disabled={locked}
                  value={paint.startsWith("shift:") ? paint : ""}
                  onChange={(e) => {
                    setPaint(e.target.value);
                    if (selection.length) apply(e.target.value);
                  }}
                >
                  <option value="">Elegir otro turno</option>
                  {library.map((s, index) => (
                    <option
                      key={s.id}
                      className={index % 2 === 0 ? "wp-option-tone-a" : "wp-option-tone-b"}
                      value={`shift:${s.id}`}
                    >
                      {shiftChoiceLabel(s)}
                    </option>
                  ))}
                </select>
                <div className="wp-day-types">
                  {Object.entries(types).map(([key, label]) => (
                    <button
                      key={key}
                      disabled={locked}
                      onClick={() => {
                        setPaint(key);
                        apply(key);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    disabled={locked}
                    onClick={() => {
                      setPaint("");
                      apply("");
                    }}
                  >
                    Vaciar celdas
                  </button>
                </div>
                <button
                  disabled={locked}
                  onClick={() =>
                    setNewShift({
                      breakMinutes: 30,
                      segments: [{ startTime: "08:00", endTime: "15:30" }],
                    })
                  }
                >
                  + Crear turno
                </button>
              </aside>
              <div className="wp-board-panel">
                <div className="wp-editbar">
                  <button
                    disabled={locked}
                    onClick={() =>
                      change((d) => d.rows.push(freshRow(d.rows.length)))
                    }
                  >
                    + Personal
                  </button>
                  <button
                    disabled={locked || !undo.length}
                    onClick={() => {
                      setRedo((old) => [...old, clone(week)]);
                      restore(undo.at(-1));
                      setUndo((old) => old.slice(0, -1));
                    }}
                  >
                    Deshacer
                  </button>
                  <button
                    disabled={locked || !redo.length}
                    onClick={() => {
                      setUndo((old) => [...old, clone(week)]);
                      restore(redo.at(-1));
                      setRedo((old) => old.slice(0, -1));
                    }}
                  >
                    Rehacer
                  </button>
                  <button
                    disabled={locked}
                    onClick={() =>
                      setCopySource({
                        date: dateAdd(start, -7),
                        keepPeople: false,
                      })
                    }
                  >
                    Copiar semana anterior
                  </button>
                  <button
                    disabled={locked}
                    onClick={() =>
                      setCopySource({
                        date: dateAdd(start, -7),
                        keepPeople: false,
                      })
                    }
                  >
                    Copiar otro horario
                  </button>
                  <select
                    aria-label="Agregar persona del área"
                    value=""
                    disabled={locked}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      if (id) {
                        const person = people.find((p) => p.id === id);
                        const personName =
                          person?.displayName || person?.fullName || "Personal";
                        change((d) =>
                          d.rows.push({
                            ...freshRow(d.rows.length, personName),
                            employeeId: id,
                          }),
                        );
                      }
                    }}
                  >
                    <option value="">+ Persona de {week.area.name}</option>
                    {people
                      .filter(
                        (p) => !week.rows.some((r) => r.employeeId === p.id),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName || p.fullName}
                        </option>
                      ))}
                  </select>
                  <span>
                    {selection.length} celdas seleccionadas · {undo.length}{" "}
                    movimientos disponibles
                  </span>
                </div>
                <div className="wp-editbar">
                  <button
                    disabled={locked || !selectedRow}
                    onClick={() =>
                      setClipboard({
                        type: "row",
                        data: clone(
                          week.rows.find((r) => r.id === selectedRow).days,
                        ),
                      })
                    }
                  >
                    Copiar fila
                  </button>
                  <button
                    disabled={
                      locked ||
                      clipboard?.type !== "row" ||
                      !selection.length
                    }
                    onClick={() =>
                      change((d) => {
                        for (const key of selection) {
                          const [id] = key.split("|");
                          const row = d.rows.find((r) => r.id === id);
                          if (row) row.days = clone(clipboard.data);
                        }
                      })
                    }
                  >
                    Pegar fila
                  </button>
                  <button
                    disabled={locked || !selection.length}
                    onClick={() => apply(paint)}
                  >
                    Aplicar selección
                  </button>
                  <button
                    disabled={locked || !selectedRow}
                    onClick={() =>
                      apply(
                        paint,
                        [0, 1, 2].map((i) => `${selectedRow}|${i}`),
                      )
                    }
                  >
                    Repetir lun–mié
                  </button>
                </div>
                <div className="wp-scroll">
                  <table className="wp-table">
                    <thead>
                      <tr>
                        <th>Personal</th>
                        {week.dates.map((date, i) => (
                          <th key={date}>
                            <strong title={weekdays[i]}>{weekdays[i]}</strong>
                            <small>
                              {date.slice(8, 10)}/{date.slice(5, 7)}
                            </small>
                            <label>
                              Necesarios
                              <input
                                aria-label={`Necesarios ${weekdays[i]}`}
                                type="number"
                                min="0"
                                max="200"
                                disabled={locked}
                                value={week.requiredStaff[i]}
                                onChange={(e) =>
                                  change((d) => {
                                    d.requiredStaff[i] = Math.max(
                                      0,
                                      Math.min(200, Number(e.target.value)),
                                    );
                                  })
                                }
                              />
                            </label>
                            <div className="wp-day-copy">
                              <button
                                disabled={locked}
                                onClick={() =>
                                  setClipboard({
                                    type: "day",
                                    source: i,
                                    data: clone(week.rows.map((r) => r.days[i])),
                                  })
                                }
                              >
                                Copiar día
                              </button>
                              <button
                                disabled={
                                  locked ||
                                  clipboard?.type !== "day" ||
                                  clipboard.source === i
                                }
                                onClick={() =>
                                  change((d) => {
                                    d.rows.forEach((r, n) => {
                                      r.days[i] = clone(clipboard.data[n] || null);
                                    });
                                  })
                                }
                              >
                                Pegar día
                              </button>
                            </div>
                          </th>
                        ))}
                        <th>Horas</th>
                      </tr>
                      <tr className="wp-coverage">
                        <th>
                          Cobertura
                          <br />
                          <small>Plan / asignados / disponibles</small>
                        </th>
                        {coverage.map((c, i) => (
                          <th
                            key={c.date}
                            className={
                              c.available === 1 || c.planned === 1
                                ? "individual"
                                : ""
                            }
                          >
                            <strong>
                              {c.planned} / {c.assigned} / {c.available}
                            </strong>
                            <small>
                              {c.available === 1
                                ? "Una persona disponible"
                                : c.planned === 1
                                  ? "Un puesto previsto"
                                  : `${c.planned} puestos previstos`}
                            </small>
                          </th>
                        ))}
                        <th>Semana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {week.rows.map((row, n) => {
                        const total = row.days.reduce(
                          (sum, c) =>
                            sum +
                            (c?.dayType === "work"
                              ? model(c.shiftId)?.workMinutes || 0
                              : 0),
                          0,
                        );
                        return (
                          <tr key={row.id}>
                            <th>
                              <input
                                aria-label={`Nombre del puesto ${n + 1}`}
                                value={row.label}
                                disabled={locked}
                                onChange={(e) =>
                                  change((d) => {
                                    d.rows[n].label = e.target.value;
                                  })
                                }
                              />
                              <select
                                aria-label={`Persona para ${row.label}`}
                                disabled={locked}
                                value={row.employeeId || ""}
                                onChange={(e) =>
                                  change((d) =>
                                    assignEmployeeToRow(
                                      d.rows,
                                      n,
                                      e.target.value ? Number(e.target.value) : null,
                                      people,
                                    ),
                                  )
                                }
                              >
                                <option value="">Por asignar</option>
                                {people.map((p) => {
                                  const usedElsewhere = week.rows.some(
                                    (r) =>
                                      r.id !== row.id &&
                                      r.employeeId === p.id,
                                  );
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {p.displayName || p.fullName}
                                      {usedElsewhere ? " · mover aquí" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                              <div className="wp-row-actions">
                                <button
                                  aria-label={`Duplicar ${row.label}`}
                                  disabled={locked}
                                  onClick={() =>
                                    change((d) =>
                                      d.rows.splice(n + 1, 0, {
                                        ...clone(row),
                                        id: rowId(),
                                        label: `${row.label} copia`,
                                        employeeId: null,
                                        days: row.days.map((c) =>
                                          c
                                            ? { ...c, availability: null }
                                            : null,
                                        ),
                                      }),
                                    )
                                  }
                                >
                                  Duplicar
                                </button>
                                <button
                                  aria-label={`Quitar ${row.label}`}
                                  disabled={locked}
                                  onClick={() => {
                                    change((d) => d.rows.splice(n, 1));
                                    setSelection([]);
                                  }}
                                >
                                  Quitar
                                </button>
                              </div>
                            </th>
                            {row.days.map((cell, i) => {
                              const key = `${row.id}|${i}`,
                                shift =
                                  cell?.dayType === "work"
                                    ? model(cell.shiftId)
                                    : null;
                              const medicalConflict = Boolean(row.employeeId && cell?.dayType === "work" &&
                                week.medicalLeaveDays?.some(leave => leave.employeeId === row.employeeId && leave.date === week.dates[i]));
                              return (
                                <td
                                  key={i}
                                  className={`wp-cell ${shift?.kind || cell?.dayType || "empty"} ${selection.includes(key) ? "chosen" : ""} ${singleCopy?.key === key ? "copy-source" : ""} ${singleCopy && singleCopy.key !== key ? "copy-ready" : ""} ${medicalConflict ? "medical-leave-conflict" : ""}`}
                                  title={medicalConflict ? "LICENCIA MÉDICA: turno previo conservado. No cuenta como personal disponible." : undefined}
                                  onClick={(e) => chooseCell(row, i, e)}
                                  onDragOver={(e) => {
                                    if (!locked) e.preventDefault();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (locked) return;
                                    const value =
                                      e.dataTransfer.getData("text/plain");
                                    if (
                                      value.startsWith("shift:") &&
                                      model(Number(value.slice(6)))
                                    )
                                      apply(value, [key]);
                                  }}
                                >
                                  <div className="wp-shift-inline">
                                    <select
                                      aria-label={`${row.label}, ${weekdays[i]}`}
                                      disabled={locked || medicalConflict}
                                      value={
                                        cell?.dayType === "work"
                                          ? `shift:${cell.shiftId}`
                                          : cell?.dayType || ""
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) =>
                                        apply(e.target.value, [key])
                                      }
                                    >
                                      <option value="">Sin horario</option>
                                      {library.map((s) => (
                                        <option
                                          key={s.id}
                                          value={`shift:${s.id}`}
                                        >
                                          {s.label}
                                        </option>
                                      ))}
                                      {Object.entries(types).map(
                                        ([type, label]) => (
                                          <option key={type} value={type}>
                                            {label}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                    {shift && (
                                      <>
                                        <span className="wp-shift-hours">
                                          {hours(shift.workMinutes)}
                                        </span>
                                        <button
                                          type="button"
                                          className="wp-cell-copy"
                                          disabled={locked}
                                          title="Copiar este turno una vez"
                                          aria-label={`Copiar ${shift.label}`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setSingleCopy({
                                              key,
                                              data: {
                                                dayType: "work",
                                                shiftId: cell.shiftId,
                                                availability: null,
                                              },
                                            });
                                            setSelection([key]);
                                          }}
                                        >
                                          <Copy size={12} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  {cell && cell.dayType !== "work" && (
                                    <strong>{types[cell.dayType]}</strong>
                                  )}
                                  {cell?.dayType === "work" && (
                                    <select
                                      className={
                                        cell.availability
                                          ? "wp-unavailable"
                                          : ""
                                      }
                                      aria-label={`Disponibilidad ${row.label}, ${weekdays[i]}`}
                                      value={cell.availability || ""}
                                      disabled={locked}
                                      onChange={(e) =>
                                        change((d) => {
                                          d.rows[n].days[i].availability =
                                            e.target.value || null;
                                        })
                                      }
                                    >
                                      <option value="">Disponible</option>
                                      {Object.entries(types)
                                        .filter(([key]) => key !== "rest")
                                        .map(([key, label]) => (
                                          <option key={key} value={key}>
                                            {label}
                                          </option>
                                        ))}
                                    </select>
                                  )}
                                </td>
                              );
                            })}
                            <td className="wp-total">
                              <strong>{hours(total)}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!week.rows.length && (
                  <div className="wp-empty">
                    <h3>Primero diseña los puestos</h3>
                    <p>
                      Agrega filas anónimas y distribuye sus turnos. Luego
                      asigna a los trabajadores.
                    </p>
                    <button
                      disabled={locked}
                      onClick={() =>
                        change(
                          (d) =>
                            (d.rows = Array.from(
                              {
                                length: Math.max(
                                  1,
                                  Math.min(30, d.requiredStaff[0]),
                                ),
                              },
                              (_, i) => freshRow(i),
                            )),
                        )
                      }
                    >
                      Crear puestos según la cobertura del lunes
                    </button>
                  </div>
                )}
                <p className="wp-note">
                  La colación se descuenta una vez por jornada. Los tramos
                  partidos se suman sin contar el intervalo entre ellos. Un
                  turno que termina al día siguiente pertenece al día en que
                  comienza.
                </p>
              </div>
            </div>
          )}
        </>
      )}
      {copySource && (
        <div className="wp-overlay">
          <section
            className="wp-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wp-copy"
          >
            <h2 id="wp-copy">Copiar un horario anterior</h2>
            <p>
              Usa una semana guardada de {week.area.name} como base. La semana
              original se conserva.
            </p>
            <label>
              Lunes del horario anterior
              <DateField
                aria-label="Lunes del horario anterior"
                
                max={dateAdd(start, -7)}
                value={copySource.date}
                onChange={(e) =>
                  e.target.value &&
                  setCopySource({ ...copySource, date: monday(e.target.value) })
                }
              />
            </label>
            <label className="wp-check">
              <input
                type="checkbox"
                checked={copySource.keepPeople}
                onChange={(e) =>
                  setCopySource({ ...copySource, keepPeople: e.target.checked })
                }
              />
              Conservar las personas activas de esta área
            </label>
            <p>
              Las licencias, permisos y ausencias de la semana anterior no se
              copian: revisa la disponibilidad para la nueva semana.
            </p>
            {error && (
              <p className="wp-error" role="alert">
                {error}
              </p>
            )}
            <div className="wp-toolbar">
              <button disabled={busy} onClick={() => setCopySource(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={busy || copySource.date >= start}
                onClick={() =>
                  copyPrevious(copySource.date, copySource.keepPeople)
                }
              >
                Usar como base
              </button>
            </div>
          </section>
        </div>
      )}
      {navigation && (
        <div className="wp-overlay">
          <section
            className="wp-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wp-navigation"
          >
            <h2 id="wp-navigation">Cambiar de horario</h2>
            <p>
              Este borrador tiene cambios sin guardar. Puedes seguir trabajando,
              guardarlo o descartarlos para abrir el horario elegido.
            </p>
            <div className="wp-toolbar">
              <button onClick={() => setNavigation(null)}>Seguir aquí</button>
              <button
                onClick={() => {
                  setAreaId(navigation.areaId);
                  setStart(navigation.date);
                  setNavigation(null);
                }}
              >
                Descartar y cambiar
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (await save()) {
                    setAreaId(navigation.areaId);
                    setStart(navigation.date);
                    setNavigation(null);
                  }
                }}
              >
                Guardar y cambiar
              </button>
            </div>
            {error && <p className="wp-error">{error}</p>}
          </section>
        </div>
      )}
      {review && (
        <div className="wp-overlay">
          <section
            className="wp-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wp-review"
          >
            <h2 id="wp-review">Publicar semana</h2>
            <p>
              {week.area.name} · {start} a {week.dates[6]}
            </p>
            <p>
              {week.rows.length} puestos · {unassigned} sin persona ·{" "}
              {coverage.reduce((sum, c) => sum + c.missing, 0)} puestos por
              revisar en la cobertura de la semana.
            </p>
            <ul>
              {coverage.map((c, i) => (
                <li key={c.date}>
                  {weekdays[i]}: {c.available} disponibles de{" "}
                  {week.requiredStaff[i]} necesarios.
                </li>
              ))}
            </ul>
            <label className="wp-check">
              <input
                type="checkbox"
                checked={allowIncomplete}
                onChange={(e) => setAllowIncomplete(e.target.checked)}
              />
              Publicar aunque existan puestos sin asignar o cobertura
              incompleta.
            </label>
            <label className="wp-check">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
              />
              Reemplazar asignaciones previas de estas personas y fechas,
              creadas fuera de este plan.
            </label>
            <p>
              La publicación actualiza todos los turnos de esta semana en una
              sola operación. Las personas con licencia, permiso, vacaciones o
              ausencia conservarán el puesto en el plan, sin turno oficial ese
              día.
            </p>
            {error && (
              <p role="alert" className="wp-error">
                {error}
              </p>
            )}
            <div className="wp-toolbar">
              <button disabled={busy} onClick={() => setReview(false)}>
                Volver
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  (!allowIncomplete &&
                    (unassigned > 0 || coverage.some((c) => c.missing)))
                }
                onClick={() => action("publish")}
              >
                Confirmar publicación
              </button>
            </div>
          </section>
        </div>
      )}
      {newShift && (
        <div className="wp-overlay">
          <form
            className="wp-dialog"
            onSubmit={createShift}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wp-create"
          >
            <h2 id="wp-create">Nuevo horario Rotativo</h2>
            <p className="wp-auto-name">
              <strong>Nombre automático:</strong>{" "}
              Rotativo {newShift.segments
                .filter((segment) => segment.startTime && segment.endTime)
                .map((segment) => `${segment.startTime}–${segment.endTime}`)
                .join(" / ")}
            </p>
            {newShift.segments.map((s, i) => (
              <div className="wp-toolbar" key={i}>
                <label>
                  Inicio del tramo {i + 1}
                  <input
                    required
                    type="time"
                    value={s.startTime}
                    onChange={(e) =>
                      setNewShift({
                        ...newShift,
                        segments: newShift.segments.map((v, n) =>
                          n === i ? { ...v, startTime: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Fin
                  <input
                    required
                    type="time"
                    value={s.endTime}
                    onChange={(e) =>
                      setNewShift({
                        ...newShift,
                        segments: newShift.segments.map((v, n) =>
                          n === i ? { ...v, endTime: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setNewShift({
                        ...newShift,
                        segments: newShift.segments.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              disabled={newShift.segments.length >= 4}
              onClick={() =>
                setNewShift({
                  ...newShift,
                  segments: [
                    ...newShift.segments,
                    { startTime: "20:00", endTime: "02:30" },
                  ],
                })
              }
            >
              + Tramo
            </button>
            <label>
              Colación total (minutos)
              <input
                type="number"
                required
                min="0"
                max="240"
                value={newShift.breakMinutes}
                onChange={(e) =>
                  setNewShift({ ...newShift, breakMinutes: e.target.value })
                }
              />
            </label>
            <p>
              Un fin anterior al inicio indica salida al día siguiente. Ordena
              los tramos cronológicamente.
            </p>
            {error && (
              <p className="wp-error" role="alert">
                {error}
              </p>
            )}
            <div className="wp-toolbar">
              <button
                type="button"
                onClick={() => setNewShift(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                Guardar turno
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
