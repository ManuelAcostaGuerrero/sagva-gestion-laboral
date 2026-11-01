CREATE TABLE shift_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT COLLATE NOCASE NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO shift_groups(name) VALUES ('Rotativo'), ('Oficina');

ALTER TABLE work_shifts ADD COLUMN group_id INTEGER REFERENCES shift_groups(id);

UPDATE work_shifts
SET group_id = (SELECT id FROM shift_groups WHERE name='Rotativo');

CREATE INDEX idx_work_shifts_group ON work_shifts(group_id);
