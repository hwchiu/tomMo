import { isFeaturePlanComplete, resolvePlanned } from "@/domain/features";
import { plannedTotal } from "@/domain/machines";
import { compareSemver } from "@/domain/semver";
import { cellReadiness } from "@/domain/readiness";
import type { Database, User } from "@/domain/types";
import { evaluateConstructionWindow } from "@/domain/windows";
import { ApiError } from "./errors";
import type {
  ActivityItem,
  Bootstrap,
  BuildCell,
  BuildRow,
  CapabilityMatrix,
  DeploymentPage,
  FactoryBoardRow,
  FactoryDetail,
  IssueListItem,
  IssuePage,
  MilestoneRow,
  PendingPlan,
  PlanPage,
  PlatformBuild,
  PlatformDetail,
  PlatformSummary,
  Portfolio,
} from "./types";

export function buildBootstrap(db: Database, actorId: string): Bootstrap {
  return {
    asOf: db.asOf,
    currentUser: mustUser(db, actorId),
    users: db.users,
    enumerations: [...db.enumerations].sort((a, b) => a.set.localeCompare(b.set) || a.order - b.order),
    machineTypes: [...db.machineTypes].sort((a, b) => a.order - b.order),
    phaseTemplates: [...db.phaseTemplates]
      .sort((a, b) => a.order - b.order)
      .map((template) => ({
        id: template.id,
        name: template.name,
        order: template.order,
        defaultDurationDays: template.defaultDurationDays,
      })),
  };
}

export function buildPortfolio(db: Database): Portfolio {
  const factories = db.factories.map((factory) => boardRow(db, factory.id));
  const counts = {
    total: factories.length,
    onTrack: factories.filter((factory) => factory.status === "ON_TRACK").length,
    atRisk: factories.filter((factory) => factory.status === "AT_RISK").length,
    delayed: factories.filter((factory) => factory.status === "DELAYED").length,
  };
  return {
    asOf: db.asOf,
    counts,
    exceptions: exceptions(db),
    factories,
    milestones: milestoneRows(db),
    pendingPlans: pendingPlans(db),
  };
}

export function buildPlatformBuild(db: Database): PlatformBuild {
  const platforms = [...db.platforms].map((platform) => ({
    id: platform.id,
    code: platform.code,
    name: platform.name,
    primaryOwnerName: nameOf(db, platform.primaryOwnerId),
    mode: platform.mode,
  }));
  const rows = db.factories.map((factory) => buildRow(db, factory.id, platforms.map((platform) => platform.id)));
  return { asOf: db.asOf, platforms, rows };
}

