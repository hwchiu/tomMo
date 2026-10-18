import { featureOverrides } from "@/domain/features";
import type {
  Activity,
  AdHocChange,
  Database,
  DeploymentStatus,
  Issue,
  Milestone,
  Phase,
  PlannedFeature,
  PlanRevision,
  PlanStatus,
  ProductDeployment,
  ProductFactoryPlan,
  RevisionAction,
} from "@/domain/types";

const AS_OF = "2026-10-18";

interface DepSpec {
  factory: string;
  product: string;
  planned: string | null;
  actual: string | null;
  status: DeploymentStatus;
  secondary: string;
  machines: number | null;
  plannedDate: string | null;
  deployedAt: string | null;
  /** Supported by the actual version, but the engineer reports it off. */
  actualOff?: string[];
  upgraded?: boolean;
}

interface RevisionSpec {
  action: RevisionAction;
  version: string | null;
  start: string | null;
  end: string | null;
  actor: string;
  at: string;
  note?: string;
}

interface PlanSpec {
  factory: string;
  product: string;
  status: PlanStatus;
  version: string | null;
  /** Feature ids planned on for FEATURE_ONLY products. */
  enabled?: string[];
  /** 異動說明 for feature-flag diffs, keyed by feature id. */
  reasons?: Record<string, string>;
  adhoc?: AdHocChange[];
  start: string | null;
  end: string | null;
  note?: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  revisions?: RevisionSpec[];
}

interface PhaseSpec {
  name: string;
  owner: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: Phase["status"];
  riskNote?: string;
}

