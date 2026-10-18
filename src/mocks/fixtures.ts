import { featureOverrides, resetAdhocIds } from "@/domain/features";
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
  resetAdhocIds();
  const db: Database = {
    seq: 1000,
    asOf: AS_OF,
    machineTypes: [
      { id: "mt_a", code: "A", name: "機種A", order: 1, active: true },
      { id: "mt_b", code: "B", name: "機種B", order: 2, active: true },
      { id: "mt_c", code: "C", name: "機種C", order: 3, active: true },
      { id: "mt_d", code: "D", name: "機種D", order: 4, active: true },
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
      { id: "u_hsu", name: "許家豪", department: "廠務處", active: true, source: "manual", externalId: null },
      { id: "u_linjy", name: "林佳穎", department: "廠務工程", active: true, source: "manual", externalId: null },
      { id: "u_kao", name: "高子軒", department: "海外廠務", active: true, source: "manual", externalId: null },
      { id: "u_yeh", name: "葉思齊", department: "運算開發處", active: true, source: "manual", externalId: null },
      { id: "u_pan", name: "潘柏宇", department: "儲存開發處", active: true, source: "manual", externalId: null },
      { id: "u_hsieh", name: "謝宜真", department: "資料產品處", active: true, source: "manual", externalId: null },
      { id: "u_lo", name: "羅安琦", department: "開發者產品處", active: true, source: "manual", externalId: null },
      { id: "u_chien", name: "簡志遠", department: "監控產品處", active: true, source: "manual", externalId: null },
      { id: "u_fan", name: "范詩涵", department: "產品專案一處", active: true, source: "manual", externalId: null },
      { id: "u_ting", name: "丁承翰", department: "產品專案二處", active: true, source: "manual", externalId: null },
      { id: "u_kuo", name: "郭品睿", department: "廠務可靠度處", active: true, source: "manual", externalId: null },
      { id: "u_ma", name: "馬怡君", department: "網路開發處", active: true, source: "external", externalId: "emp-2048" },
      { id: "u_sung", name: "宋柏廷", department: "安全產品處", active: true, source: "manual", externalId: null },
      { id: "u_ho", name: "何嘉玲", department: "廠務處", active: true, source: "manual", externalId: null },
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
      { id: "plt_net", name: "網路產品 Network", description: "廠區骨幹、路由與流量調度。", devDepartment: "網路開發處", projectDepartment: "產品專案一處", primaryOwnerId: "u_ma", mode: "VERSIONED" },
      { id: "plt_sec", name: "安全產品 Security", description: "弱點掃描、應用防火牆與帳號同步。只有功能開關，沒有版本。", devDepartment: "安全產品處", projectDepartment: "廠務可靠度處", primaryOwnerId: "u_sung", mode: "FEATURE_ONLY" },
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
      { id: "ft_bgp", productId: "plt_net", code: "bgp", name: "BGP 路由", description: "廠區骨幹 BGP", defaultEnabled: true },
      { id: "ft_qos", productId: "plt_net", code: "qos", name: "流量調度", description: "佇列與頻寬", defaultEnabled: false },
      { id: "ft_acl", productId: "plt_net", code: "acl", name: "存取控制", description: "邊界存取清單", defaultEnabled: false },
      { id: "ft_scan", productId: "plt_sec", code: "vuln_scan", name: "弱點掃描", description: "主機弱點掃描", defaultEnabled: true },
      { id: "ft_waf", productId: "plt_sec", code: "waf", name: "應用防火牆", description: "入口 WAF", defaultEnabled: false },
      { id: "ft_iam", productId: "plt_sec", code: "iam_sync", name: "帳號同步", description: "門禁與帳號同步", defaultEnabled: false },
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
    ver_net_100: ["ft_bgp"],
    ver_net_110: ["ft_bgp", "ft_qos"],
  };

  const versionRows: Array<[string, string, string, string | null, string]> = [
    ["ver_cmp_220", "plt_compute", "2.2.0", "2026-03-01", "基礎 GPU 分割"],
    ["ver_cmp_230", "plt_compute", "2.3.0", "2026-06-12", "加入機櫃級擴展"],
    ["ver_cmp_240", "plt_compute", "2.4.0", "2026-09-01", "液冷支援"],
    ["ver_stg_140", "plt_storage", "1.4.0", "2026-02-01", "NVMe 熱層"],
    ["ver_stg_160", "plt_storage", "1.6.0", "2026-06-20", "快照"],
    ["ver_stg_170", "plt_storage", "1.7.0", "2026-09-08", "跨廠複製"],
    ["ver_net_100", "plt_net", "1.0.0", "2026-04-01", "廠區 BGP"],
    ["ver_net_110", "plt_net", "1.1.0", "2026-08-18", "加入流量調度"],
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
  addExtraFactories(db);

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
  fillGaps(db);
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
    plt_net: 72,
    plt_sec: 36,
  };
  const total = spec.machines ?? defaults[spec.product] ?? 0;
  const split = splitMachines(total);
  const typeIds = ["mt_a", "mt_b", "mt_c", "mt_d"] as const;
  const suffixes = ["a", "b", "c", "d"] as const;
  typeIds.forEach((typeId, index) => {
    const planned = split[index];
    if (planned <= 0 || !db.machineTypes.some((item) => item.id === typeId)) return;
    db.machineQuantities.push({ id: `mq_${id}_${suffixes[index]}`, deploymentId: id, machineTypeId: typeId, planned });
  });
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

function splitMachines(total: number): [number, number, number, number] {
  const safe = Math.max(0, Math.trunc(total));
  const a = Math.floor((safe * 50) / 100);
  const b = Math.floor((safe * 25) / 100);
  const c = Math.floor((safe * 15) / 100);
  return [a, b, c, safe - a - b - c];
}

function hash(value: string): number {
  let h = 0;
  for (const ch of value) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addExtraFactories(db: Database) {
  const rows: Array<Parameters<typeof addFactory>[1]> = [
    {
      id: "f_hs2", code: "FAB-HS2", name: "新竹二廠", location: "新竹科學園區",
      description: "Giga 廠已完成四階段，七個產品的施工計畫都已核准。",
      category: "GIGA", region: "HQ", technology: "N3", pmId: "u_hsu", status: "COMPLETED",
      phases: [
        { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2025-06-02", plannedEnd: "2025-09-15", actualStart: "2025-06-03", actualEnd: "2025-09-10", status: "COMPLETED" },
        { name: "產品建立 Product Build", owner: "u_hsu", plannedStart: "2025-09-16", plannedEnd: "2026-03-31", actualStart: "2025-09-18", actualEnd: "2026-03-20", status: "COMPLETED" },
        { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-04-01", plannedEnd: "2026-06-30", actualStart: "2026-04-02", actualEnd: "2026-06-18", status: "COMPLETED" },
        { name: "開始營運 Operations Start", owner: "u_hsu", plannedStart: "2026-07-01", plannedEnd: "2026-08-15", actualStart: "2026-07-01", actualEnd: "2026-08-10", status: "COMPLETED" },
      ],
    },
    {
      id: "f_ml1", code: "FAB-ML1", name: "苗栗一廠", location: "苗栗科學園區",
      description: "分期廠、N2。產品建立已超過計畫結束日，純水與受電仍未完成。",
      category: "PHASE", region: "HQ", technology: "N2", pmId: "u_linjy", status: "DELAYED",
      phases: [
        { name: "硬體導入 Hardware Onboarding", owner: "u_linjy", plannedStart: "2026-01-06", plannedEnd: "2026-04-15", actualStart: "2026-01-12", actualEnd: "2026-05-02", status: "COMPLETED" },
        { name: "產品建立 Product Build", owner: "u_linjy", plannedStart: "2026-04-16", plannedEnd: "2026-09-01", actualStart: "2026-05-20", actualEnd: null, status: "DELAYED", riskNote: "純水系統未達標，機台無法進場。" },
        { name: "開發者進駐 Developer Onboarding", owner: "u_lo", plannedStart: "2026-09-02", plannedEnd: "2026-12-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
        { name: "開始營運 Operations Start", owner: "u_linjy", plannedStart: "2026-12-16", plannedEnd: "2027-02-01", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      ],
    },
    {
      id: "f_ty1", code: "FAB-TY1", name: "桃園一廠", location: "桃園航空城",
      description: "分期廠、N3。產品建立進行中，時程仍落在計畫內。",
      category: "PHASE", region: "HQ", technology: "N3", pmId: "u_chen", status: "ON_TRACK",
      phases: [
        { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2026-05-04", plannedEnd: "2026-08-14", actualStart: "2026-05-06", actualEnd: "2026-08-10", status: "COMPLETED" },
        { name: "產品建立 Product Build", owner: "u_chen", plannedStart: "2026-08-17", plannedEnd: "2026-12-20", actualStart: "2026-08-18", actualEnd: null, status: "IN_PROGRESS" },
        { name: "開發者進駐 Developer Onboarding", owner: "u_lo", plannedStart: "2026-12-21", plannedEnd: "2027-03-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
        { name: "開始營運 Operations Start", owner: "u_chen", plannedStart: "2027-03-16", plannedEnd: "2027-04-30", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      ],
    },
    {
      id: "f_tn2", code: "FAB-TN2", name: "台南二廠", location: "台南科學園區",
      description: "Giga、N2。四階段都已結案，營運交接完成。",
      category: "GIGA", region: "HQ", technology: "N2", pmId: "u_huang", status: "COMPLETED",
      phases: [
        { name: "硬體導入 Hardware Onboarding", owner: "u_tsai", plannedStart: "2025-03-03", plannedEnd: "2025-06-30", actualStart: "2025-03-04", actualEnd: "2025-06-20", status: "COMPLETED" },
        { name: "產品建立 Product Build", owner: "u_huang", plannedStart: "2025-07-01", plannedEnd: "2026-01-31", actualStart: "2025-07-02", actualEnd: "2026-01-20", status: "COMPLETED" },
        { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-02-02", plannedEnd: "2026-04-30", actualStart: "2026-02-03", actualEnd: "2026-04-22", status: "COMPLETED" },
        { name: "開始營運 Operations Start", owner: "u_huang", plannedStart: "2026-05-04", plannedEnd: "2026-06-30", actualStart: "2026-05-04", actualEnd: "2026-06-18", status: "COMPLETED" },
      ],
    },
    {
      id: "f_sg1", code: "FAB-SG1", name: "新加坡一廠", location: "新加坡",
      description: "海外 Giga、N3。海運與電力窗口重疊，產品建立有風險。",
      category: "GIGA", region: "OVERSEA", technology: "N3", pmId: "u_chou", status: "AT_RISK",
      phases: [
        { name: "硬體導入 Hardware Onboarding", owner: "u_chou", plannedStart: "2026-06-01", plannedEnd: "2026-09-15", actualStart: "2026-06-10", actualEnd: "2026-09-28", status: "COMPLETED" },
        { name: "產品建立 Product Build", owner: "u_kao", plannedStart: "2026-09-16", plannedEnd: "2026-12-31", actualStart: "2026-10-02", actualEnd: null, status: "AT_RISK", riskNote: "海關文件未齊，部分機櫃還在保稅倉。" },
        { name: "開發者進駐 Developer Onboarding", owner: "u_lo", plannedStart: "2027-01-04", plannedEnd: "2027-03-31", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
        { name: "開始營運 Operations Start", owner: "u_chou", plannedStart: "2027-04-01", plannedEnd: "2027-05-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      ],
    },
    {
      id: "f_az1", code: "FAB-AZ1", name: "亞利桑那一廠", location: "亞利桑那",
      description: "海外分期廠、N2。廠房驗收落後，產品建立已延遲。",
      category: "PHASE", region: "OVERSEA", technology: "N2", pmId: "u_kao", status: "DELAYED",
      phases: [
        { name: "硬體導入 Hardware Onboarding", owner: "u_kao", plannedStart: "2026-02-02", plannedEnd: "2026-05-29", actualStart: "2026-02-16", actualEnd: "2026-06-30", status: "COMPLETED" },
        { name: "產品建立 Product Build", owner: "u_kao", plannedStart: "2026-06-01", plannedEnd: "2026-08-31", actualStart: "2026-07-06", actualEnd: null, status: "DELAYED", riskNote: "廠房驗收未過，機櫃不能上架。" },
        { name: "開發者進駐 Developer Onboarding", owner: "u_wu", plannedStart: "2026-09-01", plannedEnd: "2026-11-30", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
        { name: "開始營運 Operations Start", owner: "u_kao", plannedStart: "2026-12-01", plannedEnd: "2027-01-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      ],
    },
    {
      id: "f_os1", code: "FAB-OS1", name: "大阪一廠", location: "大阪",
      description: "海外分期廠、N3。硬體已完成，產品建立按計畫進行。",
      category: "PHASE", region: "OVERSEA", technology: "N3", pmId: "u_ho", status: "ON_TRACK",
      phases: [
        { name: "硬體導入 Hardware Onboarding", owner: "u_chou", plannedStart: "2026-04-01", plannedEnd: "2026-07-15", actualStart: "2026-04-02", actualEnd: "2026-07-10", status: "COMPLETED" },
        { name: "產品建立 Product Build", owner: "u_ho", plannedStart: "2026-07-16", plannedEnd: "2027-01-15", actualStart: "2026-07-20", actualEnd: null, status: "IN_PROGRESS" },
        { name: "開發者進駐 Developer Onboarding", owner: "u_lo", plannedStart: "2027-01-18", plannedEnd: "2027-03-31", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
        { name: "開始營運 Operations Start", owner: "u_ho", plannedStart: "2027-04-01", plannedEnd: "2027-05-15", actualStart: null, actualEnd: null, status: "NOT_STARTED" },
      ],
    },
  ];
  for (const row of rows) addFactory(db, row);
}

function fillGaps(db: Database) {
  for (const factory of db.factories) {
    for (const product of db.products) {
      const key = `${factory.id}:${product.id}`;
      const h = hash(key);
      if (!db.deployments.some((item) => item.factoryId === factory.id && item.productId === product.id)) {
        const version = latestVersionId(db, product.id);
        const status = generatedDeploymentStatus(factory.status, h);
        addDeployment(db, {
          factory: factory.id,
          product: product.id,
          planned: version,
          actual: status === "PLANNED" ? null : version,
          status,
          secondary: ["u_chang", "u_wang", "u_liu", "u_wu", "u_cheng", "u_ma", "u_sung", "u_yeh", "u_pan"][h % 9],
          machines: 48 + (h % 20) * 16,
          plannedDate: shiftDate(factory.plannedStart, 40 + (h % 50)),
          deployedAt: status === "DEPLOYED" || status === "ACCEPTED" ? shiftDate(factory.plannedStart, 70 + (h % 20)) : null,
          upgraded: h % 5 === 0 && status !== "PLANNED",
        });
      }
      if (!db.plans.some((item) => item.factoryId === factory.id && item.productId === product.id)) {
        addGeneratedPlan(db, factory.id, product.id, h);
      }
    }
    ensureAdHoc(db, factory.id);
    ensureTopics(db, factory.id);
    ensureMilestone(db, factory.id);
  }
  addExtraIssues(db);
  addExtraActivity(db);
}

function generatedDeploymentStatus(factoryStatus: string, h: number): DeploymentStatus {
  if (factoryStatus === "COMPLETED") return "ACCEPTED";
  if (factoryStatus === "DELAYED") return h % 2 === 0 ? "IN_PROGRESS" : "PLANNED";
  if (factoryStatus === "AT_RISK") return h % 3 === 0 ? "DEPLOYED" : "IN_PROGRESS";
  const cycle: DeploymentStatus[] = ["IN_PROGRESS", "DEPLOYED", "PLANNED", "ACCEPTED"];
  return cycle[h % cycle.length];
}

function latestVersionId(db: Database, productId: string): string | null {
  const rows = db.versions.filter((version) => version.productId === productId);
  return rows.length === 0 ? null : rows[rows.length - 1].id;
}

function addGeneratedPlan(db: Database, factoryId: string, productId: string, h: number) {
  const factory = db.factories.find((item) => item.id === factoryId);
  const product = db.products.find((item) => item.id === productId);
  if (!factory || !product) return;
  const phase2 = db.phases.find((phase) => phase.factoryId === factoryId && phase.order === 2);
  const featureOnly = product.mode === "FEATURE_ONLY";
  const features = db.features.filter((feature) => feature.productId === productId);
  let status: PlanStatus = "SUBMITTED";
  if (factory.status === "COMPLETED") status = "APPROVED";
  else if (h % 5 === 0) status = "NOT_SUBMITTED";
  else if (h % 3 === 0) status = "APPROVED";
  const submitted = status !== "NOT_SUBMITTED";
  const version = !featureOnly && submitted ? latestVersionId(db, productId) : null;
  const start = submitted ? phase2?.plannedStart ?? factory.plannedStart : null;
  const end = submitted ? shiftDate(phase2?.plannedEnd ?? factory.plannedEnd, h % 4 === 0 ? 21 : 0) : null;
  const enabled = featureOnly && submitted
    ? features.filter((feature, index) => ((h + index) % 3 === 0 ? !feature.defaultEnabled : feature.defaultEnabled)).map((feature) => feature.id)
    : undefined;
  const reasons: Record<string, string> = {};
  const adhoc: AdHocChange[] = [];
  if (submitted) {
    const titles = ["機櫃改夜班進場", "施工窗避開廠務停電", "卸貨改由側門", "門禁提前開通開發者", "液冷水路先局部試點"];
    adhoc.push({
      id: `ah_${factoryId}_${productId}_night`,
      kind: "CUSTOM",
      featureId: null,
      enabled: null,
      title: titles[h % titles.length],
      description: `${factory.name}的${product.name}要配合廠務窗口。`,
    });
    if (h % 2 === 0) {
      adhoc.push({
        id: `ah_${factoryId}_${productId}_dock`,
        kind: "CUSTOM",
        featureId: null,
        enabled: null,
        title: "卸貨區改預約制",
        description: `${factory.name}卸貨區與廠務施工重疊，改前一日預約。`,
      });
    }
    const feature = features[h % Math.max(features.length, 1)];
    if (feature && !featureOnly) {
      adhoc.push({
        id: `ah_${factoryId}_${productId}_${feature.id}`,
        kind: "FEATURE_OVERRIDE",
        featureId: feature.id,
        enabled: h % 2 === 1,
        title: "",
        description: `${factory.name}把「${feature.name}」改成這座廠的開關。`,
      });
    }
    if (featureOnly && enabled) {
      for (const item of features) {
        const on = enabled.includes(item.id);
        if (on === item.defaultEnabled) continue;
        reasons[item.id] = `${factory.name}${on ? "提前啟用" : "先關閉"}${item.name}。`;
        adhoc.push({
          id: `ah_${factoryId}_${productId}_${item.id}`,
          kind: "FEATURE_OVERRIDE",
          featureId: item.id,
          enabled: on,
          title: "",
          description: reasons[item.id],
        });
      }
    }
  }
  const actor = product.primaryOwnerId;
  addPlan(db, {
    factory: factoryId,
    product: productId,
    status,
    version,
    enabled,
    reasons,
    adhoc,
    start,
    end,
    note: status === "NOT_SUBMITTED" ? "" : `${factory.name}的${product.name}示範計畫。`,
    submittedBy: status === "NOT_SUBMITTED" ? undefined : actor,
    submittedAt: status === "NOT_SUBMITTED" ? undefined : "2026-09-01T02:00:00.000Z",
    approvedBy: status === "APPROVED" ? factory.pmId : undefined,
    approvedAt: status === "APPROVED" ? "2026-09-03T02:00:00.000Z" : undefined,
    revisions: status === "NOT_SUBMITTED" ? [] : [
      { action: "SUBMIT", version, start, end, actor, at: "2026-09-01T02:00:00.000Z", note: "示範提報" },
      ...(status === "APPROVED" ? [{ action: "APPROVE" as const, version, start, end, actor: factory.pmId, at: "2026-09-03T02:00:00.000Z", note: "示範核准" }] : []),
    ],
  });
}

function ensureAdHoc(db: Database, factoryId: string) {
  const plans = db.plans.filter((plan) => plan.factoryId === factoryId);
  const factory = db.factories.find((item) => item.id === factoryId);
  let count = plans.reduce((sum, plan) => sum + plan.adHocChanges.length, 0);
  const target = plans.find((plan) => plan.status !== "NOT_SUBMITTED") ?? plans[0];
  if (target && count < 2) {
    const product = db.products.find((item) => item.id === target.productId);
    const titles = ["夜班進場", "卸貨改預約"];
    let n = 0;
    while (count < 2) {
      target.adHocChanges.push({
        id: `ah_${factoryId}_extra_${n + 1}`,
        kind: "CUSTOM",
        featureId: null,
        enabled: null,
        title: titles[n % titles.length],
        description: `${factory?.name ?? factoryId}的${product?.name ?? "產品"}配合廠務窗口。`,
      });
      count += 1;
      n += 1;
    }
  }
  const hasOverride = plans.some((plan) => plan.adHocChanges.some((change) => change.kind === "FEATURE_OVERRIDE"));
  if (hasOverride) return;
  const versioned = plans.find((plan) => plan.status !== "NOT_SUBMITTED" && db.products.some((product) => product.id === plan.productId && product.mode === "VERSIONED"));
  const feature = versioned ? db.features.find((item) => item.productId === versioned.productId) : undefined;
  if (!versioned || !feature) return;
  versioned.adHocChanges.push({
    id: `ah_${factoryId}_${versioned.productId}_extra_feat`,
    kind: "FEATURE_OVERRIDE",
    featureId: feature.id,
    enabled: !feature.defaultEnabled,
    title: "",
    description: `${factory?.name ?? factoryId}把「${feature.name}」改成與預設不同。`,
  });
}

function ensureTopics(db: Database, factoryId: string) {
  const factory = db.factories.find((item) => item.id === factoryId);
  if (!factory) return;
  const bank = [
    ["高壓電契約容量", "產品建立期間多個產品同時上架，契約容量可能不夠。"],
    ["卸貨區時段衝突", "機櫃進場與廠務施工共用卸貨區，需要排開時段。"],
    ["開發者門禁名冊", "開發者名單已交，廠區門禁還沒開通。"],
    ["純水與冷卻時程", "純水系統可能晚於產品建立，影響機台進場。"],
    ["海關文件未齊", "海外機櫃還在保稅倉，提單與分區證明未齊。"],
  ];
  const statuses = ["OPEN", "IN_DISCUSSION", "RESOLVED", "CLOSED"] as const;
  const existing = db.topics.filter((topic) => topic.factoryId === factoryId).length;
  for (let n = existing; n < 2; n += 1) {
    const h = hash(`${factoryId}:topic:${n}`);
    const [title, description] = bank[(h + n) % bank.length];
    db.topics.push({
      id: `tp_${factoryId}_${n + 1}`,
      factoryId,
      title: `${factory.name}：${title}`,
      description,
      ownerId: factory.pmId,
      status: statuses[h % statuses.length],
      raisedOn: shiftDate("2026-07-01", h % 80),
    });
  }
}

function ensureMilestone(db: Database, factoryId: string) {
  if (db.milestones.some((item) => item.phaseId.startsWith(`${factoryId}_`))) return;
  const factory = db.factories.find((item) => item.id === factoryId);
  const phase = db.phases.find((item) => item.factoryId === factoryId && item.order === 2);
  if (!factory || !phase) return;
  const done = factory.status === "COMPLETED";
  db.milestones.push({
    id: `ms_${factoryId}_gate`,
    phaseId: phase.id,
    name: done ? "產品建立結案" : "產品建立審查",
    dueDate: phase.plannedEnd,
    deliverables: "施工計畫與部署紀錄",
    done,
    completedAt: done ? "2026-08-01T02:00:00.000Z" : null,
    ownerId: factory.pmId,
  });
}

function addExtraIssues(db: Database) {
  const rows: Issue[] = [
    { id: "iss_hs2_spare", code: "ISS-041", title: "新竹二廠結案備品清點", description: "營運交接後備品帳與現場數量差兩台。", factoryId: "f_hs2", phaseId: "f_hs2_p4", milestoneId: "ms_f_hs2_gate", productId: null, ownerId: "u_hsu", severity: "LOW", priority: "P3", status: "CLOSED", dueDate: "2026-08-20", resolution: "2026-08-12 盤點完成並更新帳冊。", updatedAt: "2026-08-12T02:00:00.000Z" },
    { id: "iss_ml1_water", code: "ISS-042", title: "苗栗純水未達標", description: "純水導電度超出規格，機台不能進場。", factoryId: "f_ml1", phaseId: "f_ml1_p2", milestoneId: "ms_f_ml1_gate", productId: "plt_compute", ownerId: "u_linjy", severity: "CRITICAL", priority: "P0", status: "BLOCKED", dueDate: "2026-09-15", resolution: "", updatedAt: "2026-10-12T02:00:00.000Z" },
    { id: "iss_ml1_plan", code: "ISS-043", title: "苗栗網路產品計畫未鎖版", description: "網路產品仍停在較早版本，流量調度尚未納入。", factoryId: "f_ml1", phaseId: "f_ml1_p2", milestoneId: null, productId: "plt_net", ownerId: "u_ma", severity: "HIGH", priority: "P1", status: "OPEN", dueDate: "2026-10-30", resolution: "", updatedAt: "2026-10-16T02:00:00.000Z" },
    { id: "iss_ty1_dock", code: "ISS-044", title: "桃園卸貨區時段不足", description: "產品建立與廠務夜間施工搶同一個卸貨區。", factoryId: "f_ty1", phaseId: "f_ty1_p2", milestoneId: null, productId: "plt_storage", ownerId: "u_chen", severity: "MEDIUM", priority: "P2", status: "IN_PROGRESS", dueDate: "2026-11-05", resolution: "", updatedAt: "2026-10-11T02:00:00.000Z" },
    { id: "iss_tn2_doc", code: "ISS-045", title: "台南二廠營運交接簽名", description: "交接紀錄已補齊。", factoryId: "f_tn2", phaseId: "f_tn2_p4", milestoneId: "ms_f_tn2_gate", productId: null, ownerId: "u_huang", severity: "LOW", priority: "P3", status: "RESOLVED", dueDate: "2026-06-25", resolution: "2026-06-18 完成雙簽。", updatedAt: "2026-06-18T02:00:00.000Z" },
    { id: "iss_sg1_customs", code: "ISS-046", title: "新加坡機櫃卡在保稅倉", description: "海關文件缺分區證明，運算機櫃無法提領。", factoryId: "f_sg1", phaseId: "f_sg1_p2", milestoneId: "ms_f_sg1_gate", productId: "plt_compute", ownerId: "u_chou", severity: "HIGH", priority: "P0", status: "OPEN", dueDate: "2026-10-28", resolution: "", updatedAt: "2026-10-15T02:00:00.000Z" },
    { id: "iss_sg1_power", code: "ISS-047", title: "新加坡電力窗口重疊", description: "廠務停電窗口與網路產品上線同一週。", factoryId: "f_sg1", phaseId: "f_sg1_p2", milestoneId: null, productId: "plt_net", ownerId: "u_kao", severity: "MEDIUM", priority: "P1", status: "IN_PROGRESS", dueDate: "2026-11-12", resolution: "", updatedAt: "2026-10-09T02:00:00.000Z" },
    { id: "iss_az1_fab", code: "ISS-048", title: "亞利桑那廠房驗收未過", description: "地板承重複驗未過，產品建立無法上架。", factoryId: "f_az1", phaseId: "f_az1_p2", milestoneId: "ms_f_az1_gate", productId: null, ownerId: "u_kao", severity: "CRITICAL", priority: "P0", status: "OPEN", dueDate: "2026-09-10", resolution: "", updatedAt: "2026-10-14T02:00:00.000Z" },
    { id: "iss_az1_sec", code: "ISS-049", title: "亞利桑那弱點掃描未排程", description: "安全產品只開了預設掃描，防火牆尚未討論。", factoryId: "f_az1", phaseId: "f_az1_p2", milestoneId: null, productId: "plt_sec", ownerId: "u_sung", severity: "MEDIUM", priority: "P2", status: "OPEN", dueDate: "2026-11-01", resolution: "", updatedAt: "2026-10-08T02:00:00.000Z" },
    { id: "iss_os1_badge", code: "ISS-050", title: "大阪開發者門禁延後", description: "名冊已送，當地門禁系統下週才開帳號。", factoryId: "f_os1", phaseId: "f_os1_p2", milestoneId: null, productId: "plt_dev", ownerId: "u_ho", severity: "LOW", priority: "P2", status: "IN_PROGRESS", dueDate: "2026-11-18", resolution: "", updatedAt: "2026-10-13T02:00:00.000Z" },
    { id: "iss_hsc_net", code: "ISS-051", title: "新竹一廠存取控制未納版", description: "網路產品 1.1 尚未包含存取控制，這座廠想提前打開。", factoryId: "f_hsc", phaseId: "f_hsc_p2", milestoneId: null, productId: "plt_net", ownerId: "u_ma", severity: "MEDIUM", priority: "P1", status: "OPEN", dueDate: "2026-11-02", resolution: "", updatedAt: "2026-10-17T02:00:00.000Z" },
    { id: "iss_txg_sec", code: "ISS-052", title: "台中應用防火牆規則未定", description: "安全產品想在台中多開防火牆，規則還在討論。", factoryId: "f_txg", phaseId: "f_txg_p2", milestoneId: null, productId: "plt_sec", ownerId: "u_sung", severity: "HIGH", priority: "P1", status: "IN_PROGRESS", dueDate: "2026-10-31", resolution: "", updatedAt: "2026-10-16T04:00:00.000Z" },
    { id: "iss_khh_net", code: "ISS-053", title: "高雄骨幹路由延後", description: "受電不足，網路產品無法與運算同時上架。", factoryId: "f_khh", phaseId: "f_khh_p2", milestoneId: null, productId: "plt_net", ownerId: "u_ma", severity: "HIGH", priority: "P0", status: "BLOCKED", dueDate: "2026-10-05", resolution: "", updatedAt: "2026-10-10T02:00:00.000Z" },
    { id: "iss_kum_sec", code: "ISS-054", title: "熊本帳號同步範圍未定", description: "海外門禁與總部帳號要不要同步，還沒有結論。", factoryId: "f_kum", phaseId: "f_kum_p1", milestoneId: null, productId: "plt_sec", ownerId: "u_chou", severity: "LOW", priority: "P3", status: "OPEN", dueDate: "2026-12-01", resolution: "", updatedAt: "2026-10-06T02:00:00.000Z" },
    { id: "iss_tnn_net", code: "ISS-055", title: "台南四廠流量調度觀察", description: "網路 1.1 已上線，流量調度觀察一週後關閉問題。", factoryId: "f_tnn", phaseId: "f_tnn_p3", milestoneId: null, productId: "plt_net", ownerId: "u_ma", severity: "LOW", priority: "P2", status: "RESOLVED", dueDate: "2026-09-15", resolution: "2026-09-12 觀察完成，沒有丟包。", updatedAt: "2026-09-12T02:00:00.000Z" },
    { id: "iss_ty1_cool", code: "ISS-056", title: "桃園冷卻水溫偏高", description: "白班水溫接近上限，先降載觀察。", factoryId: "f_ty1", phaseId: "f_ty1_p2", milestoneId: "ms_f_ty1_gate", productId: "plt_compute", ownerId: "u_yeh", severity: "MEDIUM", priority: "P1", status: "OPEN", dueDate: "2026-11-08", resolution: "", updatedAt: "2026-10-17T06:00:00.000Z" },
  ];
  db.issues.push(...rows);
}

function addExtraActivity(db: Database) {
  db.activity.push(
    act("act_13", "FACTORY", "f_hs2", "STATUS", "許家豪把新竹二廠標為已完成。", "u_hsu", "2026-08-10T02:00:00.000Z"),
    act("act_14", "PLAN", "plan_f_hs2_plt_compute", "APPROVE", "許家豪核准新竹二廠運算產品計畫。", "u_hsu", "2026-09-03T02:00:00.000Z"),
    act("act_15", "ISSUE", "iss_ml1_water", "CREATE", "林佳穎登錄苗栗純水未達標，嚴重程度嚴重。", "u_linjy", "2026-09-20T02:00:00.000Z"),
    act("act_16", "PHASE", "f_az1_p2", "STATUS", "高子軒把亞利桑那產品建立標為延遲。", "u_kao", "2026-09-08T02:00:00.000Z"),
    act("act_17", "PERSON", "u_ma", "CREATE", "目錄同步帶入馬怡君（網路開發處）。", "u_lin", "2026-08-01T02:00:00.000Z"),
    act("act_18", "TOPIC", "tp_f_os1_1", "CREATE", "何嘉玲在大阪一廠新增例外事項。", "u_ho", "2026-08-22T02:00:00.000Z"),
    act("act_19", "ISSUE", "iss_tn2_doc", "STATUS", "黃詩涵把台南二廠交接問題標為已解決。", "u_huang", "2026-06-18T02:00:00.000Z"),
    act("act_20", "DEPLOYMENT", "dep_f_ty1_plt_storage", "UPDATE", "陳浩宇更新桃園儲存產品的部署資料。", "u_chen", "2026-10-04T02:00:00.000Z"),
  );
}