export function buildFactory(db: Database, id: string): FactoryDetail {
  const factory = db.factories.find((item) => item.id === id);
  if (!factory) throw new ApiError("找不到這座工廠", 404);
  const phases = db.phases
    .filter((phase) => phase.factoryId === id)
    .sort((a, b) => a.order - b.order);
  const phase2 = phases.find((phase) => phase.order === 2) ?? null;
  return {
    asOf: db.asOf,
    id: factory.id,
    code: factory.code,
    name: factory.name,
    location: factory.location,
    description: factory.description,
    status: factory.status,
    category: factory.category,
    categoryLabel: enumLabel(db, "factoryCategory", factory.category),
    region: factory.region,
    regionLabel: enumLabel(db, "factoryRegion", factory.region),
    technology: factory.technology,
    technologyLabel: enumLabel(db, "technologyNode", factory.technology),
    pmId: factory.pmId,
    pmName: nameOf(db, factory.pmId),
    pmContact: factory.pmContact,
    plannedStart: factory.plannedStart,
    plannedEnd: factory.plannedEnd,
    actualStart: factory.actualStart,
    actualEnd: factory.actualEnd,
    phases: phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      order: phase.order,
      status: phase.status,
      ownerId: phase.ownerId,
      ownerName: nameOf(db, phase.ownerId),
      plannedStart: phase.plannedStart,
      plannedEnd: phase.plannedEnd,
      actualStart: phase.actualStart,
      actualEnd: phase.actualEnd,
      riskNote: phase.riskNote,
      dependsOn: phase.dependsOnPhaseIds.map((dep) => phases.find((item) => item.id === dep)?.name ?? dep),
      focus: phase.order === 2,
      milestones: db.milestones
        .filter((milestone) => milestone.phaseId === phase.id)
        .map((milestone) => ({
          id: milestone.id,
          name: milestone.name,
          dueDate: milestone.dueDate,
          deliverables: milestone.deliverables,
          done: milestone.done,
          overdue: !milestone.done && milestone.dueDate < db.asOf,
          ownerId: milestone.ownerId,
          ownerName: nameOf(db, milestone.ownerId),
        })),
    })),
    windows: db.platforms.map((platform) => {
      const plan = db.plans.find((item) => item.factoryId === id && item.platformId === platform.id);
      const check = evaluateConstructionWindow(
        { start: plan?.constructionStart ?? null, end: plan?.constructionEnd ?? null },
        phase2 ? { start: phase2.plannedStart, end: phase2.plannedEnd } : null,
      );
      return {
        id: platform.id,
        label: platform.name,
        start: plan?.constructionStart ?? null,
        end: plan?.constructionEnd ?? null,
        state: check.state,
        reasons: check.reasons,
      };
    }),
    plans: db.platforms.map((platform) => {
      const plan = db.plans.find((item) => item.factoryId === id && item.platformId === platform.id);
      const check = evaluateConstructionWindow(
        { start: plan?.constructionStart ?? null, end: plan?.constructionEnd ?? null },
        phase2 ? { start: phase2.plannedStart, end: phase2.plannedEnd } : null,
      );
      return {
        id: plan?.id ?? "",
        platformId: platform.id,
        platformName: platform.name,
        mode: platform.mode,
        status: plan?.status ?? "NOT_SUBMITTED",
        providedVersion: platform.mode === "VERSIONED" ? versionName(db, plan?.providedVersionId ?? null) : null,
        changeCount: plan?.featureChanges.length ?? 0,
        windowStart: plan?.constructionStart ?? null,
        windowEnd: plan?.constructionEnd ?? null,
        windowState: check.state,
        windowReasons: check.reasons,
        revisionCount: plan ? db.revisions.filter((revision) => revision.planId === plan.id).length : 0,
      };
    }),
    deployments: db.deployments
      .filter((deployment) => deployment.factoryId === id)
      .map((deployment) => {
        const platform = mustPlatform(db, deployment.platformId);
        const planned = versionName(db, deployment.plannedVersionId);
        const actual = versionName(db, deployment.actualVersionId);
        const latest = latestVersion(db, platform.id);
        return {
          id: deployment.id,
          platformId: platform.id,
          platformName: platform.name,
          mode: platform.mode,
          status: deployment.status,
          plannedVersion: planned,
          actualVersion: actual,
          behindPlan: Boolean(actual && planned && (compareSemver(actual, planned) ?? 0) < 0),
          behindLatest: Boolean(actual && latest && (compareSemver(actual, latest) ?? 0) < 0),
          secondaryOwnerName: nameOf(db, deployment.secondaryOwnerId),
          machines: machineLines(db, deployment.id),
          plannedTotal: plannedTotal(machineLines(db, deployment.id)),
        };
      }),
    issues: db.issues.filter((issue) => issue.factoryId === id).map((issue) => issueItem(db, issue)),
    topics: db.topics
      .filter((topic) => topic.factoryId === id)
      .sort((a, b) => b.raisedOn.localeCompare(a.raisedOn))
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        ownerId: topic.ownerId,
        ownerName: nameOf(db, topic.ownerId),
        status: topic.status,
        raisedOn: topic.raisedOn,
      })),
    activity: activityItems(db).filter((item) => relatedToFactory(db, item, id)).slice(0, 12),
    machineRollup: factoryRollup(db, id),
  };
}

export function buildIssues(db: Database): { asOf: string; items: IssueListItem[] } {
  return { asOf: db.asOf, items: db.issues.map((issue) => issueItem(db, issue)) };
}

export function buildIssue(db: Database, id: string): IssuePage {
  const issue = db.issues.find((item) => item.id === id);
  if (!issue) throw new ApiError("找不到這筆問題", 404);
  return {
    ...issueItem(db, issue),
    asOf: db.asOf,
    activity: activityItems(db).filter((item) => item.entityType === "ISSUE" && item.entityId === id),
  };
}

export function buildPlatforms(db: Database): { asOf: string; items: PlatformSummary[] } {
  return { asOf: db.asOf, items: db.platforms.map((platform) => platformSummary(db, platform.id)) };
}

