CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  seq INTEGER NOT NULL,
  as_of TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS machine_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ord INTEGER NOT NULL,
  active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  active INTEGER NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT
);

CREATE TABLE IF NOT EXISTS phase_templates (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  ord INTEGER NOT NULL,
  default_duration_days INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS factories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  region TEXT NOT NULL,
  pm_id TEXT NOT NULL,
  planned_start TEXT NOT NULL,
  planned_end TEXT NOT NULL,
  actual_start TEXT,
  actual_end TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS phases (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL,
  template_id TEXT,
  name TEXT NOT NULL,
  ord INTEGER NOT NULL,
  owner_id TEXT NOT NULL,
  planned_start TEXT NOT NULL,
  planned_end TEXT NOT NULL,
  actual_start TEXT,
  actual_end TEXT,
  status TEXT NOT NULL,
  risk_note TEXT NOT NULL,
  depends_on_phase_ids TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  phase_id TEXT NOT NULL,
  name TEXT NOT NULL,
  due_date TEXT NOT NULL,
  deliverables TEXT NOT NULL,
  done INTEGER NOT NULL,
  completed_at TEXT,
  owner_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  dev_department TEXT NOT NULL,
  project_department TEXT NOT NULL,
  primary_owner_id TEXT NOT NULL,
  mode TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_versions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  version TEXT NOT NULL,
  released_at TEXT,
  notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  default_enabled INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS version_features (
  version_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  supported INTEGER NOT NULL,
  PRIMARY KEY (version_id, feature_id)
);

CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  planned_version_id TEXT,
  actual_version_id TEXT,
  status TEXT NOT NULL,
  secondary_owner_id TEXT NOT NULL,
  planned_date TEXT,
  deployed_at TEXT,
  notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS machine_quantities (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL,
  machine_type_id TEXT NOT NULL,
  planned INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS phase_links (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  relation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_configs (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  desired INTEGER NOT NULL,
  actual INTEGER
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  status TEXT NOT NULL,
  provided_version_id TEXT,
  planned_features TEXT NOT NULL,
  ad_hoc_changes TEXT NOT NULL,
  construction_start TEXT,
  construction_end TEXT,
  note TEXT NOT NULL,
  submitted_by_id TEXT,
  submitted_at TEXT,
  approved_by_id TEXT,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS plan_revisions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  action TEXT NOT NULL,
  provided_version_id TEXT,
  planned_features TEXT NOT NULL,
  ad_hoc_changes TEXT NOT NULL,
  construction_start TEXT,
  construction_end TEXT,
  machines TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  factory_id TEXT NOT NULL,
  phase_id TEXT,
  milestone_id TEXT,
  product_id TEXT,
  owner_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT,
  resolution TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  raised_on TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  person_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_machine_quantities_deployment ON machine_quantities(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployments_factory ON deployments(factory_id);
CREATE INDEX IF NOT EXISTS idx_phases_factory ON phases(factory_id);
