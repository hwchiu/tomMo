import type {
  Activity,
  Database,
  DeploymentStatus,
  FeatureChange,
  Handoff,
  Issue,
  Milestone,
  Phase,
  PlanRevision,
  PlanStatus,
  PlatformDeployment,
  PlatformFactoryPlan,
  RevisionAction,
} from "@/domain/types";

const AS_OF = "2026-10-18";

interface DepSpec {
  factory: string;
  platform: string;
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
  changes?: FeatureChange[];
  actor: string;
  at: string;
  note?: string;
}

interface PlanSpec {
  factory: string;
  platform: string;
  status: PlanStatus;
  version: string | null;
  start: string | null;
  end: string | null;
  changes?: FeatureChange[];
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
      { id: "en_giga", set: "factoryCategory", code: "GIGA", label: "Giga", description: "超大型廠，一次進駐多個平台", order: 1, active: true },
      { id: "en_phase", set: "factoryCategory", code: "PHASE", label: "Phase", description: "分期廠，平台分波進駐", order: 2, active: true },
      { id: "en_hq", set: "factoryRegion", code: "HQ", label: "總部 HQ", description: "總部廠區", order: 1, active: true },
      { id: "en_os", set: "factoryRegion", code: "OVERSEA", label: "海外 Oversea", description: "海外廠區", order: 2, active: true },
      { id: "en_n3", set: "technologyNode", code: "N3", label: "N3", description: "N3 製程節點", order: 1, active: true },
      { id: "en_n2", set: "technologyNode", code: "N2", label: "N2", description: "N2 製程節點", order: 2, active: true },
    ],
    users: [
      { id: "u_lin", name: "林品均", email: "lin.pinjun@example.com", role: "PM", title: "廠務 PM" },
      { id: "u_chen", name: "陳浩宇", email: "chen.haoyu@example.com", role: "PM", title: "廠務 PM" },
      { id: "u_huang", name: "黃詩涵", email: "huang.shihan@example.com", role: "PM", title: "廠務 PM" },
      { id: "u_chang", name: "張承恩", email: "chang.chengen@example.com", role: "ENGINEER", title: "運算平台主責" },
      { id: "u_wang", name: "王雅婷", email: "wang.yating@example.com", role: "ENGINEER", title: "儲存平台主責" },
      { id: "u_liu", name: "劉子豪", email: "liu.zihao@example.com", role: "ENGINEER", title: "資料平台主責" },
      { id: "u_wu", name: "吳佩蓉", email: "wu.peirong@example.com", role: "ENGINEER", title: "開發平台主責" },
      { id: "u_cheng", name: "鄭凱翔", email: "cheng.kaixiang@example.com", role: "ENGINEER", title: "監控平台主責" },
      { id: "u_chou", name: "周宜安", email: "chou.yian@example.com", role: "ENGINEER", title: "海外廠務工程師" },
      { id: "u_tsai", name: "蔡明哲", email: "tsai.mingzhe@example.com", role: "ENGINEER", title: "廠務工程師" },
    ],
    phaseTemplates: [
      { id: "tpl_1", code: "HW", name: "硬體導入 Hardware Onboarding", description: "廠房、電力、機櫃與網路硬體到位", order: 1, defaultDurationDays: 100 },
      { id: "tpl_2", code: "PLT", name: "平台建立 Platform Build", description: "各平台進廠、施工、部署到可交給開發者", order: 2, defaultDurationDays: 150 },
      { id: "tpl_3", code: "DEV", name: "開發者進駐 Developer Onboarding", description: "開發團隊進駐、環境驗收與權限", order: 3, defaultDurationDays: 75 },
      { id: "tpl_4", code: "OPS", name: "開始營運 Operations Start", description: "營運交接、值班與穩態", order: 4, defaultDurationDays: 45 },
    ],
    factories: [],
    phases: [],
    milestones: [],
    platforms: [
      { id: "plt_compute", code: "CMP", name: "運算平台 Compute", description: "GPU／CPU 機櫃、液冷與排程。", devDepartment: "運算開發處", projectDepartment: "平台專案一處", primaryOwnerId: "u_chang" },
      { id: "plt_storage", code: "STG", name: "儲存平台 Storage", description: "熱溫冷分層、快照與跨廠複製。", devDepartment: "儲存開發處", projectDepartment: "平台專案一處", primaryOwnerId: "u_wang" },
      { id: "plt_data", code: "DAT", name: "資料平台 Data", description: "訓練資料血緣、特徵庫與批次追溯。", devDepartment: "資料平台處", projectDepartment: "平台專案二處", primaryOwnerId: "u_liu" },
      { id: "plt_dev", code: "DEV", name: "開發平台 Developer", description: "映像倉庫、沙箱與 IDE 閘道。", devDepartment: "開發者平台處", projectDepartment: "平台專案二處", primaryOwnerId: "u_wu" },
      { id: "plt_mon", code: "MON", name: "監控平台 Monitoring", description: "告警路由、遠端診斷與 OEE。", devDepartment: "監控平台處", projectDepartment: "廠務可靠度處", primaryOwnerId: "u_cheng" },
    ],
    versions: [],
    features: [
      { id: "ft_gpu", platformId: "plt_compute", code: "gpu_partition", name: "GPU 分割", description: "單機多租戶切分" },
      { id: "ft_rack", platformId: "plt_compute", code: "rack_scale", name: "機櫃級擴展", description: "以機櫃為單位擴充" },
      { id: "ft_liquid", platformId: "plt_compute", code: "liquid_cooling", name: "液冷支援", description: "液冷迴路監控與排程" },
      { id: "ft_nvme", platformId: "plt_storage", code: "nvme_tier", name: "NVMe 分層", description: "熱層 NVMe" },
      { id: "ft_snap", platformId: "plt_storage", code: "snapshot", name: "快照", description: "資料快照" },
      { id: "ft_xsite", platformId: "plt_storage", code: "cross_site", name: "跨廠複製", description: "跨廠非同步複製" },
      { id: "ft_lineage", platformId: "plt_data", code: "lineage", name: "資料血緣", description: "資料集血緣" },
      { id: "ft_fstore", platformId: "plt_data", code: "feature_store", name: "特徵庫", description: "線上特徵" },
      { id: "ft_trace", platformId: "plt_data", code: "batch_trace", name: "批次追溯", description: "訓練批次追溯" },
      { id: "ft_reg", platformId: "plt_dev", code: "registry", name: "映像倉庫", description: "容器映像" },
      { id: "ft_sand", platformId: "plt_dev", code: "sandbox", name: "沙箱", description: "隔離開發沙箱" },
      { id: "ft_ide", platformId: "plt_dev", code: "ide_gateway", name: "IDE 閘道", description: "遠端 IDE" },
      { id: "ft_alert", platformId: "plt_mon", code: "alert_route", name: "告警路由", description: "分級告警" },
      { id: "ft_diag", platformId: "plt_mon", code: "remote_diag", name: "遠端診斷", description: "遠端診斷通道" },
      { id: "ft_oee", platformId: "plt_mon", code: "oee_dashboard", name: "OEE 看板", description: "設備綜合效率" },
    ],
    versionFeatures: [],
    deployments: [],
    phaseLinks: [],
    featureConfigs: [],
    plans: [],
    revisions: [],
    handoffs: [],
    requirements: [],
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
    ver_dat_300: ["ft_lineage"],
    ver_dat_310: ["ft_lineage", "ft_fstore"],
    ver_dat_320: ["ft_lineage", "ft_fstore", "ft_trace"],
    ver_dev_100: ["ft_reg"],
    ver_dev_110: ["ft_reg", "ft_sand"],
    ver_dev_120: ["ft_reg", "ft_sand", "ft_ide"],
    ver_mon_110: ["ft_alert"],
    ver_mon_120: ["ft_alert", "ft_diag"],
    ver_mon_130: ["ft_alert", "ft_diag", "ft_oee"],
  };

  const versionRows: Array<[string, string, string, string | null, string]> = [
    ["ver_cmp_220", "plt_compute", "2.2.0", "2026-03-01", "基礎 GPU 分割"],
    ["ver_cmp_230", "plt_compute", "2.3.0", "2026-06-12", "加入機櫃級擴展"],
    ["ver_cmp_240", "plt_compute", "2.4.0", "2026-09-01", "液冷支援"],
    ["ver_stg_140", "plt_storage", "1.4.0", "2026-02-01", "NVMe 熱層"],
    ["ver_stg_160", "plt_storage", "1.6.0", "2026-06-20", "快照"],
    ["ver_stg_170", "plt_storage", "1.7.0", "2026-09-08", "跨廠複製"],
    ["ver_dat_300", "plt_data", "3.0.0", "2026-01-20", "血緣"],
    ["ver_dat_310", "plt_data", "3.1.0", "2026-05-18", "特徵庫"],
    ["ver_dat_320", "plt_data", "3.2.0", "2026-08-30", "批次追溯"],
    ["ver_dev_100", "plt_dev", "1.0.0", "2026-04-01", "映像倉庫"],
    ["ver_dev_110", "plt_dev", "1.1.0", "2026-07-01", "沙箱"],
    ["ver_dev_120", "plt_dev", "1.2.0", "2026-09-15", "IDE 閘道"],
    ["ver_mon_110", "plt_mon", "1.1.0", "2026-03-12", "告警路由"],
    ["ver_mon_120", "plt_mon", "1.2.0", "2026-07-22", "遠端診斷"],
    ["ver_mon_130", "plt_mon", "1.3.0", "2026-09-20", "OEE 看板"],
  ];
  for (const [id, platformId, version, releasedAt, notes] of versionRows) {
    db.versions.push({ id, platformId, version, releasedAt, notes });
    for (const featureId of db.features.filter((feature) => feature.platformId === platformId).map((feature) => feature.id)) {
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
    description: "Giga 廠，N3，平台建立進行中。開發平台尚未提報施工計畫。",
    category: "GIGA",
    region: "HQ",
    technology: "N3",
    pmId: "u_lin",
    pmContact: { name: "林品均", email: "lin.pinjun@example.com", phone: "分機 2101" },
    status: "ON_TRACK",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-03-02", plannedEnd: "2026-06-15", actualStart: "2026-03-04", actualEnd: "2026-06-12", status: "COMPLETED" },
      { name: "平台建立 Platform Build", owner: "u_lin", plannedStart: "2026-06-16", plannedEnd: "2026-11-30", actualStart: "2026-06-18", actualEnd: null, status: "IN_PROGRESS" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-12-01", plannedEnd: "2027-02-28", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開始營運 Operations Start", owner: "u_lin", plannedStart: "2027-03-01", plannedEnd: "2027-04-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });
  addFactory(db, {
    id: "f_txg",
    code: "FAB-TXG",
    name: "台中二廠",
    location: "台中精密園區",
    description: "分期廠。運算平台施工窗提早開工，版本仍停在 2.2。",
    category: "PHASE",
    region: "HQ",
    technology: "N3",
    pmId: "u_chen",
    pmContact: { name: "陳浩宇", email: "chen.haoyu@example.com", phone: "分機 3208" },
    status: "AT_RISK",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-04-01", plannedEnd: "2026-06-30", actualStart: "2026-04-06", actualEnd: "2026-07-08", status: "COMPLETED" },
      { name: "平台建立 Platform Build", owner: "u_chen", plannedStart: "2026-07-01", plannedEnd: "2026-10-31", actualStart: "2026-07-18", actualEnd: null, status: "AT_RISK", riskNote: "液冷水路未驗收，運算版本落後提供版本。" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-11-01", plannedEnd: "2027-01-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開始營運 Operations Start", owner: "u_chen", plannedStart: "2027-01-16", plannedEnd: "2027-03-01", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });
  addFactory(db, {
    id: "f_khh",
    code: "FAB-KHH",
    name: "高雄三廠",
    location: "高雄科學園區",
    description: "Giga、N2。主變壓器延遲，平台建立已超過計畫結束日。",
    category: "GIGA",
    region: "HQ",
    technology: "N2",
    pmId: "u_huang",
    pmContact: { name: "黃詩涵", email: "huang.shihan@example.com", phone: "分機 4502" },
    status: "DELAYED",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-01-06", plannedEnd: "2026-03-31", actualStart: "2026-01-10", actualEnd: "2026-04-28", status: "COMPLETED" },
      { name: "平台建立 Platform Build", owner: "u_huang", plannedStart: "2026-04-01", plannedEnd: "2026-09-30", actualStart: "2026-05-06", actualEnd: null, status: "DELAYED", riskNote: "主變壓器未送電，多數平台計畫未提報。" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-10-01", plannedEnd: "2026-12-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開始營運 Operations Start", owner: "u_huang", plannedStart: "2026-12-16", plannedEnd: "2027-01-31", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });
  addFactory(db, {
    id: "f_tnn",
    code: "FAB-TNN",
    name: "台南四廠",
    location: "台南科學園區",
    description: "分期廠、N2。平台建立已結案，等待接收方手動驗收後進入開發者進駐。",
    category: "PHASE",
    region: "HQ",
    technology: "N2",
    pmId: "u_huang",
    pmContact: { name: "黃詩涵", email: "huang.shihan@example.com", phone: "分機 4608" },
    status: "ON_TRACK",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-01-15", plannedEnd: "2026-03-31", actualStart: "2026-01-15", actualEnd: "2026-03-28", status: "COMPLETED" },
      { name: "平台建立 Platform Build", owner: "u_huang", plannedStart: "2026-04-01", plannedEnd: "2026-08-15", actualStart: "2026-04-01", actualEnd: "2026-08-12", status: "COMPLETED" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-08-16", plannedEnd: "2026-11-15", actualStart: "2026-08-18", actualEnd: null, status: "IN_PROGRESS" },
      { name: "開始營運 Operations Start", owner: "u_huang", plannedStart: "2026-11-16", plannedEnd: "2026-12-31", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });
  addFactory(db, {
    id: "f_kum",
    code: "FAB-KUM",
    name: "熊本一廠",
    location: "熊本",
    description: "海外 Giga 廠。硬體仍在進場，平台建立尚未開始，多數施工計畫未提報。",
    category: "GIGA",
    region: "OVERSEA",
    technology: "N3",
    pmId: "u_lin",
    pmContact: { name: "林品均", email: "lin.pinjun@example.com", phone: "分機 5103" },
    status: "AT_RISK",
    phases: [
      { name: "硬體導入 Hardware Onboarding", owner: "u_chou", plannedStart: "2026-08-01", plannedEnd: "2026-11-14", actualStart: "2026-08-20", actualEnd: null, status: "AT_RISK", riskNote: "海運機櫃到港不穩。" },
      { name: "平台建立 Platform Build", owner: "u_lin", plannedStart: "2026-11-15", plannedEnd: "2027-04-30", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2027-05-01", plannedEnd: "2027-07-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      { name: "開始營運 Operations Start", owner: "u_lin", plannedStart: "2027-07-16", plannedEnd: "2027-09-01", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
    ],
  });

  const liquid: FeatureChange = { featureId: "ft_liquid", changeType: "ADDED", summary: "相對 2.3 新增液冷支援" };
  const rackChanged: FeatureChange = { featureId: "ft_rack", changeType: "CHANGED", summary: "機櫃電力拓撲改為雙迴路" };
  const snap: FeatureChange = { featureId: "ft_snap", changeType: "ADDED", summary: "相對 1.4 新增快照" };
  const trace: FeatureChange = { featureId: "ft_trace", changeType: "ADDED", summary: "相對 3.1 新增批次追溯" };
  const ide: FeatureChange = { featureId: "ft_ide", changeType: "ADDED", summary: "相對 1.1 新增 IDE 閘道" };
  const oee: FeatureChange = { featureId: "ft_oee", changeType: "ADDED", summary: "相對 1.2 新增 OEE 看板" };

  const deployments: DepSpec[] = [
    { factory: "f_hsc", platform: "plt_compute", planned: "ver_cmp_240", actual: "ver_cmp_240", status: "DEPLOYED", secondary: "u_tsai", machines: 640, plannedDate: "2026-09-15", deployedAt: "2026-09-28", actualOff: ["ft_liquid"], upgraded: true },
    { factory: "f_hsc", platform: "plt_storage", planned: "ver_stg_160", actual: "ver_stg_160", status: "IN_PROGRESS", secondary: "u_wang", machines: 300, plannedDate: "2026-11-15", deployedAt: null },
    { factory: "f_hsc", platform: "plt_data", planned: "ver_dat_320", actual: "ver_dat_320", status: "DEPLOYED", secondary: "u_liu", machines: null, plannedDate: "2026-10-15", deployedAt: "2026-10-08" },
    { factory: "f_hsc", platform: "plt_dev", planned: "ver_dev_120", actual: null, status: "PLANNED", secondary: "u_wu", machines: null, plannedDate: "2026-11-20", deployedAt: null },
    { factory: "f_hsc", platform: "plt_mon", planned: "ver_mon_120", actual: "ver_mon_120", status: "DEPLOYED", secondary: "u_cheng", machines: null, plannedDate: "2026-10-30", deployedAt: "2026-10-12" },
    { factory: "f_txg", platform: "plt_compute", planned: "ver_cmp_230", actual: "ver_cmp_220", status: "IN_PROGRESS", secondary: "u_tsai", machines: 200, plannedDate: "2026-10-20", deployedAt: null },
    { factory: "f_txg", platform: "plt_storage", planned: "ver_stg_160", actual: "ver_stg_160", status: "DEPLOYED", secondary: "u_tsai", machines: 120, plannedDate: "2026-10-01", deployedAt: "2026-09-26", actualOff: ["ft_snap"] },
    { factory: "f_txg", platform: "plt_data", planned: "ver_dat_310", actual: null, status: "PLANNED", secondary: "u_liu", machines: null, plannedDate: "2026-10-31", deployedAt: null },
    { factory: "f_txg", platform: "plt_dev", planned: "ver_dev_110", actual: "ver_dev_110", status: "IN_PROGRESS", secondary: "u_wu", machines: null, plannedDate: "2026-10-20", deployedAt: null },
    { factory: "f_txg", platform: "plt_mon", planned: "ver_mon_120", actual: "ver_mon_120", status: "DEPLOYED", secondary: "u_cheng", machines: null, plannedDate: "2026-09-30", deployedAt: "2026-09-18" },
    { factory: "f_khh", platform: "plt_compute", planned: "ver_cmp_240", actual: null, status: "IN_PROGRESS", secondary: "u_tsai", machines: 860, plannedDate: "2026-09-15", deployedAt: null },
    { factory: "f_khh", platform: "plt_storage", planned: "ver_stg_160", actual: "ver_stg_140", status: "IN_PROGRESS", secondary: "u_tsai", machines: 400, plannedDate: "2026-10-30", deployedAt: null },
    { factory: "f_khh", platform: "plt_data", planned: "ver_dat_300", actual: null, status: "PLANNED", secondary: "u_liu", machines: 140, plannedDate: "2026-11-30", deployedAt: null },
    { factory: "f_khh", platform: "plt_dev", planned: "ver_dev_110", actual: null, status: "PLANNED", secondary: "u_wu", machines: null, plannedDate: "2026-12-15", deployedAt: null },
    { factory: "f_khh", platform: "plt_mon", planned: "ver_mon_130", actual: "ver_mon_110", status: "DEPLOYED", secondary: "u_cheng", machines: null, plannedDate: "2026-08-30", deployedAt: "2026-08-20" },
    { factory: "f_tnn", platform: "plt_compute", planned: "ver_cmp_240", actual: "ver_cmp_240", status: "ACCEPTED", secondary: "u_chang", machines: 180, plannedDate: "2026-07-31", deployedAt: "2026-07-28" },
    { factory: "f_tnn", platform: "plt_storage", planned: "ver_stg_170", actual: "ver_stg_170", status: "ACCEPTED", secondary: "u_wang", machines: 90, plannedDate: "2026-08-01", deployedAt: "2026-07-30" },
    { factory: "f_tnn", platform: "plt_data", planned: "ver_dat_320", actual: "ver_dat_320", status: "ACCEPTED", secondary: "u_liu", machines: 40, plannedDate: "2026-08-10", deployedAt: "2026-08-08" },
    { factory: "f_tnn", platform: "plt_dev", planned: "ver_dev_120", actual: "ver_dev_120", status: "ACCEPTED", secondary: "u_wu", machines: 24, plannedDate: "2026-08-12", deployedAt: "2026-08-11" },
    { factory: "f_tnn", platform: "plt_mon", planned: "ver_mon_130", actual: "ver_mon_130", status: "ACCEPTED", secondary: "u_cheng", machines: 20, plannedDate: "2026-07-20", deployedAt: "2026-07-18" },
    { factory: "f_kum", platform: "plt_compute", planned: "ver_cmp_240", actual: null, status: "PLANNED", secondary: "u_chou", machines: 520, plannedDate: "2027-03-15", deployedAt: null },
    { factory: "f_kum", platform: "plt_storage", planned: "ver_stg_170", actual: null, status: "PLANNED", secondary: "u_chou", machines: null, plannedDate: "2027-03-30", deployedAt: null },
    { factory: "f_kum", platform: "plt_data", planned: "ver_dat_320", actual: null, status: "PLANNED", secondary: "u_chou", machines: null, plannedDate: "2027-04-15", deployedAt: null },
    { factory: "f_kum", platform: "plt_dev", planned: "ver_dev_120", actual: null, status: "PLANNED", secondary: "u_chou", machines: null, plannedDate: "2027-04-20", deployedAt: null },
    { factory: "f_kum", platform: "plt_mon", planned: "ver_mon_130", actual: null, status: "PLANNED", secondary: "u_chou", machines: null, plannedDate: "2027-04-01", deployedAt: null },
  ];
  for (const spec of deployments) addDeployment(db, spec);

  const plans: PlanSpec[] = [
    {
      factory: "f_hsc", platform: "plt_compute", status: "APPROVED", version: "ver_cmp_240", start: "2026-07-01", end: "2026-09-30",
      changes: [liquid, rackChanged], note: "第二版納入液冷。", submittedBy: "u_chang", submittedAt: "2026-09-02T01:00:00.000Z", approvedBy: "u_lin", approvedAt: "2026-09-05T02:00:00.000Z",
      revisions: [
        { action: "SUBMIT", version: "ver_cmp_230", start: "2026-07-01", end: "2026-09-15", changes: [{ featureId: "ft_rack", changeType: "ADDED", summary: "相對 2.2 新增機櫃級擴展" }], actor: "u_chang", at: "2026-08-01T01:00:00.000Z", note: "第一版" },
        { action: "SUBMIT", version: "ver_cmp_240", start: "2026-07-01", end: "2026-09-30", changes: [liquid, rackChanged], actor: "u_chang", at: "2026-09-02T01:00:00.000Z", note: "改提供 2.4.0" },
        { action: "APPROVE", version: "ver_cmp_240", start: "2026-07-01", end: "2026-09-30", changes: [liquid, rackChanged], actor: "u_lin", at: "2026-09-05T02:00:00.000Z", note: "PM 核准" },
      ],
    },
    { factory: "f_hsc", platform: "plt_storage", status: "SUBMITTED", version: "ver_stg_160", start: "2026-08-01", end: "2026-12-20", changes: [snap], note: "完工超出平台建立結束日。", submittedBy: "u_wang", submittedAt: "2026-08-20T03:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_stg_160", start: "2026-08-01", end: "2026-12-20", changes: [snap], actor: "u_wang", at: "2026-08-20T03:00:00.000Z" }] },
    { factory: "f_hsc", platform: "plt_data", status: "APPROVED", version: "ver_dat_320", start: "2026-07-15", end: "2026-10-31", changes: [trace], submittedBy: "u_liu", submittedAt: "2026-07-20T01:00:00.000Z", approvedBy: "u_lin", approvedAt: "2026-07-22T01:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_dat_320", start: "2026-07-15", end: "2026-10-31", changes: [trace], actor: "u_liu", at: "2026-07-20T01:00:00.000Z" }, { action: "APPROVE", version: "ver_dat_320", start: "2026-07-15", end: "2026-10-31", changes: [trace], actor: "u_lin", at: "2026-07-22T01:00:00.000Z" }] },
    { factory: "f_hsc", platform: "plt_dev", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_hsc", platform: "plt_mon", status: "SUBMITTED", version: "ver_mon_120", start: "2026-09-01", end: "2026-11-20", changes: [{ featureId: "ft_diag", changeType: "ADDED", summary: "相對 1.1 新增遠端診斷" }], submittedBy: "u_cheng", submittedAt: "2026-09-03T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_mon_120", start: "2026-09-01", end: "2026-11-20", changes: [{ featureId: "ft_diag", changeType: "ADDED", summary: "相對 1.1 新增遠端診斷" }], actor: "u_cheng", at: "2026-09-03T02:00:00.000Z" }] },
    { factory: "f_txg", platform: "plt_compute", status: "SUBMITTED", version: "ver_cmp_230", start: "2026-06-10", end: "2026-09-15", changes: [{ featureId: "ft_rack", changeType: "ADDED", summary: "相對 2.2 新增機櫃級擴展" }], note: "開工早於平台建立。", submittedBy: "u_chang", submittedAt: "2026-07-02T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_cmp_230", start: "2026-06-10", end: "2026-09-15", actor: "u_chang", at: "2026-07-02T02:00:00.000Z", changes: [{ featureId: "ft_rack", changeType: "ADDED", summary: "相對 2.2 新增機櫃級擴展" }] }] },
    { factory: "f_txg", platform: "plt_storage", status: "APPROVED", version: "ver_stg_160", start: "2026-07-20", end: "2026-10-15", changes: [snap], submittedBy: "u_wang", submittedAt: "2026-07-25T02:00:00.000Z", approvedBy: "u_chen", approvedAt: "2026-07-28T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_stg_160", start: "2026-07-20", end: "2026-10-15", changes: [snap], actor: "u_wang", at: "2026-07-25T02:00:00.000Z" }, { action: "APPROVE", version: "ver_stg_160", start: "2026-07-20", end: "2026-10-15", changes: [snap], actor: "u_chen", at: "2026-07-28T02:00:00.000Z" }] },
    { factory: "f_txg", platform: "plt_data", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_txg", platform: "plt_dev", status: "SUBMITTED", version: "ver_dev_110", start: "2026-08-01", end: "2026-10-20", changes: [{ featureId: "ft_sand", changeType: "ADDED", summary: "相對 1.0 新增沙箱" }], submittedBy: "u_wu", submittedAt: "2026-08-05T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_dev_110", start: "2026-08-01", end: "2026-10-20", actor: "u_wu", at: "2026-08-05T02:00:00.000Z" }] },
    { factory: "f_txg", platform: "plt_mon", status: "APPROVED", version: "ver_mon_120", start: "2026-07-05", end: "2026-09-30", submittedBy: "u_cheng", submittedAt: "2026-07-10T02:00:00.000Z", approvedBy: "u_chen", approvedAt: "2026-07-12T02:00:00.000Z", revisions: [{ action: "APPROVE", version: "ver_mon_120", start: "2026-07-05", end: "2026-09-30", actor: "u_chen", at: "2026-07-12T02:00:00.000Z" }] },
    { factory: "f_khh", platform: "plt_compute", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_khh", platform: "plt_storage", status: "SUBMITTED", version: "ver_stg_140", start: "2026-05-01", end: "2026-11-15", note: "受電延後，完工超出階段。", submittedBy: "u_wang", submittedAt: "2026-06-01T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_stg_140", start: "2026-05-01", end: "2026-11-15", actor: "u_wang", at: "2026-06-01T02:00:00.000Z" }] },
    { factory: "f_khh", platform: "plt_data", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_khh", platform: "plt_dev", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_khh", platform: "plt_mon", status: "SUBMITTED", version: "ver_mon_110", start: "2026-06-01", end: "2026-09-01", submittedBy: "u_cheng", submittedAt: "2026-06-02T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_mon_110", start: "2026-06-01", end: "2026-09-01", actor: "u_cheng", at: "2026-06-02T02:00:00.000Z" }] },
    { factory: "f_tnn", platform: "plt_compute", status: "APPROVED", version: "ver_cmp_240", start: "2026-04-20", end: "2026-07-31", changes: [liquid], submittedBy: "u_chang", submittedAt: "2026-04-10T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-04-12T02:00:00.000Z", revisions: [{ action: "APPROVE", version: "ver_cmp_240", start: "2026-04-20", end: "2026-07-31", changes: [liquid], actor: "u_huang", at: "2026-04-12T02:00:00.000Z" }] },
    { factory: "f_tnn", platform: "plt_storage", status: "APPROVED", version: "ver_stg_170", start: "2026-05-01", end: "2026-08-01", changes: [{ featureId: "ft_xsite", changeType: "ADDED", summary: "相對 1.6 新增跨廠複製" }], submittedBy: "u_wang", submittedAt: "2026-04-18T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-04-19T02:00:00.000Z", revisions: [{ action: "APPROVE", version: "ver_stg_170", start: "2026-05-01", end: "2026-08-01", actor: "u_huang", at: "2026-04-19T02:00:00.000Z" }] },
    { factory: "f_tnn", platform: "plt_data", status: "APPROVED", version: "ver_dat_320", start: "2026-05-10", end: "2026-08-10", changes: [trace], submittedBy: "u_liu", submittedAt: "2026-04-20T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-04-21T02:00:00.000Z", revisions: [{ action: "APPROVE", version: "ver_dat_320", start: "2026-05-10", end: "2026-08-10", changes: [trace], actor: "u_huang", at: "2026-04-21T02:00:00.000Z" }] },
    { factory: "f_tnn", platform: "plt_dev", status: "APPROVED", version: "ver_dev_120", start: "2026-06-01", end: "2026-08-12", changes: [ide], submittedBy: "u_wu", submittedAt: "2026-05-02T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-05-03T02:00:00.000Z", revisions: [{ action: "APPROVE", version: "ver_dev_120", start: "2026-06-01", end: "2026-08-12", changes: [ide], actor: "u_huang", at: "2026-05-03T02:00:00.000Z" }] },
    { factory: "f_tnn", platform: "plt_mon", status: "APPROVED", version: "ver_mon_130", start: "2026-04-15", end: "2026-07-20", changes: [oee], submittedBy: "u_cheng", submittedAt: "2026-04-08T02:00:00.000Z", approvedBy: "u_huang", approvedAt: "2026-04-09T02:00:00.000Z", revisions: [{ action: "APPROVE", version: "ver_mon_130", start: "2026-04-15", end: "2026-07-20", changes: [oee], actor: "u_huang", at: "2026-04-09T02:00:00.000Z" }] },
    { factory: "f_kum", platform: "plt_compute", status: "SUBMITTED", version: "ver_cmp_240", start: "2026-12-01", end: "2027-03-15", changes: [liquid], note: "預先鎖版，人在熊本的副責是周宜安。", submittedBy: "u_chang", submittedAt: "2026-10-01T02:00:00.000Z", revisions: [{ action: "SUBMIT", version: "ver_cmp_240", start: "2026-12-01", end: "2027-03-15", changes: [liquid], actor: "u_chang", at: "2026-10-01T02:00:00.000Z" }] },
    { factory: "f_kum", platform: "plt_storage", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_kum", platform: "plt_data", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_kum", platform: "plt_dev", status: "NOT_SUBMITTED", version: null, start: null, end: null },
    { factory: "f_kum", platform: "plt_mon", status: "NOT_SUBMITTED", version: null, start: null, end: null },
  ];
  for (const spec of plans) addPlan(db, spec);

  addMilestones(db);
  addHandoffs(db);
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
    pmContact: { name: string; email: string; phone: string };
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
    pmContact: input.pmContact,
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
  const id = `dep_${spec.factory}_${spec.platform}`;
  const deployment: PlatformDeployment = {
    id,
    factoryId: spec.factory,
    platformId: spec.platform,
    plannedVersionId: spec.planned,
    actualVersionId: spec.actual,
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
  const total = spec.machines ?? defaults[spec.platform] ?? 0;
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
  const platformFeatures = db.features.filter((feature) => feature.platformId === spec.platform);
  for (const feature of platformFeatures) {
    const desired = spec.planned ? supports(db, spec.planned, feature.id) : false;
    let actual: boolean | null = null;
    if (spec.actual && spec.status !== "PLANNED") {
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
  const deployment = db.deployments.find((item) => item.factoryId === spec.factory && item.platformId === spec.platform);
  if (!deployment) return;
  const id = `plan_${spec.factory}_${spec.platform}`;
  const plan: PlatformFactoryPlan = {
    id,
    factoryId: spec.factory,
    platformId: spec.platform,
    deploymentId: deployment.id,
    status: spec.status,
    providedVersionId: spec.version,
    featureChanges: spec.changes ?? [],
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
      providedVersionId: revision.version,
      featureChanges: revision.changes ?? [],
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
    { id: "ms_hsc_cmp", phaseId: "f_hsc_p2", name: "運算平台上線", dueDate: "2026-10-20", deliverables: "運算平台部署紀錄", done: false, completedAt: null, ownerId: "u_chang" },
    { id: "ms_hsc_review", phaseId: "f_hsc_p2", name: "平台建立審查", dueDate: "2026-11-20", deliverables: "五個平台計畫與實際版本", done: false, completedAt: null, ownerId: "u_lin" },
    { id: "ms_txg_cool", phaseId: "f_txg_p2", name: "液冷驗收", dueDate: "2026-10-10", deliverables: "水路測漏報告", done: false, completedAt: null, ownerId: "u_tsai" },
    { id: "ms_txg_stg", phaseId: "f_txg_p2", name: "儲存平台交貨", dueDate: "2026-09-30", deliverables: "到貨簽收", done: true, completedAt: "2026-09-26T02:00:00.000Z", ownerId: "u_wang" },
    { id: "ms_khh_power", phaseId: "f_khh_p2", name: "主變壓器送電", dueDate: "2026-08-30", deliverables: "送電許可", done: false, completedAt: null, ownerId: "u_tsai" },
    { id: "ms_tnn_dev", phaseId: "f_tnn_p3", name: "開發者環境驗收", dueDate: "2026-10-28", deliverables: "開發平台驗收單", done: false, completedAt: null, ownerId: "u_wu" },
    { id: "ms_tnn_close", phaseId: "f_tnn_p2", name: "平台建立結案", dueDate: "2026-08-12", deliverables: "結案紀錄", done: true, completedAt: "2026-08-12T02:00:00.000Z", ownerId: "u_huang" },
    { id: "ms_kum_ship", phaseId: "f_kum_p1", name: "海運到港", dueDate: "2026-10-30", deliverables: "提單與開箱", done: false, completedAt: null, ownerId: "u_chou" },
    { id: "ms_kum_freeze", phaseId: "f_kum_p1", name: "平台計畫凍結", dueDate: "2026-11-10", deliverables: "五個平台施工計畫", done: false, completedAt: null, ownerId: "u_lin" },
  ];
  db.milestones.push(...rows);
}

function addHandoffs(db: Database) {
  const push = (handoff: Handoff, reqs: Database["requirements"] = []) => {
    db.handoffs.push(handoff);
    db.requirements.push(...reqs);
  };
  push(
    handoff("ho_hsc_12", "HO-HSC-12", "新竹硬體導入 → 平台建立", "f_hsc", 1, 2, "u_tsai", "u_lin", null, "2026-06-15", "2026-06-12", "受電與機櫃定位完成", "電力可用、場地點交", "", "ACCEPTED", ""),
  );
  push(
    handoff("ho_hsc_23", "HO-HSC-23", "新竹平台建立 → 開發者進駐", "f_hsc", 2, 3, "u_lin", "u_wu", "u_lin", "2026-11-25", null, "五個平台可讓開發者登入", "資料平台達 3.1、開發平台部署完成", "", "PROPOSED", ""),
    [
      req("req_hsc_dat", "ho_hsc_23", "MIN_VERSION", "plt_data", "3.1.0", null, "資料平台 Data 版本 ≥ 3.1.0"),
      req("req_hsc_dev", "ho_hsc_23", "DEPLOYMENT_COMPLETE", "plt_dev", null, null, "開發平台 Developer 部署完成"),
    ],
  );
  push(handoff("ho_txg_12", "HO-TXG-12", "台中硬體導入 → 平台建立", "f_txg", 1, 2, "u_tsai", "u_chen", null, "2026-07-08", "2026-07-08", "場地點交", "可進機", "", "ACCEPTED", ""));
  push(
    handoff("ho_txg_23", "HO-TXG-23", "台中平台建立 → 開發者進駐", "f_txg", 2, 3, "u_chen", "u_wu", "u_chen", "2026-10-12", null, "運算與儲存可交接", "運算 ≥ 2.3、快照啟用、運算部署完成", "運算平台仍停在 2.2.0", "PENDING_ACCEPTANCE", ""),
    [
      req("req_txg_ver", "ho_txg_23", "MIN_VERSION", "plt_compute", "2.3.0", null, "運算平台 Compute 版本 ≥ 2.3.0"),
      req("req_txg_snap", "ho_txg_23", "FEATURE_ENABLED", "plt_storage", null, "ft_snap", "儲存平台快照實際啟用"),
      req("req_txg_dep", "ho_txg_23", "DEPLOYMENT_COMPLETE", "plt_compute", null, null, "運算平台部署完成"),
    ],
  );
  push(handoff("ho_khh_12r", "HO-KHH-12R", "高雄硬體導入退回", "f_khh", 1, 2, "u_tsai", "u_huang", "u_huang", "2026-03-20", null, "電力單線圖", "單線圖簽核", "", "REJECTED", "電力單線圖未簽核，退回硬體導入。"));
  push(handoff("ho_khh_12", "HO-KHH-12", "高雄硬體導入 → 平台建立", "f_khh", 1, 2, "u_tsai", "u_huang", null, "2026-04-28", "2026-04-28", "補件後重新點交", "單線圖已簽", "", "ACCEPTED", ""));
  push(
    handoff("ho_khh_23", "HO-KHH-23", "高雄平台建立 → 開發者進駐", "f_khh", 2, 3, "u_huang", "u_wu", "u_huang", "2026-09-30", null, "受電後才能進平台", "運算部署完成、監控 ≥ 1.3", "主變壓器未送電，交接受阻。", "BLOCKED", ""),
    [
      req("req_khh_dep", "ho_khh_23", "DEPLOYMENT_COMPLETE", "plt_compute", null, null, "運算平台部署完成"),
      req("req_khh_mon", "ho_khh_23", "MIN_VERSION", "plt_mon", "1.3.0", null, "監控平台 Monitoring 版本 ≥ 1.3.0"),
    ],
  );
  push(handoff("ho_tnn_12", "HO-TNN-12", "台南硬體導入 → 平台建立", "f_tnn", 1, 2, "u_tsai", "u_huang", null, "2026-03-31", "2026-03-28", "硬體點交", "可進平台", "", "ACCEPTED", ""));
  push(
    handoff("ho_tnn_23", "HO-TNN-23", "台南平台建立 → 開發者進駐", "f_tnn", 2, 3, "u_huang", "u_wu", "u_huang", "2026-10-20", null, "平台建立結案包", "運算 ≥ 2.4、液冷啟用、儲存部署完成", "", "PENDING_ACCEPTANCE", ""),
    [
      req("req_tnn_ver", "ho_tnn_23", "MIN_VERSION", "plt_compute", "2.4.0", null, "運算平台 Compute 版本 ≥ 2.4.0"),
      req("req_tnn_liq", "ho_tnn_23", "FEATURE_ENABLED", "plt_compute", null, "ft_liquid", "運算平台液冷實際啟用"),
      req("req_tnn_stg", "ho_tnn_23", "DEPLOYMENT_COMPLETE", "plt_storage", null, null, "儲存平台部署完成"),
    ],
  );
  push(
    handoff("ho_tnn_34", "HO-TNN-34", "台南開發者進駐 → 開始營運", "f_tnn", 3, 4, "u_wu", "u_huang", null, "2026-11-20", null, "開發者驗收", "開發平台 ≥ 1.2", "", "WORK_DONE", ""),
    [req("req_tnn_dev", "ho_tnn_34", "MIN_VERSION", "plt_dev", "1.2.0", null, "開發平台 Developer 版本 ≥ 1.2.0")],
  );
  push(
    handoff("ho_kum_12", "HO-KUM-12", "熊本硬體導入 → 平台建立", "f_kum", 1, 2, "u_chou", "u_lin", "u_lin", "2026-11-14", null, "海運開箱與場地", "運算平台部署完成", "", "WORK_DONE", ""),
    [req("req_kum_dep", "ho_kum_12", "DEPLOYMENT_COMPLETE", "plt_compute", null, null, "運算平台部署完成")],
  );
}

function handoff(
  id: string,
  code: string,
  title: string,
  factoryId: string,
  fromOrder: number,
  toOrder: number,
  fromOwnerId: string,
  toOwnerId: string,
  escalationOwnerId: string | null,
  plannedDate: string,
  actualDate: string | null,
  deliverables: string,
  acceptanceCriteria: string,
  blockers: string,
  status: Handoff["status"],
  rejectionReason: string,
): Handoff {
  return {
    id,
    code,
    title,
    factoryId,
    fromPhaseId: `${factoryId}_p${fromOrder}`,
    toPhaseId: `${factoryId}_p${toOrder}`,
    fromOwnerId,
    toOwnerId,
    escalationOwnerId,
    plannedDate,
    actualDate,
    deliverables,
    acceptanceCriteria,
    blockers,
    status,
    rejectionReason,
  };
}

function req(
  id: string,
  handoffId: string,
  kind: Database["requirements"][number]["kind"],
  platformId: string,
  minVersion: string | null,
  featureId: string | null,
  description: string,
): Database["requirements"][number] {
  return { id, handoffId, kind, platformId, minVersion, featureId, description };
}

function addTopics(db: Database) {
  db.topics.push(
    {
      id: "tp_hsc_power",
      factoryId: "f_hsc",
      title: "高壓電契約容量不足",
      description: "平台建立期間運算與儲存同時上架，契約容量可能不夠。需要廠務確認是否加約。",
      ownerId: "u_lin",
      status: "OPEN",
      raisedOn: "2026-09-28",
    },
    {
      id: "tp_khh_water",
      factoryId: "f_khh",
      title: "純水系統延後",
      description: "純水預計晚於平台建立結束，影響冷卻與機台進場，要決定是否調整施工窗。",
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
    { id: "iss_khh_xfmr", code: "ISS-014", title: "主變壓器交期落後", description: "高雄三廠主變壓器較計畫晚八週，平台建立無法送電。", factoryId: "f_khh", phaseId: "f_khh_p2", milestoneId: "ms_khh_power", platformId: null, handoffId: "ho_khh_23", ownerId: "u_tsai", severity: "CRITICAL", priority: "P0", status: "OPEN", dueDate: "2026-09-01", resolution: "", updatedAt: "2026-10-12T02:00:00.000Z" },
    { id: "iss_khh_block", code: "ISS-015", title: "平台建立交接受阻", description: "受電條件不足，HO-KHH-23 維持受阻。", factoryId: "f_khh", phaseId: "f_khh_p2", milestoneId: null, platformId: "plt_compute", handoffId: "ho_khh_23", ownerId: "u_huang", severity: "HIGH", priority: "P0", status: "BLOCKED", dueDate: "2026-09-20", resolution: "", updatedAt: "2026-10-11T02:00:00.000Z" },
    { id: "iss_txg_cool", code: "ISS-021", title: "液冷水路未達驗收", description: "台中運算平台液冷測漏未過，影響 2.3 進版。", factoryId: "f_txg", phaseId: "f_txg_p2", milestoneId: "ms_txg_cool", platformId: "plt_compute", handoffId: "ho_txg_23", ownerId: "u_tsai", severity: "HIGH", priority: "P1", status: "OPEN", dueDate: "2026-10-10", resolution: "", updatedAt: "2026-10-16T02:00:00.000Z" },
    { id: "iss_hsc_plan", code: "ISS-008", title: "開發平台施工計畫未提報", description: "新竹一廠開發平台仍是未提報，平台建立審查前需要版本、異動與時程。", factoryId: "f_hsc", phaseId: "f_hsc_p2", milestoneId: "ms_hsc_review", platformId: "plt_dev", handoffId: "ho_hsc_23", ownerId: "u_wu", severity: "MEDIUM", priority: "P1", status: "OPEN", dueDate: "2026-10-25", resolution: "", updatedAt: "2026-10-14T02:00:00.000Z" },
    { id: "iss_kum_ship", code: "ISS-030", title: "熊本機櫃海運波動", description: "兩批機櫃改靠港，硬體導入有風險。平台計畫多數尚未提報。", factoryId: "f_kum", phaseId: "f_kum_p1", milestoneId: "ms_kum_ship", platformId: null, handoffId: null, ownerId: "u_chou", severity: "MEDIUM", priority: "P2", status: "IN_PROGRESS", dueDate: "2026-11-20", resolution: "", updatedAt: "2026-10-15T02:00:00.000Z" },
    { id: "iss_tnn_doc", code: "ISS-003", title: "平台建立結案文件補章", description: "台南結案文件已補齊。", factoryId: "f_tnn", phaseId: "f_tnn_p2", milestoneId: "ms_tnn_close", platformId: null, handoffId: "ho_tnn_23", ownerId: "u_huang", severity: "LOW", priority: "P3", status: "RESOLVED", dueDate: "2026-08-20", resolution: "2026-08-18 補齊簽核掃描檔。", updatedAt: "2026-08-18T02:00:00.000Z" },
  ];
  db.issues.push(...rows);
}

function addActivity(db: Database) {
  const rows: Activity[] = [
    act("act_1", "PLAN", "plan_f_hsc_plt_compute", "APPROVE", "林品均核准新竹一廠運算平台計畫，提供版本 2.4.0。", "u_lin", "2026-09-05T02:00:00.000Z"),
    act("act_2", "PLAN", "plan_f_hsc_plt_compute", "SUBMIT", "張承恩改提運算平台 2.4.0，新增液冷支援。", "u_chang", "2026-09-02T01:00:00.000Z"),
    act("act_3", "DEPLOYMENT", "dep_f_hsc_plt_compute", "ACTUAL_VERSION", "新竹運算平台實際版本填報為 2.4.0，液冷實際未啟用。", "u_tsai", "2026-09-28T06:00:00.000Z"),
    act("act_4", "HANDOFF", "ho_txg_23", "STATUS", "台中平台建立交接改為待驗收。條件仍未滿足。", "u_chen", "2026-10-11T03:00:00.000Z"),
    act("act_5", "ISSUE", "iss_txg_cool", "UPDATE", "液冷水路問題逾期，仍開啟。", "u_tsai", "2026-10-16T02:00:00.000Z"),
    act("act_6", "HANDOFF", "ho_khh_23", "STATUS", "高雄平台建立交接標記為受阻。", "u_huang", "2026-09-30T04:00:00.000Z"),
    act("act_7", "ISSUE", "iss_khh_xfmr", "CREATE", "登錄主變壓器交期落後，嚴重程度嚴重。", "u_tsai", "2026-08-15T02:00:00.000Z"),
    act("act_8", "PLAN", "plan_f_hsc_plt_dev", "NOTE", "新竹開發平台施工計畫仍未提報。", "u_lin", "2026-10-14T02:00:00.000Z"),
    act("act_9", "HANDOFF", "ho_tnn_23", "STATUS", "台南平台建立交接進入待驗收。條件已全部滿足，等待接收方手動驗收。", "u_huang", "2026-10-09T02:00:00.000Z"),
    act("act_10", "FACTORY", "f_khh", "STATUS", "高雄三廠整體狀態改為延遲。", "u_huang", "2026-10-02T02:00:00.000Z"),
    act("act_11", "PLAN", "plan_f_kum_plt_compute", "SUBMIT", "張承恩提報熊本運算平台計畫，施工窗落在平台建立區間內。", "u_chang", "2026-10-01T02:00:00.000Z"),
    act("act_12", "PHASE", "f_txg_p2", "STATUS", "台中平台建立標記為有風險。", "u_chen", "2026-10-08T02:00:00.000Z"),
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