export function buildPlatform(db: Database, id: string): PlatformDetail {
  const summary = platformSummary(db, id);
  mustPlatform(db, id);
  return {
    ...summary,
    asOf: db.asOf,
    versions: db.versions
      .filter((version) => version.platformId === id)
      .sort((a, b) => (compareSemver(a.version, b.version) ?? 0))
      .map((version) => ({
        id: version.id,
        version: version.version,
        releasedAt: version.releasedAt,
        notes: version.notes,
        features: db.features
          .filter((feature) => feature.platformId === id)
          .map((feature) => ({
            id: feature.id,
            name: feature.name,
            supported: db.versionFeatures.some((row) => row.versionId === version.id && row.featureId === feature.id && row.supported),
          })),
      })),
    features: db.features.filter((feature) => feature.platformId === id).map((feature) => ({
      id: feature.id,
      code: feature.code,
      name: feature.name,
      defaultEnabled: feature.defaultEnabled,
    })),
    deployments: db.deployments
      .filter((deployment) => deployment.platformId === id)
      .map((deployment) => {
        const factory = mustFactory(db, deployment.factoryId);
        const planned = versionName(db, deployment.plannedVersionId);
        const actual = versionName(db, deployment.actualVersionId);
        const latest = latestVersion(db, id);
        const plan = db.plans.find((item) => item.deploymentId === deployment.id);
        return {
          id: deployment.id,
          factoryId: factory.id,
          factoryName: factory.name,
          factoryCode: factory.code,
          status: deployment.status,
          plannedVersion: planned,
          actualVersion: actual,
          behindPlan: Boolean(actual && planned && (compareSemver(actual, planned) ?? 0) < 0),
          behindLatest: Boolean(actual && latest && (compareSemver(actual, latest) ?? 0) < 0),
          secondaryOwnerName: nameOf(db, deployment.secondaryOwnerId),
          machines: machineLines(db, deployment.id),
          plannedTotal: plannedTotal(machineLines(db, deployment.id)),
          planStatus: plan?.status ?? "NOT_SUBMITTED",
          deployedAt: deployment.deployedAt,
        };
      }),
  };
}

export function buildCapabilities(db: Database): CapabilityMatrix {
  const features = db.features.map((feature) => ({
    id: feature.id,
    code: feature.code,
    name: feature.name,
    platformId: feature.platformId,
    platformName: mustPlatform(db, feature.platformId).name,
  }));
  return {
    asOf: db.asOf,
    features,
    rows: db.deployments.map((deployment) => {
      const platform = mustPlatform(db, deployment.platformId);
      const factory = mustFactory(db, deployment.factoryId);
      const plan = db.plans.find((item) => item.factoryId === factory.id && item.platformId === platform.id);
      const versionId = platform.mode === "VERSIONED" ? plan?.providedVersionId ?? null : null;
      const platformFeatures = db.features.filter((feature) => feature.platformId === platform.id);
      return {
        deploymentId: deployment.id,
        factoryId: factory.id,
        factoryName: factory.name,
        platformId: platform.id,
        platformName: platform.name,
        mode: platform.mode,
        versionLabel: versionName(db, versionId),
        cells: platformFeatures.map((feature) => {
          const supported = versionId
            ? db.versionFeatures.some((row) => row.versionId === versionId && row.featureId === feature.id && row.supported)
            : null;
          const plannedRow = plan?.plannedFeatures.find((row) => row.featureId === feature.id);
          const change = plan?.featureChanges.find((row) => row.featureId === feature.id);
          return {
            featureId: feature.id,
            planned: resolvePlanned({
              mode: platform.mode,
              versionSupported: platform.mode === "VERSIONED" ? supported : null,
              changeType: change?.changeType ?? null,
              plannedEnabled: plannedRow ? plannedRow.enabled : null,
            }),
          };
        }),
      };
    }),
    factories: db.factories.map((factory) => ({ id: factory.id, name: factory.name })),
    platforms: db.platforms.map((platform) => ({ id: platform.id, name: platform.name, mode: platform.mode })),
  };
}