/** Fresh in-memory database. Every call returns new objects. */
export function buildSeed(): Database {
  const db: Database = {
    seq: 1000,
    asOf: AS_OF,
    machineTypes: [
      { id: "mt_a", code: "A", name: "機種A", order: 1, active: true },
      { id: "mt_b", code: "B", name: "機種B", order: 2, active: true },
    ],
    machineQuantities: [],
    enumerations: [
      { id: "en_giga", set: "factoryCategory", code: "GIGA", label: "Giga", description: "超大型廠，一次進駐多個產品", order: 1, active: true },
      { id: "en_phase", set: "factoryCategory", code: "PHASE", label: "Phase", description: "分期廠，產品分波進駐", order: 2, active: true },
      { id: "en_hq", set: "factoryRegion", code: "HQ", label: "總部 HQ", description: "總部廠區", order: 1, active: true },
      { id: "en_os", set: "factoryRegion", code: "OVERSEA", label: "海外 Oversea", description: "海外廠區", order: 2, active: true },
      { id: "en_n3", set: "technologyNode", code: "N3", label: "N3", description: "N3 製程節點", order: 1, active: true },
      { id: "en_n2", set: "technologyNode", code: "N2", label: "N2", description: "N2 製程節點", order: 2, active: true },
    ],
    people: [
      { id: "u_lin", name: "林品均", department: "廠務處", active: true, source: "manual", externalId: null },
      { id: "u_chen", name: "陳浩宇", department: "廠務處", active: true, source: "manual", externalId: null },
      { id: "u_huang", name: "黃詩涵", department: "廠務處", active: true, source: "manual", externalId: null },
      { id: "u_chang", name: "張承恩", department: "運算開發處", active: true, source: "manual", externalId: null },
      { id: "u_wang", name: "王雅婷", department: "儲存開發處", active: true, source: "manual", externalId: null },
      { id: "u_liu", name: "劉子豪", department: "資料產品處", active: true, source: "manual", externalId: null },
      { id: "u_wu", name: "吳佩蓉", department: "開發者產品處", active: true, source: "manual", externalId: null },
      { id: "u_cheng", name: "鄭凱翔", department: "監控產品處", active: true, source: "manual", externalId: null },
      { id: "u_chou", name: "周宜安", department: "海外廠務", active: true, source: "manual", externalId: null },
      { id: "u_tsai", name: "蔡明哲", department: "廠務工程", active: true, source: "manual", externalId: null },
      { id: "u_old", name: "舊同事", department: "廠務處", active: false, source: "manual", externalId: null },
    ],
    phaseTemplates: [
      { id: "tpl_1", code: "HW", name: "硬體導入 Hardware Onboarding", description: "廠房、電力、機櫃與網路硬體到位", order: 1, defaultDurationDays: 100 },
      { id: "tpl_2", code: "PLT", name: "產品建立 Product Build", description: "各產品進廠、施工、部署到可交給開發者", order: 2, defaultDurationDays: 150 },
      { id: "tpl_3", code: "DEV", name: "開發者進駐 Developer Onboarding", description: "開發團隊進駐、環境驗收與權限", order: 3, defaultDurationDays: 75 },
      { id: "tpl_4", code: "OPS", name: "開始營運 Operations Start", description: "營運交接、值班與穩態", order: 4, defaultDurationDays: 45 },
    ],
    factories: [],
    phases: [],
    milestones: [],
    products: [
      { id: "plt_compute", name: "運算產品 Compute", description: "GPU／CPU 機櫃、液冷與排程。", devDepartment: "運算開發處", projectDepartment: "產品專案一處", primaryOwnerId: "u_chang", mode: "VERSIONED" },
      { id: "plt_storage", name: "儲存產品 Storage", description: "熱溫冷分層、快照與跨廠複製。", devDepartment: "儲存開發處", projectDepartment: "產品專案一處", primaryOwnerId: "u_wang", mode: "VERSIONED" },
      { id: "plt_data", name: "資料產品 Data", description: "訓練資料血緣、特徵庫與批次追溯。只有功能開關，沒有版本。", devDepartment: "資料產品處", projectDepartment: "產品專案二處", primaryOwnerId: "u_liu", mode: "FEATURE_ONLY" },
      { id: "plt_dev", name: "開發產品 Developer", description: "映像倉庫、沙箱與 IDE 閘道。只有功能開關，沒有版本。", devDepartment: "開發者產品處", projectDepartment: "產品專案二處", primaryOwnerId: "u_wu", mode: "FEATURE_ONLY" },
      { id: "plt_mon", name: "監控產品 Monitoring", description: "告警路由、遠端診斷與 OEE。只有功能開關，沒有版本。", devDepartment: "監控產品處", projectDepartment: "廠務可靠度處", primaryOwnerId: "u_cheng", mode: "FEATURE_ONLY" },
    ],
    versions: [],
    features: [
      { id: "ft_gpu", productId: "plt_compute", code: "gpu_partition", name: "GPU 分割", description: "單機多租戶切分", defaultEnabled: true },
      { id: "ft_rack", productId: "plt_compute", code: "rack_scale", name: "機櫃級擴展", description: "以機櫃為單位擴充", defaultEnabled: false },
      { id: "ft_liquid", productId: "plt_compute", code: "liquid_cooling", name: "液冷支援", description: "液冷迴路監控與排程", defaultEnabled: false },
      { id: "ft_nvme", productId: "plt_storage", code: "nvme_tier", name: "NVMe 分層", description: "熱層 NVMe", defaultEnabled: true },
      { id: "ft_snap", productId: "plt_storage", code: "snapshot", name: "快照", description: "資料快照", defaultEnabled: false },
      { id: "ft_xsite", productId: "plt_storage", code: "cross_site", name: "跨廠複製", description: "跨廠非同步複製", defaultEnabled: false },
      { id: "ft_lineage", productId: "plt_data", code: "lineage", name: "資料血緣", description: "資料集血緣", defaultEnabled: true },
      { id: "ft_fstore", productId: "plt_data", code: "feature_store", name: "特徵庫", description: "線上特徵", defaultEnabled: false },
      { id: "ft_trace", productId: "plt_data", code: "batch_trace", name: "批次追溯", description: "訓練批次追溯", defaultEnabled: false },
      { id: "ft_reg", productId: "plt_dev", code: "registry", name: "映像倉庫", description: "容器映像", defaultEnabled: true },
      { id: "ft_sand", productId: "plt_dev", code: "sandbox", name: "沙箱", description: "隔離開發沙箱", defaultEnabled: false },
      { id: "ft_ide", productId: "plt_dev", code: "ide_gateway", name: "IDE 閘道", description: "遠端 IDE", defaultEnabled: false },
      { id: "ft_alert", productId: "plt_mon", code: "alert_route", name: "告警路由", description: "分級告警", defaultEnabled: true },
      { id: "ft_diag", productId: "plt_mon", code: "remote_diag", name: "遠端診斷", description: "遠端診斷通道", defaultEnabled: false },
      { id: "ft_oee", productId: "plt_mon", code: "oee_dashboard", name: "OEE 看板", description: "設備綜合效率", defaultEnabled: false },
    ],
    versionFeatures: [],
    deployments: [],
    phaseLinks: [],
    featureConfigs: [],
    plans: [],
    revisions: [],
    issues: [],
    topics: [],
    activity: [],
  };

  const versionSupport: Record<string, string[]> = {
    ver_cmp_220: ["ft_gpu"],
    ver_cmp_230: ["ft_gpu", "ft_rack"],
    ver_cmp_240: ["ft_gpu", "ft_rack", "ft_liquid"],
    ver_stg_140: ["ft_nvme"],
    ver_stg_160: ["ft_nvme", "ft_snap"],
    ver_stg_170: ["ft_nvme", "ft_snap", "ft_xsite"],
  };

  const versionRows: Array<[string, string, string, string | null, string]> = [
    ["ver_cmp_220", "plt_compute", "2.2.0", "2026-03-01", "基礎 GPU 分割"],
    ["ver_cmp_230", "plt_compute", "2.3.0", "2026-06-12", "加入機櫃級擴展"],
    ["ver_cmp_240", "plt_compute", "2.4.0", "2026-09-01", "液冷支援"],
    ["ver_stg_140", "plt_storage", "1.4.0", "2026-02-01", "NVMe 熱層"],
    ["ver_stg_160", "plt_storage", "1.6.0", "2026-06-20", "快照"],
    ["ver_stg_170", "plt_storage", "1.7.0", "2026-09-08", "跨廠複製"],
  ];
  for (const [id, productId, version, releasedAt, notes] of versionRows) {
    db.versions.push({ id, productId, version, releasedAt, notes });
    for (const featureId of db.features.filter((feature) => feature.productId === productId).map((feature) => feature.id)) {
      db.versionFeatures.push({
        versionId: id,
        featureId,
        supported: (versionSupport[id] ?? []).includes(featureId),
      });
    }
  }

  addFactory(db, {
    id: "f_hsc",
    code: "FAB-HSC",
    name: "新竹一廠",
    location: "新竹科學園區",
    description: "Giga 廠，N3，產品建立進行中。開發產品尚未提報施工計畫。",
    category: "GIGA",
    region: "HQ",
    technology: "N3",
    pmId: "u_lin",
    status: "ON_TRACK",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-03-02", plannedEnd: "2026-06-15", actualStart: "2026-03-04", actualEnd: "2026-06-12", status: "COMPLETED" },
      { name: "產品建立 Product Build", owner: "u_lin", plannedStart: "2026-06-16", plannedEnd: "2026-11-30", actualStart: "2026-06-18", actualEnd: null, status: "IN_PROGRESS" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-12-01", plannedEnd: "2027-02-28", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開始營運 Operations Start", owner: "u_lin", plannedStart: "2027-03-01", plannedEnd: "2027-04-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });
  addFactory(db, {
    id: "f_txg",
    code: "FAB-TXG",
    name: "台中二廠",
    location: "台中精密園區",
    description: "分期廠。運算產品施工窗提早開工，版本仍停在 2.2。",
    category: "PHASE",
    region: "HQ",
    technology: "N3",
    pmId: "u_chen",
    status: "AT_RISK",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-04-01", plannedEnd: "2026-06-30", actualStart: "2026-04-06", actualEnd: "2026-07-08", status: "COMPLETED" },
      { name: "產品建立 Product Build", owner: "u_chen", plannedStart: "2026-07-01", plannedEnd: "2026-10-31", actualStart: "2026-07-18", actualEnd: null, status: "AT_RISK", riskNote: "液冷水路未驗收，運算版本落後提供版本。" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-11-01", plannedEnd: "2027-01-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開始營運 Operations Start", owner: "u_chen", plannedStart: "2027-01-16", plannedEnd: "2027-03-01", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });
  addFactory(db, {
    id: "f_khh",
    code: "FAB-KHH",
    name: "高雄三廠",
    location: "高雄科學園區",
    description: "Giga、N2。主變壓器延遲，產品建立已超過計畫結束日。",
    category: "GIGA",
    region: "HQ",
    technology: "N2",
    pmId: "u_huang",
    status: "DELAYED",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-01-06", plannedEnd: "2026-03-31", actualStart: "2026-01-10", actualEnd: "2026-04-28", status: "COMPLETED" },
      { name: "產品建立 Product Build", owner: "u_huang", plannedStart: "2026-04-01", plannedEnd: "2026-09-30", actualStart: "2026-05-06", actualEnd: null, status: "DELAYED", riskNote: "主變壓器未送電，多數產品計畫未提報。" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-10-01", plannedEnd: "2026-12-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開始營運 Operations Start", owner: "u_huang", plannedStart: "2026-12-16", plannedEnd: "2027-01-31", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });
  addFactory(db, {
    id: "f_tnn",
    code: "FAB-TNN",
    name: "台南四廠",
    location: "台南科學園區",
    description: "分期廠、N2。產品建立已結案，各產品計畫已核准，開發者進駐進行中。",
    category: "PHASE",
    region: "HQ",
    technology: "N2",
    pmId: "u_huang",
    status: "ON_TRACK",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-01-15", plannedEnd: "2026-03-31", actualStart: "2026-01-15", actualEnd: "2026-03-28", status: "COMPLETED" },
      { name: "產品建立 Product Build", owner: "u_huang", plannedStart: "2026-04-01", plannedEnd: "2026-08-15", actualStart: "2026-04-01", actualEnd: "2026-08-12", status: "COMPLETED" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-08-16", plannedEnd: "2026-11-15", actualStart: "2026-08-18", actualEnd: null, status: "IN_PROGRESS" },
      { name: "開始營運 Operations Start", owner: "u_huang", plannedStart: "2026-11-16", plannedEnd: "2026-12-31", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });
  addFactory(db, {
    id: "f_kum",
    code: "FAB-KUM",
    name: "熊本一廠",
    location: "熊本",
    description: "海外 Giga 廠。硬體仍在進場，產品建立尚未開始，多數施工計畫未提報。",
    category: "GIGA",
    region: "OVERSEA",
    technology: "N3",
    pmId: "u_lin",
    status: "AT_RISK",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_chou", plannedStart: "2026-08-01", plannedEnd: "2026-11-14", actualStart: "2026-08-20", actualEnd: null, status: "AT_RISK", riskNote: "海運機櫃到港不穩。" },
      { name: "產品建立 Product Build", owner: "u_lin", plannedStart: "2026-11-15", plannedEnd: "2027-04-30", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2027-05-01", plannedEnd: "2027-07-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開始營運 Operations Start", owner: "u_lin", plannedStart: "2027-07-16", plannedEnd: "2027-09-01", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });

  const dataOn = ["ft_lineage", "ft_fstore", "ft_trace"];
  const devSandbox = ["ft_reg", "ft_sand"];
  const devOn = ["ft_reg", "ft_sand", "ft_ide"];
  const monDiag = ["ft_alert", "ft_diag"];
  const monOn = ["ft_alert", "ft_diag", "ft_oee"];
  const monBase = ["ft_alert"];

  const deployments: DepSpec[] = [
    { factory: "f_hsc", product: "plt_compute", planned: "ver_cmp_240", actual: "ver_cmp_240", status: "DEPLOYED", secondary: "u_tsai", machines: 640, plannedDate: "2026-09-15", deployedAt: "2026-09-28", actualOff: ["ft_liquid"], upgraded: true },
    { factory: "f_hsc", product: "plt_storage", planned: "ver_stg_160", actual: "ver_stg_160", status: "IN_PROGRESS", secondary: "u_wang", machines: 300, plannedDate: "2026-11-15", deployedAt: null },
    { factory: "f_hsc", product: "plt_data", planned: "ver_dat_320", actual: "ver_dat_320", status: "DEPLOYED", secondary: "u_liu", machines: null, plannedDate: "2026-10-15", deployedAt: "2026-10-08" },
    { factory: "f_hsc", product: "plt_dev", planned: "ver_dev_120", actual: null, status: "PLANNED", secondary: "u_wu", machines: null, plannedDate: "2026-11-20", deployedAt: null },
    { factory: "f_hsc", product: "plt_mon", planned: "ver_mon_120", actual: "ver_mon_120", status: "DEPLOYED", secondary: "u_cheng", machines: null, plannedDate: "2026-10-30", deployedAt: "2026-10-12" },
    { factory: "f_txg", product: "plt_compute", planned: "ver_cmp_230", actual: "ver_cmp_220", status: "IN_PROGRESS", secondary: "u_tsai", machines: 200, plannedDate: "2026-10-20", deployedAt: null },
    { factory: "f_txg", product: "plt_storage", planned: "ver_stg_160", actual: "ver_stg_160", status: "DEPLOYED", secondary: "u_tsai", machines: 120, plannedDate: "2026-10-01", deployedAt: "2026-09-26", actualOff: ["ft_snap"] },
    { factory: "f_txg", product: "plt_data", planned: "ver_dat_310", actual: null, status: "PLANNED", secondary: "u_liu", machines: null, plannedDate: "2026-10-31", deployedAt: null },
    { factory: "f_txg", product: "plt_dev", planned: "ver_dev_110", actual: "ver_dev_110", status: "IN_PROGRESS", secondary: "u_wu", machines: null, plannedDate: "2026-10-20", deployedAt: null },
    { factory: "f_txg", product: "plt_mon", planned: "ver_mon_120", actual: "ver_mon_120", status: "DEPLOYED", secondary: "u_cheng", machines: null, plannedDate: "2026-09-30", deployedAt: "2026-09-18" },
    { factory: "f_khh", product: "plt_compute", planned: "ver_cmp_240", actual: null, status: "IN_PROGRESS", secondary: "u_tsai", machines: 860, plannedDate: "2026-09-15", deployedAt: null },
    { factory: "f_khh", product: "plt_storage", planned: "ver_stg_160", actual: "ver_stg_140", status: "IN_PROGRESS", secondary: "u_tsai", machines: 400, plannedDate: "2026-10-30", deployedAt: null },
    { factory: "f_khh", product: "plt_data", planned: "ver_dat_300", actual: null, status: "PLANNED", secondary: "u_liu", machines: 140, plannedDate: "2026-11-30", deployedAt: null },
    { factory: "f_khh", product: "plt_dev", planned: "ver_dev_110", actual: null, status: "PLANNED", secondary: "u_wu", machines: null, plannedDate: "2026-12-15", deployedAt: null },
    { factory: "f_khh", product: "plt_mon", planned: "ver_mon_130", actual: "ver_mon_110", status: "DEPLOYED", secondary: "u_cheng", machines: null, plannedDate: "2026-08-30", deployedAt: "2026-08-20" },
    { factory: "f_tnn", product: "plt_compute", planned: "ver_cmp_240", actual: "ver_cmp_240", status: "ACCEPTED", secondary: "u_chang", machines: 180, plannedDate: "2026-07-31", deployedAt: "2026-07-28" },
    { factory: "f_tnn", product: "plt_storage", planned: "ver_stg_170", actual: "ver_stg_170", status: "ACCEPTED", secondary: "u_wang", machines: 90, plannedDate: "2026-08-01", deployedAt: "2026-07-30" },
    { factory: "f_tnn", product: "plt_data", planned: "ver_dat_320", actual: "ver_dat_320", status: "ACCEPTED", secondary: "u_liu", machines: 40, plannedDate: "2026-08-10", deployedAt: "2026-08-08" },
    { factory: "f_tnn", product: "plt_dev", planned: "ver_dev_120", actual: "ver_dev_120", status: "ACCEPTED", secondary: "u_wu", machines: 24, plannedDate: "2026-08-12", deployedAt: "2026-08-11" },
    { factory: "f_tnn", product: "plt_mon", planned: "ver_mon_130", actual: "ver_mon_130", status: "ACCEPTED", secondary: "u_cheng", machines: 20, plannedDate: "2026-07-20", deployedAt: "2026-07-18" },
    { factory: "f_kum", product: "plt_compute", planned: "ver_cmp_240", actual: null, status: "PLANNED", secondary: "u_chou", machines: 520, plannedDate: "2027-03-15", deployedAt: null },
    { factory: "f_kum", product: "plt_storage", planned: "ver_stg_170", actual: null, status: "PLANNED", secondary: "u_chou", machines: null, plannedDate: "2027-03-30", deployedAt: null },
    { factory: "f_kum", product: "plt_data", planned: "ver_dat_320", actual: null, status: "PLANNED", secondary: "u_chou", machines: null, plannedDate: "2027-04-15", deployedAt: null },
    { factory: "f_kum", product: "plt_dev", planned: "ver_dev_120", actual: null, status: "PLANNED", secondary: "u_chou", machines: null, plannedDate: "2027-04-20", deployedAt: null },
    { factory: "f_kum", product: "plt_mon", planned: "ver_mon_130", actual: null, status: "PLANNED", secondary: "u_chou", machines: null, plannedDate: "2027-04-01", deployedAt: null },
  ];
  for (const spec of deployments) addDeployment(db, spec);

  const plans: PlanSpec[] = [
    {
      factory: "f_hsc", product: "plt_compute", status: "APPROVED", version: "ver_cmp_240", start: "2026-07-01", end: "2026-09-30",
      note: "第二版納入液冷。", submittedBy: "u_chang", submittedAt: "2026-09-02T01:00:00.000Z", approvedBy: "u_lin", approvedAt: "2026-09-05T02:00:00.000Z",
      adhoc: [
        { id: "ah_hsc_liquid", kind: "FEATURE_OVERRIDE", featureId: "ft_liquid", enabled: false, title: "", description: "水路本季不開液冷，先沿用氣冷排程。" },
        { id: "ah_hsc_night", kind: "CUSTOM", featureId: null, enabled: null, title: "機櫃改夜班進場", description: "與廠務卸貨窗重疊，改 22:00 進場。" },
      ],
      revisions: [
        { action: "SUBMIT", version: "ver_cmp_230", start: "2026-07-01", end: "2026-09-15", actor: "u_chang", at: "2026-08-01T01:00:00.000Z", note: "第一版" },
        { action: "SUBMIT", version: "ver_cmp_240", start: "2026-07-01", end: "2026-09-30", actor: "u_chang", at: "2026-09-02T01:00:00.000Z", note: "改提供 2.4.0" },
        { action: "APPROVE", version: "ver_cmp_240", start: "2026-07-01", end: "2026-09-30", actor: "u_lin", at: "2026-09-05T02:00:00.000Z", note: "PM 核准" },
      ],
    },
    { factory: "f_hsc", product: "plt_storage", status: "SUBMITTED", version: "ver_stg_160", start: "2026-08-01", end: "2026-12-20", note: "完工超出產品建立結束日。", submittedBy: "u_wang", submittedAt: "2026-08-20T03:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_stg_160", start: "2026-08-01", end: "2026-12-20", actor: "u_wang", at: "2026-08-20T03:00:00.000Z" }] },
    { factory: "f_hsc", product: "plt_data", status: "APPROVED", version: null, enabled: dataOn, start: "2026-07-15", end: "2026-10-31", reasons: { ft_fstore: "訓練特徵要在線上查詢。", ft_trace: "客訴追溯需要批次編號。" }, note: "相對預設多開特徵庫與批次追溯。", submittedBy: "u_liu", submittedAt: "2026-07-20T01:00:00.000Z", approvedBy: "u_lin", approvedAt: "2026-07-22T01:00:00.000Z", revisions: [{ action: "SUBMIT", version: null, start: "2026-07-15", end: "2026-10-31", actor: "u_liu", at: "2026-07-20T01:00:00.000Z" }, { action: "APPROVE", version: null, start: "2026-07-15", end: "2026-10-31", actor: "u_lin", at: "2026-07-22T01:00:00.000Z" }] },
    { factory: "f_hsc", product: "plt_dev", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_hsc", product: "plt_mon", status: "SUBMITTED", version: null, enabled: monDiag, start: "2026-09-01", end: "2026-11-20", submittedBy: "u_cheng", submittedAt: "2026-09-03T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: null, start: "2026-09-01", end: "2026-11-20", actor: "u_cheng", at: "2026-09-03T02:00:00.000Z" }] },
    { factory: "f_txg", product: "plt_compute", status: "SUBMITTED", version: "ver_cmp_230", start: "2026-06-10", end: "2026-09-15", note: "開工早於產品建立。", submittedBy: "u_chang", submittedAt: "2026-07-02T02:00:00.000Z", adhoc: [{ id: "ah_txg_liquid", kind: "FEATURE_OVERRIDE", featureId: "ft_liquid", enabled: true, title: "", description: "2.3 尚未含液冷，這座廠提前試點。" }], revisions: [{ action: "SUBMIT", version: "ver_cmp_230", start: "2026-06-10", end: "2026-09-15", actor: "u_chang", at: "2026-07-02T02:00:00.000Z" }] },
    { factory: "f_txg", product: "plt_storage", status: "APPROVED", version: "ver_stg_160", start: "2026-07-20", end: "2026-10-15", submittedBy: "u_wang", submittedAt: "2026-07-25T02:00:00.000Z", approvedBy: "u_chen", approvedAt: "2026-07-28T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_stg_160", start: "2026-07-20", end: "2026-10-15", actor: "u_wang", at: "2026-07-25T02:00:00.000Z" }, { action: "APPROVE", version: "ver_stg_160", start: "2026-07-20", end: "2026-10-15", actor: "u_chen", at: "2026-07-28T02:00:00.000Z" }] },
    { factory: "f_txg", product: "plt_data", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_txg", product: "plt_dev", status: "SUBMITTED", version: null, enabled: devSandbox, start: "2026-08-01", end: "2026-10-20", submittedBy: "u_wu", submittedAt: "2026-08-05T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: null, start: "2026-08-01", end: "2026-10-20", actor: "u_wu", at: "2026-08-05T02:00:00.000Z" }] },
    { factory: "f_txg", product: "plt_mon", status: "APPROVED", version: null, enabled: monDiag, start: "2026-07-05", end: "2026-09-30", submittedBy: "u_cheng", submittedAt: "2026-07-10T02:00:00.000Z", approvedBy: "u_chen", approvedAt: "2026-07-12T02:00:00.000Z", revisions: [{ action: "APPROVE", version: null, start: "2026-07-05", end: "2026-09-30", actor: "u_chen", at: "2026-07-12T02:00:00.000Z" }] },
    { factory: "f_khh", product: "plt_compute", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_khh", product: "plt_storage", status: "SUBMITTED", version: "ver_stg_140", start: "2026-05-01", end: "2026-11-15", note: "受電延後，完工超出階段。", submittedBy: "u_wang", submittedAt: "2026-06-01T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_stg_140", start: "2026-05-01", end: "2026-11-15", actor: "u_wang", at: "2026-06-01T02:00:00.000Z" }] },
    { factory: "f_khh", product: "plt_data", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_khh", product: "plt_dev", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_khh", product: "plt_mon", status: "SUBMITTED", version: null, enabled: monBase, start: "2026-06-01", end: "2026-09-01", note: "維持預設：只開告警路由。", submittedBy: "u_cheng", submittedAt: "2026-06-02T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: null, start: "2026-06-01", end: "2026-09-01", actor: "u_cheng", at: "2026-06-02T02:00:00.000Z" }] },
    { factory: "f_tnn", product: "plt_compute", status: "APPROVED", version: "ver_cmp_240", start: "2026-04-20", end: "2026-07-31", submittedBy: "u_chang", submittedAt: "2026-04-10T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-04-12T02:00:00.000Z", revisions: [{ action: "APPROVE", version: "ver_cmp_240", start: "2026-04-20", end: "2026-07-31", actor: "u_huang", at: "2026-04-12T02:00:00.000Z" }] },
    { factory: "f_tnn", product: "plt_storage", status: "APPROVED", version: "ver_stg_170", start: "2026-05-01", end: "2026-08-01", submittedBy: "u_wang", submittedAt: "2026-04-18T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-04-19T02:00:00.000Z", revisions: [{ action: "APPROVE", version: "ver_stg_170", start: "2026-05-01", end: "2026-08-01", actor: "u_huang", at: "2026-04-19T02:00:00.000Z" }] },
    { factory: "f_tnn", product: "plt_data", status: "APPROVED", version: null, enabled: dataOn, start: "2026-05-10", end: "2026-08-10", submittedBy: "u_liu", submittedAt: "2026-04-20T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-04-21T02:00:00.000Z", revisions: [{ action: "APPROVE", version: null, start: "2026-05-10", end: "2026-08-10", actor: "u_huang", at: "2026-04-21T02:00:00.000Z" }] },
    { factory: "f_tnn", product: "plt_dev", status: "APPROVED", version: null, enabled: devOn, start: "2026-06-01", end: "2026-08-12", submittedBy: "u_wu", submittedAt: "2026-05-02T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-05-03T02:00:00.000Z", revisions: [{ action: "APPROVE", version: null, start: "2026-06-01", end: "2026-08-12", actor: "u_huang", at: "2026-05-03T02:00:00.000Z" }] },
    { factory: "f_tnn", product: "plt_mon", status: "APPROVED", version: null, enabled: monOn, start: "2026-04-15", end: "2026-07-20", submittedBy: "u_cheng", submittedAt: "2026-04-08T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-04-09T02:00:00.000Z", revisions: [{ action: "APPROVE", version: null, start: "2026-04-15", end: "2026-07-20", actor: "u_huang", at: "2026-04-09T02:00:00.000Z" }] },
    { factory: "f_kum", product: "plt_compute", status: "SUBMITTED", version: "ver_cmp_240", start: "2026-12-01", end: "2027-03-15", note: "預先鎖版，人在熊本的副責是周宜安。", submittedBy: "u_chang", submittedAt: "2026-10-01T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_cmp_240", start: "2026-12-01", end: "2027-03-15", actor: "u_chang", at: "2026-10-01T02:00:00.000Z" }] },
    { factory: "f_kum", product: "plt_storage", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_kum", product: "plt_data", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_kum", product: "plt_dev", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_kum", product: "plt_mon", status: "NOT_SUBMITTED", version: null, start: null, end: null },
  ];
  for (const spec of plans) addPlan(db, spec);

  addMilestones(db);
  addIssues(db);
  addTopics(db);
  addActivity(db);
  return db;
}

function addFactory(
  db: Database,
  input: {
    id: string;
    code: string;
    name: string;
    location: string;
    description: string;
    category: string;
    region: string;
    technology: string;
    pmId: string;
    status: Database["factories"][number]["status"];
    phases: PhaseSpec[];
  },
) {
  const first = input.phases[0];
  const last = input.phases[input.phases.length - 1];
  db.factories.push({
    id: input.id,
    code: input.code,
    name: input.name,
    location: input.location,
    description: input.description,
    category: input.category,
    region: input.region,
    technology: input.technology,
    pmId: input.pmId,
    plannedStart: first.plannedStart,
    plannedEnd: last.plannedEnd,
    actualStart: first.actualStart,
    actualEnd: input.status === "COMPLETED" ? last.actualEnd : null,
    status: input.status,
  });
  input.phases.forEach((phase, index) => {
    const id = `${input.id}_p${index + 1}`;
    const template = db.phaseTemplates.find((item) => item.order === index + 1) ?? null;
    db.phases.push({
      id,
      factoryId: input.id,
      templateId: template?.id ?? null,
      name: phase.name,
      order: index + 1,
      ownerId: phase.owner,
      plannedStart: phase.plannedStart,
      plannedEnd: phase.plannedEnd,
      actualStart: phase.actualStart,
      actualEnd: phase.actualEnd,
      status: phase.status,
      riskNote: phase.riskNote ?? "",
      dependsOnPhaseIds: index === 0 ? [] : [`${input.id}_p${index}`],
    });
  });
}

function addDeployment(db: Database, spec: DepSpec) {
  const id = `dep_${spec.factory}_${spec.product}`;
  const product = db.products.find((item) => item.id === spec.product);
  const featureOnly = product?.mode === "FEATURE_ONLY";
  const deployment: ProductDeployment = {
    id,
    factoryId: spec.factory,
    productId: spec.product,
    plannedVersionId: featureOnly ? null : spec.planned,
    actualVersionId: featureOnly ? null : spec.actual,
    status: spec.status,
    secondaryOwnerId: spec.secondary,
    plannedDate: spec.plannedDate,
    deployedAt: spec.deployedAt,
    notes: "",
  };
  db.deployments.push(deployment);
  const phase2 = db.phases.find((phase) => phase.factoryId === spec.factory && phase.order === 2);
  const defaults: Record<string, number> = {
    plt_compute: 480,
    plt_storage: 240,
    plt_data: 96,
    plt_dev: 64,
    plt_mon: 48,
  };
  const total = spec.machines ?? defaults[spec.product] ?? 0;
  const ratio = spec.factory === "f_khh" ? 0.8 : spec.factory === "f_kum" ? 0.55 : 0.65;
  const plannedA = Math.round(total * ratio);
  db.machineQuantities.push(
    { id: `mq_${id}_a`, deploymentId: id, machineTypeId: "mt_a", planned: plannedA },
    { id: `mq_${id}_b`, deploymentId: id, machineTypeId: "mt_b", planned: total - plannedA },
  );
  if (phase2) {
    db.phaseLinks.push({ id: `lnk_${id}_in`, deploymentId: id, phaseId: phase2.id, relation: "INTRODUCED" });
    if (spec.upgraded) {
      db.phaseLinks.push({ id: `lnk_${id}_up`, deploymentId: id, phaseId: phase2.id, relation: "UPGRADED" });
    }
    if (spec.status === "ACCEPTED") {
      db.phaseLinks.push({ id: `lnk_${id}_ac`, deploymentId: id, phaseId: phase2.id, relation: "ACCEPTED" });
    }
  }
  const platformFeatures = db.features.filter((feature) => feature.productId === spec.product);
  for (const feature of platformFeatures) {
    const desired = featureOnly ? feature.defaultEnabled : spec.planned ? supports(db, spec.planned, feature.id) : false;
    let actual: boolean | null = null;
    if (featureOnly && spec.status !== "PLANNED") {
      actual = feature.defaultEnabled;
    } else if (!featureOnly && spec.actual && spec.status !== "PLANNED") {
      const supported = supports(db, spec.actual, feature.id);
      actual = spec.actualOff?.includes(feature.id) && supported ? false : supported;
    }
    db.featureConfigs.push({
      id: `fc_${id}_${feature.id}`,
      deploymentId: id,
      featureId: feature.id,
      desired,
      actual,
    });
  }
}

function supports(db: Database, versionId: string, featureId: string): boolean {
  return db.versionFeatures.some((row) => row.versionId === versionId && row.featureId === featureId && row.supported);
}

function addPlan(db: Database, spec: PlanSpec) {
  const deployment = db.deployments.find((item) => item.factoryId === spec.factory && item.productId === spec.product);
  if (!deployment) return;
  const product = db.products.find((item) => item.id === spec.product);
  const features = db.features.filter((feature) => feature.productId === spec.product);
  const featureOnly = product?.mode === "FEATURE_ONLY";
  let plannedFeatures: PlannedFeature[] = [];
  let adhoc = spec.adhoc ?? [];
  if (featureOnly && spec.enabled) {
    plannedFeatures = features.map((feature) => ({ featureId: feature.id, enabled: spec.enabled?.includes(feature.id) ?? false }));
    adhoc = featureOverrides(features, plannedFeatures, spec.reasons ?? {}, adhoc);
    for (const row of plannedFeatures) {
      const config = db.featureConfigs.find((item) => item.deploymentId === deployment.id && item.featureId === row.featureId);
      if (!config) continue;
      config.desired = row.enabled;
      if (deployment.status !== "PLANNED") config.actual = row.enabled;
    }
  }
  const id = `plan_${spec.factory}_${spec.product}`;
  const plan: ProductFactoryPlan = {
    id,
    factoryId: spec.factory,
    productId: spec.product,
    deploymentId: deployment.id,
    status: spec.status,
    providedVersionId: featureOnly ? null : spec.version,
    plannedFeatures,
    adHocChanges: adhoc,
    constructionStart: spec.start,
    constructionEnd: spec.end,
    note: spec.note ?? "",
    submittedById: spec.submittedBy ?? null,
    submittedAt: spec.submittedAt ?? null,
    approvedById: spec.approvedBy ?? null,
    approvedAt: spec.approvedAt ?? null,
  };
  db.plans.push(plan);
  const machines = db.machineQuantities
    .filter((row) => row.deploymentId === deployment.id)
    .map((row) => ({ machineTypeId: row.machineTypeId, planned: row.planned }));
  (spec.revisions ?? []).forEach((revision, index) => {
    const row: PlanRevision = {
      id: `rev_${id}_${index + 1}`,
      planId: id,
      number: index + 1,
      action: revision.action,
      providedVersionId: featureOnly ? null : revision.version,
      plannedFeatures,
      adHocChanges: adhoc,
      constructionStart: revision.start,
      constructionEnd: revision.end,
      machines,
      actorId: revision.actor,
      createdAt: revision.at,
      note: revision.note ?? "",
    };
    db.revisions.push(row);
  });
}

function addMilestones(db: Database) {
  const rows: Milestone[] = [
    { id: "ms_hsc_power", phaseId: "f_hsc_p1", name: "受電完成", dueDate: "2026-06-01", deliverables: "受電報告", done: true, completedAt: "2026-05-28T02:00:00.000Z", ownerId: "u_tsai" },
    { id: "ms_hsc_cmp", phaseId: "f_hsc_p2", name: "運算產品上線", dueDate: "2026-10-20", deliverables: "運算產品部署紀錄", done: false, completedAt: null, ownerId: "u_chang" },
    { id: "ms_hsc_review", phaseId: "f_hsc_p2", name: "產品建立審查", dueDate: "2026-11-20", deliverables: "五個產品計畫與實際版本", done: false, completedAt: null, ownerId: "u_lin" },
    { id: "ms_txg_cool", phaseId: "f_txg_p2", name: "液冷驗收", dueDate: "2026-10-10", deliverables: "水路測漏報告", done: false, completedAt: null, ownerId: "u_tsai" },
    { id: "ms_txg_stg", phaseId: "f_txg_p2", name: "儲存產品交貨", dueDate: "2026-09-30", deliverables: "到貨簽收", done: true, completedAt: "2026-09-26T02:00:00.000Z", ownerId: "u_wang" },
    { id: "ms_khh_power", phaseId: "f_khh_p2", name: "主變壓器送電", dueDate: "2026-08-30", deliverables: "送電許可", done: false, completedAt: null, ownerId: "u_tsai" },
    { id: "ms_tnn_dev", phaseId: "f_tnn_p3", name: "開發者環境驗收", dueDate: "2026-10-28", deliverables: "開發產品驗收單", done: false, completedAt: null, ownerId: "u_wu" },
    { id: "ms_tnn_close", phaseId: "f_tnn_p2", name: "產品建立結案", dueDate: "2026-08-12", deliverables: "結案紀錄", done: true, completedAt: "2026-08-12T02:00:00.000Z", ownerId: "u_huang" },
    { id: "ms_kum_ship", phaseId: "f_kum_p1", name: "海運到港", dueDate: "2026-10-30", deliverables: "提單與開箱", done: false, completedAt: null, ownerId: "u_chou" },
    { id: "ms_kum_freeze", phaseId: "f_kum_p1", name: "產品計畫凍結", dueDate: "2026-11-10", deliverables: "五個產品施工計畫", done: false, completedAt: null, ownerId: "u_lin" },
  ];
  db.milestones.push(...rows);
}

function addTopics(db: Database) {
  db.topics.push(
    {
      id: "tp_hsc_power",
      factoryId: "f_hsc",
      title: "高壓電契約容量不足",
      description: "產品建立期間運算與儲存同時上架，契約容量可能不夠。需要廠務確認是否加約。",
      ownerId: "u_lin",
      status: "OPEN",
      raisedOn: "2026-09-28",
    },
    {
      id: "tp_khh_water",
      factoryId: "f_khh",
      title: "純水系統延後",
      description: "純水預計晚於產品建立結束，影響冷卻與機台進場，要決定是否調整施工窗。",
      ownerId: "u_huang",
      status: "IN_DISCUSSION",
      raisedOn: "2026-08-12",
    },
    {
      id: "tp_khh_dock",
      factoryId: "f_khh",
      title: "機櫃進場動線衝突",
      description: "廠務施工與機櫃進場共用同一卸貨區，需要排開時段。",
      ownerId: "u_chen",
      status: "OPEN",
      raisedOn: "2026-10-02",
    },
    {
      id: "tp_txg_badge",
      factoryId: "f_txg",
      title: "開發者進駐門禁未核可",
      description: "開發者名單已交，廠區門禁系統還沒開通帳號。",
      ownerId: "u_chen",
      status: "OPEN",
      raisedOn: "2026-10-05",
    },
    {
      id: "tp_kum_land",
      factoryId: "f_kum",
      title: "土地使用分區確認",
      description: "海外廠區分區證明還在法務，可能影響硬體導入開工。",
      ownerId: "u_lin",
      status: "IN_DISCUSSION",
      raisedOn: "2026-07-20",
    },
  );
}

function addIssues(db: Database) {
  const rows: Issue[] = [
    { id: "iss_khh_xfmr", code: "ISS-014", title: "主變壓器交期落後", description: "高雄三廠主變壓器較計畫晚八週，產品建立無法送電。", factoryId: "f_khh", phaseId: "f_khh_p2", milestoneId: "ms_khh_power", productId: null, ownerId: "u_tsai", severity: "CRITICAL", priority: "P0", status: "OPEN", dueDate: "2026-09-01", resolution: "", updatedAt: "2026-10-12T02:00:00.000Z" },
    { id: "iss_khh_block", code: "ISS-015", title: "產品建立受電不足", description: "受電條件不足，運算產品計畫尚未提報。", factoryId: "f_khh", phaseId: "f_khh_p2", milestoneId: null, productId: "plt_compute", ownerId: "u_huang", severity: "HIGH", priority: "P0", status: "BLOCKED", dueDate: "2026-09-20", resolution: "", updatedAt: "2026-10-11T02:00:00.000Z" },
    { id: "iss_txg_cool", code: "ISS-021", title: "液冷水路未達驗收", description: "台中運算產品液冷測漏未過，影響 2.3 進版。", factoryId: "f_txg", phaseId: "f_txg_p2", milestoneId: "ms_txg_cool", productId: "plt_compute", ownerId: "u_tsai", severity: "HIGH", priority: "P1", status: "OPEN", dueDate: "2026-10-10", resolution: "", updatedAt: "2026-10-16T02:00:00.000Z" },
    { id: "iss_hsc_plan", code: "ISS-008", title: "開發產品施工計畫未提報", description: "新竹一廠開發產品仍是未提報，產品建立審查前需要功能開關與時程。", factoryId: "f_hsc", phaseId: "f_hsc_p2", milestoneId: "ms_hsc_review", productId: "plt_dev", ownerId: "u_wu", severity: "MEDIUM", priority: "P1", status: "OPEN", dueDate: "2026-10-25", resolution: "", updatedAt: "2026-10-14T02:00:00.000Z" },
    { id: "iss_kum_ship", code: "ISS-030", title: "熊本機櫃海運波動", description: "兩批機櫃改靠港，硬體導入有風險。產品計畫多數尚未提報。", factoryId: "f_kum", phaseId: "f_kum_p1", milestoneId: "ms_kum_ship", productId: null, ownerId: "u_chou", severity: "MEDIUM", priority: "P2", status: "IN_PROGRESS", dueDate: "2026-11-20", resolution: "", updatedAt: "2026-10-15T02:00:00.000Z" },
    { id: "iss_tnn_doc", code: "ISS-003", title: "產品建立結案文件補章", description: "台南結案文件已補齊。", factoryId: "f_tnn", phaseId: "f_tnn_p2", milestoneId: "ms_tnn_close", productId: null, ownerId: "u_huang", severity: "LOW", priority: "P3", status: "RESOLVED", dueDate: "2026-08-20", resolution: "2026-08-18 補齊簽核掃描檔。", updatedAt: "2026-08-18T02:00:00.000Z" },
  ];
  db.issues.push(...rows);
}

function addActivity(db: Database) {
  const rows: Activity[] = [
    act("act_1", "PLAN", "plan_f_hsc_plt_compute", "APPROVE", "林品均核准新竹一廠運算產品計畫，提供版本 2.4.0。", "u_lin", "2026-09-05T02:00:00.000Z"),
    act("act_2", "PLAN", "plan_f_hsc_plt_compute", "SUBMIT", "張承恩改提運算產品 2.4.0，新增液冷支援。", "u_chang", "2026-09-02T01:00:00.000Z"),
    act("act_3", "DEPLOYMENT", "dep_f_hsc_plt_compute", "ACTUAL_VERSION", "新竹運算產品實際版本填報為 2.4.0，液冷實際未啟用。", "u_tsai", "2026-09-28T06:00:00.000Z"),
    act("act_4", "PLAN", "plan_f_txg_plt_compute", "SUBMIT", "台中運算產品施工窗早於產品建立，計畫已提報尚未核准。", "u_chen", "2026-10-11T03:00:00.000Z"),
    act("act_5", "ISSUE", "iss_txg_cool", "UPDATE", "液冷水路問題逾期，仍開啟。", "u_tsai", "2026-10-16T02:00:00.000Z"),
    act("act_6", "ISSUE", "iss_khh_block", "STATUS", "高雄運算產品仍未提報，受電不足。", "u_huang", "2026-09-30T04:00:00.000Z"),
    act("act_7", "ISSUE", "iss_khh_xfmr", "CREATE", "登錄主變壓器交期落後，嚴重程度嚴重。", "u_tsai", "2026-08-15T02:00:00.000Z"),
    act("act_8", "PLAN", "plan_f_hsc_plt_dev", "NOTE", "新竹開發產品施工計畫仍未提報。", "u_lin", "2026-10-14T02:00:00.000Z"),
    act("act_9", "PLAN", "plan_f_tnn_plt_data", "APPROVE", "台南資料產品以功能開關提報，相對預設開啟特徵庫與批次追溯。", "u_huang", "2026-10-09T02:00:00.000Z"),
    act("act_10", "FACTORY", "f_khh", "STATUS", "高雄三廠整體狀態改為延遲。", "u_huang", "2026-10-02T02:00:00.000Z"),
    act("act_11", "PLAN", "plan_f_kum_plt_compute", "SUBMIT", "張承恩提報熊本運算產品計畫，施工窗落在產品建立區間內。", "u_chang", "2026-10-01T02:00:00.000Z"),
    act("act_12", "PHASE", "f_txg_p2", "STATUS", "台中產品建立標記為有風險。", "u_chen", "2026-10-08T02:00:00.000Z"),
  ];
  db.activity.push(...rows);
}

function act(
  id: string,
  entityType: Activity["entityType"],
  entityId: string,
  action: string,
  summary: string,
  actorId: string,
  createdAt: string,
): Activity {
  return { id, entityType, entityId, action, summary, actorId, createdAt };
}
