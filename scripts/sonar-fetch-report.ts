/**
 * Fetches SonarCloud/SonarQube quality gate, open issues, and security hotspots.
 * Used locally (`npm run sonar:report`) and in CI (artifact for agents via `gh run download`).
 *
 * Requires: SONAR_TOKEN, optional SONAR_HOST_URL (default https://sonarcloud.io)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROPS_PATH = resolve('sonar-project.properties');

/** Load root `.env.local` / `.env` (gitignored) for local `npm run sonar:report`. */
function loadEnvFiles(): void {
  for (const name of ['.env.local', '.env']) {
    const path = resolve(name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let value = t.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

type SonarProps = {
  organization?: string;
  projectKey: string;
  projectName?: string;
};

type QualityGateStatus = {
  projectStatus?: {
    status?: string;
    conditions?: Array<{
      metricKey?: string;
      status?: string;
      actualValue?: string;
      errorThreshold?: string;
    }>;
  };
};

type IssueSearch = {
  total?: number;
  issues?: Array<{
    key?: string;
    type?: string;
    severity?: string;
    message?: string;
    component?: string;
    line?: number;
    rule?: string;
    status?: string;
  }>;
};

type HotspotSearch = {
  paging?: { total?: number };
  hotspots?: Array<{
    key?: string;
    component?: string;
    line?: number;
    message?: string;
    status?: string;
    vulnerabilityProbability?: string;
  }>;
};

function readSonarProps(path: string): SonarProps {
  const text = readFileSync(path, 'utf8');
  const map: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    map[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  const projectKey = map['sonar.projectKey'];
  if (!projectKey) throw new Error(`Missing sonar.projectKey in ${path}`);
  return {
    organization: map['sonar.organization'],
    projectKey,
    projectName: map['sonar.projectName'],
  };
}

type SonarScope = {
  branch: string | null;
  pullRequest: string | null;
};

function parseArgs(argv: string[]): {
  outPath: string | null;
  scope: SonarScope;
  json: boolean;
} {
  let outPath: string | null = null;
  const prEnv = process.env.SONAR_PULL_REQUEST?.trim();
  let pullRequest: string | null = prEnv ? prEnv : null;
  let branch: string | null =
    process.env.SONAR_BRANCH?.trim() || process.env.GITHUB_HEAD_REF?.trim() || null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      outPath = argv[++i] ?? null;
    } else if (a === '--branch' && argv[i + 1]) {
      branch = argv[++i] ?? null;
    } else if (a === '--pull-request' && argv[i + 1]) {
      pullRequest = argv[++i] ?? null;
    } else if (a === '--json') {
      json = true;
    }
  }
  // SonarCloud PR decoration is keyed by pullRequest id, not branch name.
  if (pullRequest) branch = null;
  return { outPath, scope: { branch, pullRequest }, json };
}

async function sonarGet<T>(apiPath: string, params: Record<string, string>): Promise<T> {
  const host = (process.env.SONAR_HOST_URL ?? 'https://sonarcloud.io').replace(/\/$/, '');
  const token = process.env.SONAR_TOKEN;
  if (!token) {
    throw new Error('SONAR_TOKEN is not set. Add it to GitHub Secrets or local .env (never commit).');
  }

  const url = new URL(apiPath, host);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const auth = Buffer.from(`${token}:`).toString('base64');
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Sonar API ${res.status} ${apiPath}: ${bodyText.slice(0, 400)}`);
  }

  return JSON.parse(bodyText) as T;
}

function countBySeverity(issues: NonNullable<IssueSearch['issues']>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    const s = issue.severity ?? 'UNKNOWN';
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

function shortComponent(component: string | undefined, projectKey: string): string {
  if (!component) return '—';
  const prefix = `${projectKey}:`;
  return component.startsWith(prefix) ? component.slice(prefix.length) : component;
}

function isScopeNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('404') && (msg.includes('not found') || msg.includes("doesn't exist"));
}

function scopeLabel(scope: SonarScope): string {
  if (scope.pullRequest) return `PR #${scope.pullRequest}`;
  if (scope.branch) return `branch ${scope.branch}`;
  return 'default';
}

function applyScope(params: Record<string, string>, scope: SonarScope): void {
  if (scope.pullRequest) {
    params.pullRequest = scope.pullRequest;
  } else if (scope.branch) {
    params.branch = scope.branch;
  }
}

async function buildReport(props: SonarProps, scope: SonarScope): Promise<string> {
  try {
    return await buildReportForScope(props, scope);
  } catch (err) {
    if ((scope.branch || scope.pullRequest) && isScopeNotFoundError(err)) {
      console.warn(
        `[sonar:report] ${scopeLabel(scope)} not analyzed yet — falling back to default branch`,
      );
      return buildReportForScope(props, { branch: null, pullRequest: null });
    }
    throw err;
  }
}

async function buildReportForScope(props: SonarProps, scope: SonarScope): Promise<string> {
  const { projectKey, organization, projectName } = props;
  const host = (process.env.SONAR_HOST_URL ?? 'https://sonarcloud.io').replace(/\/$/, '');
  const dashboardUrl = organization
    ? `${host}/project/overview?id=${encodeURIComponent(projectKey)}`
    : `${host}/dashboard?id=${encodeURIComponent(projectKey)}`;

  const qgParams: Record<string, string> = { projectKey };
  const issueParams: Record<string, string> = {
    componentKeys: projectKey,
    resolved: 'false',
    ps: '100',
    facets: 'severities,types',
  };
  const hotspotParams: Record<string, string> = { projectKey, status: 'TO_REVIEW', ps: '50' };

  if (organization) {
    qgParams.organization = organization;
    issueParams.organization = organization;
    hotspotParams.organization = organization;
  }
  applyScope(qgParams, scope);
  applyScope(issueParams, scope);
  applyScope(hotspotParams, scope);

  const [qg, bugs, vulns, smells, hotspots] = await Promise.all([
    sonarGet<QualityGateStatus>('/api/qualitygates/project_status', qgParams),
    sonarGet<IssueSearch>('/api/issues/search', { ...issueParams, types: 'BUG' }),
    sonarGet<IssueSearch>('/api/issues/search', { ...issueParams, types: 'VULNERABILITY' }),
    sonarGet<IssueSearch>('/api/issues/search', { ...issueParams, types: 'CODE_SMELL' }),
    sonarGet<HotspotSearch>('/api/hotspots/search', hotspotParams),
  ]);

  const allIssues = [
    ...(bugs.issues ?? []),
    ...(vulns.issues ?? []),
    ...(smells.issues ?? []),
  ];
  const severityCounts = countBySeverity(allIssues);
  const gateStatus = qg.projectStatus?.status ?? 'UNKNOWN';
  const failedConditions =
    qg.projectStatus?.conditions?.filter((c) => c.status === 'ERROR') ?? [];

  const lines: string[] = [
    `# Sonar report: ${projectName ?? projectKey}`,
    '',
    `- **Project key:** \`${projectKey}\``,
    organization ? `- **Organization:** \`${organization}\`` : null,
    scope.pullRequest ? `- **Pull request:** #${scope.pullRequest}` : null,
    scope.branch ? `- **Branch:** \`${scope.branch}\`` : null,
    `- **Dashboard:** ${dashboardUrl}`,
    `- **Generated:** ${new Date().toISOString()}`,
    '',
    '## Quality Gate',
    '',
    `**Status:** ${gateStatus}`,
    '',
  ].filter((l): l is string => l !== null);

  if (failedConditions.length > 0) {
    lines.push('### Failed conditions', '');
    for (const c of failedConditions) {
      lines.push(
        `- \`${c.metricKey}\`: actual **${c.actualValue}**, threshold **${c.errorThreshold}**`,
      );
    }
    lines.push('');
  }

  lines.push(
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Open bugs (reliability) | ${bugs.total ?? bugs.issues?.length ?? 0} |`,
    `| Open vulnerabilities | ${vulns.total ?? vulns.issues?.length ?? 0} |`,
    `| Open code smells | ${smells.total ?? smells.issues?.length ?? 0} |`,
    `| Security hotspots (to review) | ${hotspots.paging?.total ?? hotspots.hotspots?.length ?? 0} |`,
    '',
    '### Open issues by severity (sample up to 100 per type)',
    '',
  );

  for (const [sev, n] of Object.entries(severityCounts).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`- **${sev}:** ${n}`);
  }
  lines.push('');

  const topIssues = [...allIssues]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 30);

  if (topIssues.length > 0) {
    lines.push('## Top open issues', '');
    for (const issue of topIssues) {
      const file = shortComponent(issue.component, projectKey);
      const loc = issue.line != null ? `:${issue.line}` : '';
      lines.push(
        `- **[${issue.severity}] ${issue.type}** \`${file}${loc}\` — ${issue.message}`,
      );
      if (issue.rule) lines.push(`  - rule: \`${issue.rule}\``);
    }
    lines.push('');
  }

  const hs = hotspots.hotspots ?? [];
  if (hs.length > 0) {
    lines.push('## Security hotspots (to review)', '');
    for (const h of hs.slice(0, 20)) {
      const file = shortComponent(h.component, projectKey);
      const loc = h.line != null ? `:${h.line}` : '';
      lines.push(`- \`${file}${loc}\` — ${h.message ?? '(no message)'}`);
    }
    lines.push('');
  }

  lines.push(
    '---',
    '_Fetched via `scripts/sonar-fetch-report.ts`. CI artifact: `gh run download <run-id> -n sonar-report`_',
  );

  return lines.join('\n');
}