export function buildPlan(db: Database, factoryId: string, platformId: string, actorId: string): PlanPage {
  const factory = mustFactory(db, factoryId);
  const platform = mustPlatform(db, platformId);
  const deployment = db.deployments.find((item) => item.factoryId === factoryId && item.platformId === platformId);
  const plan = db.plans.find((item) => item.factoryId === factoryId && item.platformId === platformId);
  if (!deployment || !plan) throw new ApiError("找不到這份平台計畫", 404);
  const phase2 = db.phases.find((phase) => phase.factoryId === factoryId && phase.order === 2) ?? null;
  const window = evaluateConstructionWindow(
    { start: plan.constructionStart, end: plan.constructionEnd },
    phase2 ? { start: phase2.plannedStart, end: phase2.plannedEnd } : null,
  );
  mustUser(db, actorId);
  const canEdit = true;
  const canApprove = plan.status === "SUBMITTED";
  return {
    asOf: db.asOf,
    factoryId,
    factoryName: factory.name,
    platformId,
    platformName: platform.name,
    platformCode: platform.code,
    mode: platform.mode,
    primaryOwnerName: nameOf(db, platform.primaryOwnerId),
    devDepartment: platform.devDepartment,
    projectDepartment: platform.projectDepartment,
    phase2: phase2
      ? { id: phase2.id, name: phase2.name, status: phase2.status, plannedStart: phase2.plannedStart, plannedEnd: phase2.plannedEnd }
      : null,
    deploymentId: deployment.id,
    deploymentStatus: deployment.status,
    actualVersion: versionName(db, deployment.actualVersionId),
    secondaryOwnerName: nameOf(db, deployment.secondaryOwnerId),
    planId: plan.id,
    status: plan.status,
    providedVersionId: plan.providedVersionId,
    plannedFeatures: plan.plannedFeatures,
    featureChanges: plan.featureChanges,
    constructionStart: plan.constructionStart,
    constructionEnd: plan.constructionEnd,
    note: plan.note,
    machines: machineLines(db, deployment.id),
    plannedTotal: plannedTotal(machineLines(db, deployment.id)),
    windowState: window.state,
    windowReasons: window.reasons,
    versions: db.versions
      .filter((version) => version.platformId === platformId)
      .sort((a, b) => compareSemver(a.version, b.version) ?? 0)
      .map((version) => ({ id: version.id, version: version.version, notes: version.notes })),
    features: db.features
      .filter((feature) => feature.platformId === platformId)
      .map((feature) => ({ id: feature.id, code: feature.code, name: feature.name, defaultEnabled: feature.defaultEnabled })),
    revisions: db.revisions
      .filter((revision) => revision.planId === plan.id)
      .sort((a, b) => b.number - a.number)
      .map((revision) => ({
        id: revision.id,
        number: revision.number,
        action: revision.action,
        version: versionName(db, revision.providedVersionId),
        changes: revision.featureChanges.map((change) => ({
          featureId: change.featureId,
          featureName: db.features.find((feature) => feature.id === change.featureId)?.name ?? change.featureId,
          changeType: change.changeType,
          summary: change.summary,
        })),
        constructionStart: revision.constructionStart,
        constructionEnd: revision.constructionEnd,
        machines: (revision.machines ?? []).map((line) => ({
          machineTypeId: line.machineTypeId,
          name: db.machineTypes.find((type) => type.id === line.machineTypeId)?.name ?? line.machineTypeId,
          planned: line.planned,
        })),
        actorName: nameOf(db, revision.actorId),
        createdAt: revision.createdAt,
        note: revision.note,
      })),
    canEdit,
    canApprove,
    accessNote: "單一管理視角，可以直接修改與核准。",
  };
}

export function buildDeployment(db: Database, id: string): DeploymentPage {
  const deployment = db.deployments.find((item) => item.id === id);
  if (!deployment) throw new ApiError("找不到這筆部署", 404);
  const platform = mustPlatform(db, deployment.platformId);
  const factory = mustFactory(db, deployment.factoryId);
  return {
    asOf: db.asOf,
    id: deployment.id,
    factoryId: factory.id,
    factoryName: factory.name,
    platformId: platform.id,
    platformName: platform.name,
    mode: platform.mode,
    status: deployment.status,
    plannedVersionId: deployment.plannedVersionId,
    actualVersionId: deployment.actualVersionId,
    secondaryOwnerId: deployment.secondaryOwnerId,
    machines: machineLines(db, deployment.id),
    plannedTotal: plannedTotal(machineLines(db, deployment.id)),
    plannedDate: deployment.plannedDate,
    deployedAt: deployment.deployedAt,
    notes: deployment.notes,
    versions: db.versions
      .filter((version) => version.platformId === platform.id)
      .sort((a, b) => compareSemver(a.version, b.version) ?? 0)
      .map((version) => ({ id: version.id, version: version.version })),
    users: db.users,
    phases: db.phases
      .filter((phase) => phase.factoryId === factory.id)
      .sort((a, b) => a.order - b.order)
      .map((phase) => ({ id: phase.id, name: phase.name })),
    links: db.phaseLinks
      .filter((link) => link.deploymentId === id)
      .map((link) => ({ phaseId: link.phaseId, relation: link.relation })),
    features: db.features
      .filter((feature) => feature.platformId === platform.id)
      .map((feature) => {
        const config = db.featureConfigs.find((item) => item.deploymentId === id && item.featureId === feature.id);
        const supportedByActual = deployment.actualVersionId
          ? db.versionFeatures.some((row) => row.versionId === deployment.actualVersionId && row.featureId === feature.id && row.supported)
          : null;
        return {
          id: feature.id,
          name: feature.name,
          defaultEnabled: feature.defaultEnabled,
          desired: config?.desired ?? feature.defaultEnabled,
          actual: config?.actual ?? null,
          supportedByActual,
        };
      }),
  };
}

