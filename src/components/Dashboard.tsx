import { useState, useMemo } from 'react';
import type { AnalysisResult } from '../analysis/types';
import { HeaderBar } from './HeaderBar';
import { TechnicalMetrics } from './TechnicalMetrics';
import { InterpretationPanel } from './InterpretationPanel';
import { ExportButton } from './ExportButton';
import { FooterNote } from './FooterNote';
import { getAnalysisHistory, clearAnalysisHistory } from './ComparisonView';

type DashboardState =
  | { status: 'idle' }
  | { status: 'running'; progress: number; currentStep: string }
  | { status: 'error'; message: string }
  | { status: 'done'; result: AnalysisResult };

type ViewMode = 'analysis' | 'compare';

interface DashboardProps {
  state: DashboardState;
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  fetchCount: number;
  onFetchCountChange: (count: number) => void;
}

// =============================================================================
// COMPARISON VIEW COMPONENTS (inlined for consistency)
// =============================================================================

interface AnalysisEntry {
  url: string;
  timestamp: string;
  result: AnalysisResult;
}

type MetricValue = string | number;

interface MetricDefinition {
  key: string;
  label: string;
  group: 'structure' | 'semantics' | 'quality';
  getValue: (entry: AnalysisEntry) => MetricValue;
  render?: (value: MetricValue, allValues: MetricValue[]) => React.ReactNode;
}

const tokens = {
  label3: {
    text: 'text-white',
    border: 'border-transparent',
    bg: 'bg-indigo-600',
  },
} as const;

function SignalBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${tokens.label3.text} ${tokens.label3.bg}`}>
      {children}
    </span>
  );
}

function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1 w-12 rounded-full bg-slate-100">
        <div className="h-1 rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm tabular-nums text-slate-700">{value}%</span>
    </div>
  );
}

function RatioIndicator({ value, allValues }: { value: number; allValues: number[] }) {
  const percent = value * 100;
  let qualifier: string;
  if (percent <= 40) qualifier = 'Low';
  else if (percent <= 70) qualifier = 'Med';
  else qualifier = 'High';

  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const isDeviation = allValues.length > 1 && value === maxVal && value !== minVal;

  return (
    <span className="text-sm">
      <span className="text-slate-700">{qualifier}</span>{' '}
      <span className={`text-xs tabular-nums ${isDeviation ? 'text-indigo-600' : 'text-slate-400'}`}>
        ({percent.toFixed(0)}%)
      </span>
    </span>
  );
}

function H1Display({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-sm text-slate-500">0 <span className="text-slate-400">(missing)</span></span>;
  }
  if (count === 1) {
    return <span className="text-sm tabular-nums text-slate-700">1</span>;
  }
  return <span className="text-sm tabular-nums text-slate-700">{count} <span className="text-slate-400">(multiple)</span></span>;
}

function SignalLabel({ struct, sem }: { struct: string; sem: string }) {
  const structLabel = struct === 'deterministic' ? 'Static' : struct === 'mostly-deterministic' ? 'Partial' : 'Unstable';
  const semLabel = sem === 'explicit' ? 'Rich' : sem === 'partial' ? 'Partial' : 'Opaque';

  const isBad = struct === 'unstable' || sem === 'opaque';
  const isGood = struct === 'deterministic' && sem === 'explicit';

  if (isBad) {
    return <SignalBadge>{structLabel} / {semLabel}</SignalBadge>;
  }

  if (isGood) {
    return <span className="text-sm text-slate-400">{structLabel} / {semLabel}</span>;
  }

  return <span className="text-sm text-slate-600">{structLabel} / {semLabel}</span>;
}

function IssueDisplay({ count, allCounts }: { count: number; allCounts: number[] }) {
  const minCount = Math.min(...allCounts);
  const maxCount = Math.max(...allCounts);
  const isWorst = count === maxCount && count > minCount;

  if (count === 0) {
    return <span className="text-sm tabular-nums text-slate-400">0</span>;
  }

  if (isWorst) {
    return <span className="text-sm tabular-nums font-medium text-slate-900">{count}</span>;
  }

  return <span className="text-sm tabular-nums text-slate-700">{count}</span>;
}

function areValuesIdentical(values: MetricValue[]): boolean {
  if (values.length <= 1) return true;
  const first = String(values[0]);
  return values.every(v => String(v) === first);
}

const CORE_METRICS: MetricDefinition[] = [
  {
    key: 'domNodes',
    label: 'DOM Nodes',
    group: 'structure',
    getValue: (e) => e.result.structure.domNodes,
    render: (v, allValues) => {
      const num = Number(v);
      const max = Math.max(...allValues.map(Number));
      const min = Math.min(...allValues.map(Number));
      const isDeviation = allValues.length > 1 && num === max && num !== min;
      return (
        <span className={`text-sm tabular-nums ${isDeviation ? 'text-indigo-600' : 'text-slate-700'}`}>
          {num.toLocaleString()}
        </span>
      );
    },
  },
  {
    key: 'maxDepth',
    label: 'Max DOM Depth',
    group: 'structure',
    getValue: (e) => e.result.structure.maxDepth,
    render: (v, allValues) => {
      const num = Number(v);
      const max = Math.max(...allValues.map(Number));
      const min = Math.min(...allValues.map(Number));
      const isDeviation = allValues.length > 1 && num === max && num !== min;
      return (
        <span className={`text-sm tabular-nums ${isDeviation ? 'text-indigo-600' : 'text-slate-700'}`}>
          {num}
        </span>
      );
    },
  },
  {
    key: 'topLevelSections',
    label: 'Top-level Sections',
    group: 'structure',
    getValue: (e) => e.result.structure.topLevelSections,
    render: (v) => <span className="text-sm tabular-nums text-slate-700">{v}</span>,
  },
  {
    key: 'h1Count',
    label: 'H1 Count',
    group: 'semantics',
    getValue: (e) => e.result.semantics.headings.h1Count,
    render: (v) => <H1Display count={Number(v)} />,
  },
  {
    key: 'landmarkCoverage',
    label: 'Landmark Coverage',
    group: 'semantics',
    getValue: (e) => e.result.semantics.landmarks.coveragePercent,
    render: (v) => <ProgressBar value={Number(v)} />,
  },
  {
    key: 'divRatio',
    label: 'Div/Span Ratio',
    group: 'semantics',
    getValue: (e) => e.result.semantics.divRatio,
    render: (v, allValues) => <RatioIndicator value={Number(v)} allValues={allValues.map(Number)} />,
  },
  {
    key: 'linkIssues',
    label: 'Link Issues',
    group: 'quality',
    getValue: (e) => e.result.semantics.linkIssues,
    render: (v, allValues) => <IssueDisplay count={Number(v)} allCounts={allValues.map(Number)} />,
  },
  {
    key: 'imagesTotal',
    label: 'Images',
    group: 'quality',
    getValue: (e) => e.result.semantics.images?.total ?? 0,
    render: (v) => <span className="text-sm tabular-nums text-slate-700">{v}</span>,
  },
  {
    key: 'imagesMissingAlt',
    label: 'Images Missing Alt',
    group: 'quality',
    getValue: (e) => e.result.semantics.images?.missingAlt ?? 0,
    render: (v, allValues) => <IssueDisplay count={Number(v)} allCounts={allValues.map(Number)} />,
  },
];

function MetricGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className="bg-slate-50 px-4 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</span>
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}

function MetricRow({ label, values, isIdentical, showIdentical }: { label: string; values: React.ReactNode[]; isIdentical: boolean; showIdentical: boolean }) {
  if (isIdentical && !showIdentical) return null;

  return (
    <div
      className={`grid items-center border-b border-slate-50 py-2.5 ${isIdentical ? 'opacity-40' : ''}`}
      style={{ gridTemplateColumns: `160px repeat(${values.length}, 1fr)` }}
    >
      <div className="sticky left-0 bg-white px-4 text-sm text-slate-500">{label}</div>
      {values.map((value, i) => (
        <div key={i} className="px-4">{value}</div>
      ))}
    </div>
  );
}

function CompareUrlHeader({ entries }: { entries: AnalysisEntry[] }) {
  return (
    <div
      className="sticky top-0 z-10 grid border-b border-slate-200 bg-slate-50"
      style={{ gridTemplateColumns: `160px repeat(${entries.length}, 1fr)` }}
    >
      <div className="sticky left-0 bg-slate-50 px-4 py-3" />
      {entries.map((entry, i) => (
        <div key={i} className="px-4 py-3">
          <div className="truncate text-sm font-medium text-slate-700" title={entry.url}>
            {new URL(entry.url).hostname.replace('www.', '')}
          </div>
          <div className="text-xs text-slate-400">
            {new Date(entry.timestamp).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareSignalRow({ entries }: { entries: AnalysisEntry[] }) {
  return (
    <div
      className="grid items-center border-b border-slate-200 bg-white py-4"
      style={{ gridTemplateColumns: `160px repeat(${entries.length}, 1fr)` }}
    >
      <div className="sticky left-0 bg-white px-4 text-sm font-medium text-slate-700">Result</div>
      {entries.map((entry, i) => (
        <div key={i} className="px-4">
          <SignalLabel struct={entry.result.structure.classification} sem={entry.result.semantics.classification} />
        </div>
      ))}
    </div>
  );
}

function generateComparisonCSV(entries: AnalysisEntry[]): string {
  const headers = ['Metric', ...entries.map((_, i) => `Analysis ${i + 1}`)];
  const rows = [
    headers,
    ['URL', ...entries.map(e => new URL(e.url).hostname)],
    ['Timestamp', ...entries.map(e => new Date(e.timestamp).toISOString())],
    ['', ...entries.map(() => '')],
    ['STRUCTURE', ...entries.map(() => '')],
    ['DOM Nodes', ...entries.map(e => e.result.structure.domNodes.toString())],
    ['Max DOM Depth', ...entries.map(e => e.result.structure.maxDepth.toString())],
    ['Top-level Sections', ...entries.map(e => e.result.structure.topLevelSections.toString())],
    ['', ...entries.map(() => '')],
    ['SEMANTICS', ...entries.map(() => '')],
    ['H1 Count', ...entries.map(e => e.result.semantics.headings.h1Count.toString())],
    ['Landmark Coverage %', ...entries.map(e => e.result.semantics.landmarks.coveragePercent.toString())],
    ['Div/Span Ratio', ...entries.map(e => `${(e.result.semantics.divRatio * 100).toFixed(1)}%`)],
    ['', ...entries.map(() => '')],
    ['QUALITY', ...entries.map(() => '')],
    ['Link Issues', ...entries.map(e => e.result.semantics.linkIssues.toString())],
  ];
  return rows.map(row => row.map(cell => `"${cell}"`).join(';')).join('\n');
}

function generateComparisonJSON(entries: AnalysisEntry[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    analyses: entries.map(e => ({
      url: e.url,
      timestamp: e.timestamp,
      structure: {
        classification: e.result.structure.classification,
        domNodes: e.result.structure.domNodes,
        maxDepth: e.result.structure.maxDepth,
        topLevelSections: e.result.structure.topLevelSections,
      },
      semantics: {
        classification: e.result.semantics.classification,
        h1Count: e.result.semantics.headings.h1Count,
        landmarkCoverage: e.result.semantics.landmarks.coveragePercent,
        divRatio: e.result.semantics.divRatio,
        linkIssues: e.result.semantics.linkIssues,
      },
    })),
  }, null, 2);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ComparisonContent({ entries, onBack }: { entries: AnalysisEntry[]; onBack: () => void }) {
  const [showIdentical, setShowIdentical] = useState(false);
  const allEntries = getAnalysisHistory();
  const displayEntries = entries.slice(0, 4);

  const metricData = useMemo(() => {
    return CORE_METRICS.map((metric) => {
      const rawValues = displayEntries.map((e) => metric.getValue(e));
      const isIdentical = areValuesIdentical(rawValues);
      const renderedValues = rawValues.map((raw) => {
        return metric.render ? metric.render(raw, rawValues) : <span className="text-sm">{raw}</span>;
      });
      return { ...metric, rawValues, renderedValues, isIdentical };
    });
  }, [displayEntries]);

  const identicalCount = metricData.filter((m) => m.isIdentical).length;
  const differentCount = CORE_METRICS.length - identicalCount;

  const structureMetrics = metricData.filter((m) => m.group === 'structure');
  const semanticsMetrics = metricData.filter((m) => m.group === 'semantics');
  const qualityMetrics = metricData.filter((m) => m.group === 'quality');

  const handleClearHistory = () => {
    if (window.confirm('Clear all analysis history?')) {
      clearAnalysisHistory();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header row - same style as Analysis Results */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Comparing {displayEntries.length} URLs
          {allEntries.length > 4 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({allEntries.length - 4} more in history)
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearHistory}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          >
            Clear History
          </button>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/60">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <CompareUrlHeader entries={displayEntries} />
            <CompareSignalRow entries={displayEntries} />

            <MetricGroup title="Structure">
              {structureMetrics.map((m) => (
                <MetricRow key={m.key} label={m.label} values={m.renderedValues} isIdentical={m.isIdentical} showIdentical={showIdentical} />
              ))}
            </MetricGroup>

            <MetricGroup title="Semantics">
              {semanticsMetrics.map((m) => (
                <MetricRow key={m.key} label={m.label} values={m.renderedValues} isIdentical={m.isIdentical} showIdentical={showIdentical} />
              ))}
            </MetricGroup>

            <MetricGroup title="Quality">
              {qualityMetrics.map((m) => (
                <MetricRow key={m.key} label={m.label} values={m.renderedValues} isIdentical={m.isIdentical} showIdentical={showIdentical} />
              ))}
            </MetricGroup>
          </div>
        </div>

        {/* Difference filter - inside the card */}
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {differentCount} difference{differentCount !== 1 ? 's' : ''}
            </span>
            {identicalCount > 0 && (
              <button
                onClick={() => setShowIdentical(!showIdentical)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  showIdentical ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'
                }`}
              >
                {showIdentical ? 'Hide' : 'Show'} {identicalCount} identical
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Export Section - same position as Analysis view */}
      <div className="flex justify-end">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Export:</span>
          <button
            onClick={() => {
              const content = generateComparisonJSON(displayEntries);
              const timestamp = new Date().toISOString().split('T')[0];
              downloadFile(content, `docsignals-comparison-${timestamp}.json`, 'application/json');
            }}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            JSON
          </button>
          <button
            onClick={() => {
              const content = generateComparisonCSV(displayEntries);
              const timestamp = new Date().toISOString().split('T')[0];
              downloadFile(content, `docsignals-comparison-${timestamp}.csv`, 'text/csv');
            }}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            CSV
          </button>
        </div>
      </div>

      <FooterNote />
    </div>
  );
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export function Dashboard({ state, url, onUrlChange, onSubmit, fetchCount, onFetchCountChange }: DashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('analysis');
  const analysisHistory = getAnalysisHistory();
  const hasHistory = analysisHistory.length >= 2;

  // Auto-switch to analysis view when a new analysis completes
  const handleCompare = () => setViewMode('compare');
  const handleBack = () => setViewMode('analysis');

  return (
    <div className="min-h-screen bg-white">
      <HeaderBar
        url={url}
        onUrlChange={onUrlChange}
        onSubmit={onSubmit}
        isRunning={state.status === 'running'}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {state.status === 'error' && (
          <div className="mb-8 rounded-xl bg-red-50/80 px-5 py-4 ring-1 ring-red-200/60">
            <p className="text-sm text-red-700">{state.message}</p>
          </div>
        )}

        {state.status === 'running' && (
          <div className="rounded-xl bg-white px-6 py-8 shadow-sm ring-1 ring-gray-200/60">
            <div className="mx-auto max-w-md">
              <p className="mb-3 text-center text-sm font-medium text-gray-700">
                {state.currentStep}
              </p>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-center text-xs text-gray-500">
                {Math.round(state.progress)}%
              </p>
            </div>
          </div>
        )}

        {state.status === 'idle' && (
          <div className="py-20 text-center">
            <p className="text-sm text-gray-400">
              Enter a URL above to analyze its structural signals.
            </p>
          </div>
        )}

        {state.status === 'done' && viewMode === 'analysis' && (
          <div className="space-y-8 sm:space-y-10">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Analysis Results</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="fetch-count" className="text-sm text-gray-600">Fetches:</label>
                  <select
                    id="fetch-count"
                    value={fetchCount}
                    onChange={(e) => onFetchCountChange(Number(e.target.value))}
                    className="rounded-lg bg-white px-2 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                  </select>
                </div>
                {hasHistory && (
                  <button
                    onClick={handleCompare}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    Compare
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <section>
              <TechnicalMetrics
                structure={state.result.structure}
                semantics={state.result.semantics}
                fetchCount={fetchCount}
              />
            </section>

            <section>
              <InterpretationPanel
                structure={state.result.structure}
                semantics={state.result.semantics}
                fetchCount={fetchCount}
              />
            </section>

            <div className="flex justify-end">
              <ExportButton result={state.result} url={url} />
            </div>

            <FooterNote />
          </div>
        )}

        {state.status === 'done' && viewMode === 'compare' && (
          <ComparisonContent entries={analysisHistory} onBack={handleBack} />
        )}
      </main>
    </div>
  );
}