function severityRank(severity: string | undefined): number {
  switch (severity) {
    case 'BLOCKER':
      return 0;
    case 'CRITICAL':
      return 1;
    case 'MAJOR':
      return 2;
    case 'HIGH':
      return 2;
    case 'MINOR':
      return 3;
    case 'MEDIUM':
      return 3;
    case 'LOW':
      return 4;
    case 'INFO':
      return 5;
    default:
      return 6;
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  const { outPath, scope, json } = parseArgs(process.argv.slice(2));
  const props = readSonarProps(PROPS_PATH);

  if (json) {
    const params: Record<string, string> = { projectKey: props.projectKey };
    if (props.organization) params.organization = props.organization;
    applyScope(params, scope);
    const qg = await sonarGet<QualityGateStatus>('/api/qualitygates/project_status', params);
    const text = JSON.stringify({ props, scope, qualityGate: qg }, null, 2);
    if (outPath) writeFileSync(outPath, text, 'utf8');
    else process.stdout.write(`${text}\n`);
    return;
  }

  const report = await buildReport(props, scope);
  if (outPath) {
    writeFileSync(outPath, report, 'utf8');
    process.stdout.write(`Wrote ${outPath}\n`);
  } else {
    process.stdout.write(`${report}\n`);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[sonar:report] ${msg}`);
  process.exit(1);
});