export function buildActivity(db: Database): { asOf: string; items: ActivityItem[] } {
  return { asOf: db.asOf, items: activityItems(db) };
}

export function buildFactories(db: Database) {
  return { asOf: db.asOf, items: db.factories.map((factory) => boardRow(db, factory.id)), users: db.users, enumerations: db.enumerations };
}

function boardRow(db: Database, factoryId: string): FactoryBoardRow {
  const factory = mustFactory(db, factoryId);
  const phases = db.phases.filter((phase) => phase.factoryId === factoryId).sort((a, b) => a.order - b.order);
  const current = phases.find((phase) => phase.status !== "COMPLETED") ?? phases[phases.length - 1];
  const plans = db.plans.filter((plan) => plan.factoryId === factoryId);
  const phase2 = phases.find((phase) => phase.order === 2) ?? null;
  let outside = 0;
  let missing = 0;
  let notReady = 0;
  for (const platform of db.platforms) {
    const plan = plans.find((item) => item.platformId === platform.id);
    if (!plan || plan.status === "NOT_SUBMITTED") missing += 1;
    const check = evaluateConstructionWindow(
      { start: plan?.constructionStart ?? null, end: plan?.constructionEnd ?? null },
      phase2 ? { start: phase2.plannedStart, end: phase2.plannedEnd } : null,
    );
    if (check.state === "OUTSIDE") outside += 1;
    if (!readinessFor(db, factoryId, platform.id, phase2).readiness.ready) notReady += 1;
  }
  return {
    id: factory.id,
    code: factory.code,
    name: factory.name,
    location: factory.location,
    status: factory.status,
    category: factory.category,
    categoryLabel: enumLabel(db, "factoryCategory", factory.category),
    region: factory.region,
    regionLabel: enumLabel(db, "factoryRegion", factory.region),
    technology: factory.technology,
    technologyLabel: enumLabel(db, "technologyNode", factory.technology),
    pmName: nameOf(db, factory.pmId),
    pmContact: factory.pmContact,
    openTopics: db.topics.filter((topic) => topic.factoryId === factoryId && (topic.status === "OPEN" || topic.status === "IN_DISCUSSION")).length,
    currentPhaseName: current?.name ?? "—",
    currentPhaseOrder: current?.order ?? 0,
    currentPhaseStatus: current?.status ?? "NOT_STARTED",
    currentOwnerName: current ? nameOf(db, current.ownerId) : "—",
    phases: phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      order: phase.order,
      status: phase.status,
      plannedStart: phase.plannedStart,
      plannedEnd: phase.plannedEnd,
      actualStart: phase.actualStart,
      actualEnd: phase.actualEnd,
    })),
    notReady,
    blockers: db.issues.filter((issue) => issue.factoryId === factoryId && (issue.status === "BLOCKED" || issue.severity === "CRITICAL") && issue.status !== "RESOLVED" && issue.status !== "CLOSED").length,
    missingPlans: missing,
    outsideWindows: outside,
  };
}

function readinessFor(
  db: Database,
  factoryId: string,
  platformId: string,
  phase2: { plannedStart: string; plannedEnd: string } | null,
) {
  const platform = mustPlatform(db, platformId);
  const plan = db.plans.find((item) => item.factoryId === factoryId && item.platformId === platformId);
  const window = evaluateConstructionWindow(
    { start: plan?.constructionStart ?? null, end: plan?.constructionEnd ?? null },
    phase2 ? { start: phase2.plannedStart, end: phase2.plannedEnd } : null,
  );
  const featureIds = db.features.filter((feature) => feature.platformId === platformId).map((feature) => feature.id);
  return {
    window,
    plan,
    platform,
    readiness: cellReadiness({
      planStatus: plan?.status ?? "NOT_SUBMITTED",
      windowState: window.state,
      mode: platform.mode,
      hasProvidedVersion: Boolean(plan?.providedVersionId),
      featurePlanComplete: isFeaturePlanComplete(featureIds, plan?.plannedFeatures ?? []),
    }),
  };
}

