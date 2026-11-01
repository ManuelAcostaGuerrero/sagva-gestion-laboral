CREATE TABLE work_shift_segments (
  shift_id INTEGER NOT NULL REFERENCES work_shifts(id) ON DELETE CASCADE,
  segment_order INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  start_day_offset INTEGER NOT NULL DEFAULT 0,
  end_day_offset INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (shift_id, segment_order)
);
INSERT INTO work_shift_segments (shift_id,segment_order,start_time,end_time,end_day_offset)
SELECT id,0,substr(start_time,1,5),substr(end_time,1,5),CASE WHEN end_time<start_time THEN 1 ELSE 0 END FROM work_shifts;

CREATE TABLE shift_area_references (
  area_id INTEGER NOT NULL REFERENCES work_areas(id),
  shift_id INTEGER NOT NULL REFERENCES work_shifts(id),
  source TEXT NOT NULL DEFAULT 'manual',
  reference_frequency INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (area_id,shift_id)
);
CREATE TABLE planner_weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER NOT NULL REFERENCES work_areas(id),
  week_start TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  required_staff_json TEXT NOT NULL CHECK(json_valid(required_staff_json)),
  revision INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  published_by INTEGER REFERENCES admins(id),
  UNIQUE(area_id,week_start)
);
CREATE TABLE planner_rows (
  id TEXT PRIMARY KEY,
  week_id INTEGER NOT NULL REFERENCES planner_weeks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id),
  UNIQUE(week_id,employee_id)
);
CREATE TABLE planner_cells (
  row_id TEXT NOT NULL REFERENCES planner_rows(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL CHECK(day_index BETWEEN 0 AND 6),
  shift_id INTEGER REFERENCES work_shifts(id),
  day_type TEXT NOT NULL CHECK(day_type IN ('work','rest','leave','vacation','permit','absence')),
  availability TEXT CHECK(availability IN ('leave','vacation','permit','absence')),
  PRIMARY KEY(row_id,day_index),
  CHECK ((day_type='work' AND shift_id IS NOT NULL) OR (day_type<>'work' AND shift_id IS NULL))
);

-- Conserva todas las asignaciones anteriores e incorpora vacaciones y propietario.
ALTER TABLE employee_shift_calendar RENAME TO employee_shift_calendar_before_planner;
CREATE TABLE employee_shift_calendar (
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  shift_id INTEGER REFERENCES work_shifts(id) ON DELETE RESTRICT,
  day_type TEXT NOT NULL DEFAULT 'work' CHECK(day_type IN ('work','rest','leave','vacation','permit','absence')),
  assigned_at TEXT DEFAULT(datetime('now','localtime')),
  source_week_id INTEGER REFERENCES planner_weeks(id),
  PRIMARY KEY(employee_id,work_date)
);
INSERT INTO employee_shift_calendar(employee_id,work_date,shift_id,day_type,assigned_at)
SELECT employee_id,work_date,shift_id,day_type,assigned_at FROM employee_shift_calendar_before_planner;
DROP TABLE employee_shift_calendar_before_planner;
CREATE INDEX idx_shift_calendar_date ON employee_shift_calendar(work_date);
CREATE INDEX idx_planner_rows_week ON planner_rows(week_id);

INSERT INTO work_areas(name,required_staff) VALUES
('Cocina',9),('Garzones',8),('Barra',4),('Copería',2),('Caja',3),('Bodega',1),('Delivery',3)
ON CONFLICT(name) DO NOTHING;