function buildRow(db: Database, factoryId: string, platformIds: string[]): BuildRow {
  const factory = mustFactory(db, factoryId);
  const phase2 = db.phases.find((phase) => phase.factoryId === factoryId && phase.order === 2) ?? null;
  const cells: BuildCell[] = platformIds.map((platformId) => {
    const deployment = db.deployments.find((item) => item.factoryId === factoryId && item.platformId === platformId);
    const { window, plan, platform, readiness } = readinessFor(db, factoryId, platformId, phase2);
    const planStatus = plan?.status ?? "NOT_SUBMITTED";
    const deploymentStatus = deployment?.status ?? "PLANNED";
    const providedVersion = platform.mode === "VERSIONED" ? versionName(db, plan?.providedVersionId ?? null) : null;
    const actualVersion = platform.mode === "VERSIONED" ? versionName(db, deployment?.actualVersionId ?? null) : null;
    return {
      factoryId,
      platformId,
      deploymentId: deployment?.id ?? "",
      planId: plan?.id ?? "",
      deploymentStatus,
      planStatus,
      mode: platform.mode,
      providedVersion,
      actualVersion,
      changeCount: plan?.featureChanges.length ?? 0,
      versionGap: Boolean(providedVersion && actualVersion && providedVersion !== actualVersion),
      primaryOwnerName: nameOf(db, platform.primaryOwnerId),
      secondaryOwnerName: deployment ? nameOf(db, deployment.secondaryOwnerId) : "—",
      machines: deployment ? machineLines(db, deployment.id) : [],
      plannedTotal: deployment ? plannedTotal(machineLines(db, deployment.id)) : 0,
      windowStart: plan?.constructionStart ?? null,
      windowEnd: plan?.constructionEnd ?? null,
      windowState: window.state,
      windowReasons: window.reasons,
      ready: readiness.ready,
      flags: readiness.flags,
    };
  });
  return {
    factoryId,
    factoryName: factory.name,
    factoryCode: factory.code,
    category: factory.category,
    categoryLabel: enumLabel(db, "factoryCategory", factory.category),
    region: factory.region,
    regionLabel: enumLabel(db, "factoryRegion", factory.region),
    technology: factory.technology,
    technologyLabel: enumLabel(db, "technologyNode", factory.technology),
    status: factory.status,
    phase2: phase2
      ? { id: phase2.id, name: phase2.name, status: phase2.status, plannedStart: phase2.plannedStart, plannedEnd: phase2.plannedEnd }
      : null,
    cells,
    readyCount: cells.filter((cell) => cell.ready).length,
  };
}

function exceptions(db: Database) {
  const items: Portfolio["exceptions"] = [];
  for (const factory of db.factories) {
    if (factory.status === "DELAYED") {
      items.push({
        id: `ex-fac-${factory.id}`,
        rank: 0,
        tone: "danger",
        title: `${factory.name}延遲`,
        detail: "工廠整體狀態是延遲，先看平台建立的未提報計畫與超出時程。",
        href: `/factories/${factory.id}`,
        factoryName: factory.name,
      });
    } else if (factory.status === "AT_RISK") {
      items.push({
        id: `ex-risk-${factory.id}`,
        rank: 6,
        tone: "warning",
        title: `${factory.name}有風險`,
        detail: factory.description,
        href: `/factories/${factory.id}`,
        factoryName: factory.name,
      });
    }
    const phase2 = db.phases.find((phase) => phase.factoryId === factory.id && phase.order === 2);
    for (const phase of db.phases.filter((phase) => phase.factoryId === factory.id)) {
      if (phase.status !== "COMPLETED" && phase.plannedEnd < db.asOf) {
        items.push({
          id: `ex-phase-${phase.id}`,
          rank: 4,
          tone: "danger",
          title: `${factory.name} · ${phase.name}已過計畫結束日`,
          detail: `計畫結束 ${phase.plannedEnd}，狀態仍是未完成。`,
          href: `/factories/${factory.id}#timeline`,
          factoryName: factory.name,
        });
      }
    }
    for (const platform of db.platforms) {
      const plan = db.plans.find((item) => item.factoryId === factory.id && item.platformId === platform.id);
      const check = evaluateConstructionWindow(
        { start: plan?.constructionStart ?? null, end: plan?.constructionEnd ?? null },
        phase2 ? { start: phase2.plannedStart, end: phase2.plannedEnd } : null,
      );
      if (!plan || plan.status === "NOT_SUBMITTED") {
        const active = phase2 && (phase2.status === "IN_PROGRESS" || phase2.status === "AT_RISK" || phase2.status === "DELAYED");
        items.push({
          id: `ex-plan-${factory.id}-${platform.id}`,
          rank: active ? 2 : 8,
          tone: active ? "warning" : "info",
          title: `${factory.name} · ${platform.name}計畫未提報`,
          detail: platform.mode === "FEATURE_ONLY"
            ? "平台團隊尚未送出功能開關與施工時程。"
            : "平台團隊尚未送出提供版本、異動功能與施工時程。",
          href: `/factories/${factory.id}/plans/${platform.id}`,
          factoryName: factory.name,
        });
      }
      if (check.state === "OUTSIDE") {
        items.push({
          id: `ex-win-${factory.id}-${platform.id}`,
          rank: 2,
          tone: "danger",
          title: `${factory.name} · ${platform.name}施工時程超出平台建立`,
          detail: `${plan?.constructionStart ?? "—"} – ${plan?.constructionEnd ?? "—"}，階段 ${phase2?.plannedStart ?? "—"} – ${phase2?.plannedEnd ?? "—"}。平行施工的重疊不算衝突。`,
          href: `/factories/${factory.id}/plans/${platform.id}`,
          factoryName: factory.name,
        });
      }
    }
  }
  for (const issue of db.issues) {
    const open = issue.status === "OPEN" || issue.status === "IN_PROGRESS" || issue.status === "BLOCKED";
    if (!open || !issue.dueDate || issue.dueDate >= db.asOf) continue;
    const factory = mustFactory(db, issue.factoryId);
    items.push({
      id: `ex-iss-${issue.id}`,
      rank: issue.severity === "CRITICAL" || issue.severity === "HIGH" ? 2 : 7,
      tone: issue.severity === "CRITICAL" ? "danger" : "warning",
      title: `${issue.code} 逾期 · ${issue.title}`,
      detail: `到期 ${issue.dueDate}，負責人 ${nameOf(db, issue.ownerId)}。`,
      href: `/issues/${issue.id}`,
      factoryName: factory.name,
    });
  }
  return items.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, "zh-Hant"));
}

function milestoneRows(db: Database): MilestoneRow[] {
  return db.milestones
    .filter((milestone) => !milestone.done && milestone.dueDate <= addDaysLoose(db.asOf, 21))
    .map((milestone) => {
      const phase = db.phases.find((item) => item.id === milestone.phaseId);
      const factory = phase ? mustFactory(db, phase.factoryId) : null;
      return {
        id: milestone.id,
        name: milestone.name,
        dueDate: milestone.dueDate,
        done: milestone.done,
        overdue: milestone.dueDate < db.asOf,
        factoryId: factory?.id ?? "",
        factoryName: factory?.name ?? "—",
        phaseName: phase?.name ?? "—",
        ownerName: nameOf(db, milestone.ownerId),
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function pendingPlans(db: Database): PendingPlan[] {
  return db.plans
    .filter((plan) => plan.status === "SUBMITTED")
    .map((plan) => {
      const platform = mustPlatform(db, plan.platformId);
      return {
        id: plan.id,
        factoryId: plan.factoryId,
        factoryName: mustFactory(db, plan.factoryId).name,
        platformId: platform.id,
        platformName: platform.name,
        status: plan.status,
        mode: platform.mode,
      };
    });
}

function issueItem(db: Database, issue: Database["issues"][number]): IssueListItem {
  const open = issue.status === "OPEN" || issue.status === "IN_PROGRESS" || issue.status === "BLOCKED";
  return {
    id: issue.id,
    code: issue.code,
    title: issue.title,
    description: issue.description,
    factoryId: issue.factoryId,
    factoryName: mustFactory(db, issue.factoryId).name,
    phaseId: issue.phaseId,
    phaseName: issue.phaseId ? db.phases.find((phase) => phase.id === issue.phaseId)?.name ?? null : null,
    platformId: issue.platformId,
    platformName: issue.platformId ? mustPlatform(db, issue.platformId).name : null,
    ownerId: issue.ownerId,
    ownerName: nameOf(db, issue.ownerId),
    severity: issue.severity,
    priority: issue.priority,
    status: issue.status,
    dueDate: issue.dueDate,
    overdue: Boolean(open && issue.dueDate && issue.dueDate < db.asOf),
    resolution: issue.resolution,
    updatedAt: issue.updatedAt,
  };
}

function platformSummary(db: Database, id: string): PlatformSummary {
  const platform = mustPlatform(db, id);
  const latest = latestVersion(db, id);
  const outdated = db.deployments.filter((deployment) => {
    if (deployment.platformId !== id) return false;
    const actual = versionName(db, deployment.actualVersionId);
    return Boolean(latest && actual && (compareSemver(actual, latest) ?? 0) < 0);
  }).length;
  return {
    id: platform.id,
    code: platform.code,
    name: platform.name,
    description: platform.description,
    devDepartment: platform.devDepartment,
    projectDepartment: platform.projectDepartment,
    primaryOwnerId: platform.primaryOwnerId,
    primaryOwnerName: nameOf(db, platform.primaryOwnerId),
    mode: platform.mode,
    versionCount: db.versions.filter((version) => version.platformId === id).length,
    latestVersion: latest,
    outdatedFactories: outdated,
  };
}

function activityItems(db: Database): ActivityItem[] {
  return [...db.activity]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => ({
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      action: item.action,
      summary: item.summary,
      actorName: nameOf(db, item.actorId),
      createdAt: item.createdAt,
    }));
}

function relatedToFactory(db: Database, item: ActivityItem, factoryId: string): boolean {
  if (item.entityType === "FACTORY") return item.entityId === factoryId;
  if (item.entityType === "PHASE") return db.phases.some((phase) => phase.id === item.entityId && phase.factoryId === factoryId);
  if (item.entityType === "MILESTONE") {
    const milestone = db.milestones.find((row) => row.id === item.entityId);
    const phase = milestone ? db.phases.find((row) => row.id === milestone.phaseId) : undefined;
    return phase?.factoryId === factoryId;
  }
  if (item.entityType === "ISSUE") return db.issues.some((issue) => issue.id === item.entityId && issue.factoryId === factoryId);
  if (item.entityType === "TOPIC") return db.topics.some((topic) => topic.id === item.entityId && topic.factoryId === factoryId);
  if (item.entityType === "DEPLOYMENT" || item.entityType === "FEATURE") {
    return db.deployments.some((deployment) => deployment.id === item.entityId && deployment.factoryId === factoryId);
  }
  if (item.entityType === "PLAN") return db.plans.some((plan) => plan.id === item.entityId && plan.factoryId === factoryId);
  return false;
}

function latestVersion(db: Database, platformId: string): string | null {
  const versions = db.versions.filter((version) => version.platformId === platformId).map((version) => version.version);
  if (versions.length === 0) return null;
  return versions.sort((a, b) => compareSemver(a, b) ?? 0).at(-1) ?? null;
}

function versionName(db: Database, id: string | null): string | null {
  if (!id) return null;
  return db.versions.find((version) => version.id === id)?.version ?? null;
}

function machineLines(db: Database, deploymentId: string) {
  return [...db.machineTypes]
    .sort((a, b) => a.order - b.order)
    .map((type) => ({
      machineTypeId: type.id,
      code: type.code,
      name: type.name,
      planned: db.machineQuantities.find((row) => row.deploymentId === deploymentId && row.machineTypeId === type.id)?.planned ?? 0,
    }))
    .filter((line) => db.machineTypes.find((type) => type.id === line.machineTypeId)?.active || line.planned > 0);
}

function factoryRollup(db: Database, factoryId: string) {
  const deployments = db.deployments.filter((deployment) => deployment.factoryId === factoryId);
  return [...db.machineTypes]
    .sort((a, b) => a.order - b.order)
    .map((type) => ({
      machineTypeId: type.id,
      code: type.code,
      name: type.name,
      planned: deployments.reduce((sum, deployment) => {
        const row = db.machineQuantities.find((item) => item.deploymentId === deployment.id && item.machineTypeId === type.id);
        return sum + (row?.planned ?? 0);
      }, 0),
    }))
    .filter((line) => line.planned > 0 || db.machineTypes.find((type) => type.id === line.machineTypeId)?.active);
}

function enumLabel(db: Database, set: Database["enumerations"][number]["set"], code: string): string {
  return db.enumerations.find((item) => item.set === set && item.code === code)?.label ?? code;
}

function nameOf(db: Database, id: string): string {
  return db.users.find((user) => user.id === id)?.name ?? "—";
}

function mustUser(db: Database, id: string): User {
  const user = db.users.find((item) => item.id === id);
  if (!user) throw new ApiError("找不到這位人員", 404);
  return user;
}

function mustFactory(db: Database, id: string) {
  const factory = db.factories.find((item) => item.id === id);
  if (!factory) throw new ApiError("找不到這座工廠", 404);
  return factory;
}

function mustPlatform(db: Database, id: string) {
  const platform = db.platforms.find((item) => item.id === id);
  if (!platform) throw new ApiError("找不到這個平台", 404);
  return platform;
}

function addDaysLoose(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
