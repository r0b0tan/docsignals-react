import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { AnalysisResult } from '../analysis/types';
import { getAnalysisHistory, clearAnalysisHistory } from './ComparisonView';

// =============================================================================
// TYPES
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

// =============================================================================
// DESIGN TOKENS - Slate for structure, Indigo for signals only
// =============================================================================

const tokens = {
  // Label Level 3 - Primary signal (bad states only)
  // This is the ONLY filled indigo element allowed per column
  label3: {
    text: 'text-white',
    border: 'border-transparent',
    bg: 'bg-indigo-600',
  },
} as const;

// =============================================================================
// LABEL COMPONENT - Only used for bad state signals
// =============================================================================

interface LabelProps {
  children: React.ReactNode;
}

function SignalBadge({ children }: LabelProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${tokens.label3.text} ${tokens.label3.bg}`}
    >
      {children}
    </span>
  );
}

// =============================================================================
// VISUAL ENCODING COMPONENTS
// =============================================================================

/**
 * Progress bar - secondary to text, supports scanning.
 * Track: slate-200, Fill: indigo-500
 */
function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1 w-12 rounded-full bg-slate-100">
        <div
          className="h-1 rounded-full bg-indigo-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-slate-700">{value}%</span>
    </div>
  );
}

/**
 * Div/Span Ratio - "High (94%)" format.
 * Qualifier in slate, percentage in indigo for deviating values.
 */
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
      <span className="text-slate-700">{qualifier}</span>
      {' '}
      <span className={`text-xs tabular-nums ${isDeviation ? 'text-indigo-600' : 'text-slate-400'}`}>
        ({percent.toFixed(0)}%)
      </span>
    </span>
  );
}

/**
 * H1 Count - baseline values in slate-700, annotations muted.
 */
function H1Display({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-sm text-slate-500">0 <span className="text-slate-400">(missing)</span></span>;
  }
  if (count === 1) {
    return <span className="text-sm tabular-nums text-slate-700">1</span>;
  }
  return <span className="text-sm tabular-nums text-slate-700">{count} <span className="text-slate-400">(multiple)</span></span>;
}

/**
 * Result Status - the ONLY indigo-600 filled element per column.
 * Bad states: SignalBadge (indigo-600)
 * Good/Mixed: plain slate text
 */
function SignalLabel({ struct, sem }: { struct: string; sem: string }) {
  const structLabel = struct === 'deterministic' ? 'Static' : struct === 'mostly-deterministic' ? 'Partial' : 'Unstable';
  const semLabel = sem === 'explicit' ? 'Rich' : sem === 'partial' ? 'Partial' : 'Opaque';

  const isBad = struct === 'unstable' || sem === 'opaque';
  const isGood = struct === 'deterministic' && sem === 'explicit';

  // Bad state: filled indigo badge - primary attention
  if (isBad) {
    return (
      <SignalBadge>
        {structLabel} / {semLabel}
      </SignalBadge>
    );
  }

  // Good state: muted, recedes
  if (isGood) {
    return (
      <span className="text-sm text-slate-400">
        {structLabel} / {semLabel}
      </span>
    );
  }

  // Mixed state: neutral
  return (
    <span className="text-sm text-slate-600">
      {structLabel} / {semLabel}
    </span>
  );
}

/**
 * Link Issues - typography-based emphasis, no color accents.
 * Lowest: slate-700, Higher: slate-900 + font-medium
 */
function IssueDisplay({ count, allCounts }: { count: number; allCounts: number[] }) {
  const minCount = Math.min(...allCounts);
  const maxCount = Math.max(...allCounts);
  const isBaseline = count === minCount;
  const isWorst = count === maxCount && count > minCount;

  if (count === 0) {
    return <span className="text-sm tabular-nums text-slate-400">0</span>;
  }

  // Worst value: darker + medium weight
  if (isWorst) {
    return <span className="text-sm tabular-nums font-medium text-slate-900">{count}</span>;
  }

  // Baseline: standard
  if (isBaseline) {
    return <span className="text-sm tabular-nums text-slate-700">{count}</span>;
  }

  // Middle values
  return <span className="text-sm tabular-nums text-slate-700">{count}</span>;
}

// =============================================================================
// DIFFERENCE DETECTION
// =============================================================================

function areValuesIdentical(values: MetricValue[]): boolean {
  if (values.length <= 1) return true;
  const first = String(values[0]);
  return values.every(v => String(v) === first);
}

// =============================================================================
// METRIC DEFINITIONS - Core 6-8 Metrics Only
// =============================================================================

const CORE_METRICS: MetricDefinition[] = [
  // Structure (3 metrics) - slate-700 baseline
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
  // Semantics (3 metrics)
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
  // Quality (1 metric)
  {
    key: 'linkIssues',
    label: 'Link Issues',
    group: 'quality',
    getValue: (e) => e.result.semantics.linkIssues,
    render: (v, allValues) => <IssueDisplay count={Number(v)} allCounts={allValues.map(Number)} />,
  },
];

// =============================================================================
// METRIC GROUP COMPONENT
// =============================================================================

interface MetricGroupProps {
  title: string;
  children: React.ReactNode;
}

function MetricGroup({ title, children }: MetricGroupProps) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className="bg-slate-50 px-4 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}

// =============================================================================
// METRIC ROW COMPONENT
// =============================================================================

interface MetricRowProps {
  label: string;
  values: React.ReactNode[];
  isIdentical: boolean;
  showIdentical: boolean;
}

function MetricRow({ label, values, isIdentical, showIdentical }: MetricRowProps) {
  if (isIdentical && !showIdentical) return null;

  return (
    <div
      className={`grid items-center border-b border-slate-50 py-2.5 ${
        isIdentical ? 'opacity-40' : ''
      }`}
      style={{ gridTemplateColumns: `160px repeat(${values.length}, 1fr)` }}
    >
      <div className="sticky left-0 bg-white px-4 text-sm text-slate-500">{label}</div>
      {values.map((value, i) => (
        <div key={i} className="px-4">
          {value}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// DIFFERENCE FILTER COMPONENT
// =============================================================================

interface DifferenceFilterProps {
  showIdentical: boolean;
  onToggle: () => void;
  identicalCount: number;
  totalCount: number;
}

function DifferenceFilter({
  showIdentical,
  onToggle,
  identicalCount,
  totalCount,
}: DifferenceFilterProps) {
  const differentCount = totalCount - identicalCount;

  return (
    <div className="flex items-center gap-3 py-3 text-sm">
      <span className="text-slate-500">
        {differentCount} difference{differentCount !== 1 ? 's' : ''}
      </span>
      {identicalCount > 0 && (
        <button
          onClick={onToggle}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            showIdentical
              ? 'text-indigo-600'
              : 'text-slate-400 hover:text-indigo-600'
          }`}
        >
          {showIdentical ? 'Hide' : 'Show'} {identicalCount} identical
        </button>
      )}
    </div>
  );
}

// =============================================================================
// URL HEADER COMPONENT
// =============================================================================

interface UrlHeaderProps {
  entries: AnalysisEntry[];
  onRemove?: (index: number) => void;
}

function UrlHeader({ entries, onRemove }: UrlHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 grid border-b border-slate-200 bg-slate-50"
      style={{ gridTemplateColumns: `160px repeat(${entries.length}, 1fr)` }}
    >
      <div className="sticky left-0 bg-slate-50 px-4 py-3" />
      {entries.map((entry, i) => (
        <div key={i} className="flex items-start justify-between px-4 py-3">
          <div className="min-w-0">
            <div
              className="truncate text-sm font-medium text-slate-700"
              title={entry.url}
            >
              {new URL(entry.url).hostname.replace('www.', '')}
            </div>
            <div className="text-xs text-slate-400">
              {new Date(entry.timestamp).toLocaleDateString()}
            </div>
          </div>
          {onRemove && entries.length > 2 && (
            <button
              onClick={() => onRemove(i)}
              className="ml-2 rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// SIGNAL ROW - Result Status (special case)
// =============================================================================

interface SignalRowProps {
  entries: AnalysisEntry[];
}

function SignalRow({ entries }: SignalRowProps) {
  return (
    <div
      className="grid items-center border-b border-slate-200 bg-white py-4"
      style={{ gridTemplateColumns: `160px repeat(${entries.length}, 1fr)` }}
    >
      <div className="sticky left-0 bg-white px-4 text-sm font-medium text-slate-700">
        Result
      </div>
      {entries.map((entry, i) => (
        <div key={i} className="px-4">
          <SignalLabel
            struct={entry.result.structure.classification}
            sem={entry.result.semantics.classification}
          />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// COMPARISON VIEW COMPONENT
// =============================================================================

interface ComparisonViewProps {
  entries: AnalysisEntry[];
}

function ComparisonViewContent({ entries }: ComparisonViewProps) {
  const [showIdentical, setShowIdentical] = useState(false);

  // Compute metric values and identical status
  const metricData = useMemo(() => {
    return CORE_METRICS.map((metric) => {
      const rawValues = entries.map((e) => metric.getValue(e));
      const isIdentical = areValuesIdentical(rawValues);
      const renderedValues = rawValues.map((raw) => {
        return metric.render ? metric.render(raw, rawValues) : <span className="text-sm">{raw}</span>;
      });
      return {
        ...metric,
        rawValues,
        renderedValues,
        isIdentical,
      };
    });
  }, [entries]);

  const identicalCount = metricData.filter((m) => m.isIdentical).length;

  // Group metrics
  const structureMetrics = metricData.filter((m) => m.group === 'structure');
  const semanticsMetrics = metricData.filter((m) => m.group === 'semantics');
  const qualityMetrics = metricData.filter((m) => m.group === 'quality');

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Sticky URL Header */}
        <UrlHeader entries={entries} />

        {/* Result Signal Row */}
        <SignalRow entries={entries} />

        {/* Structure Group */}
        <MetricGroup title="Structure">
          {structureMetrics.map((m) => (
            <MetricRow
              key={m.key}
              label={m.label}
              values={m.renderedValues}
              isIdentical={m.isIdentical}
              showIdentical={showIdentical}
            />
          ))}
        </MetricGroup>

        {/* Semantics Group */}
        <MetricGroup title="Semantics">
          {semanticsMetrics.map((m) => (
            <MetricRow
              key={m.key}
              label={m.label}
              values={m.renderedValues}
              isIdentical={m.isIdentical}
              showIdentical={showIdentical}
            />
          ))}
        </MetricGroup>

        {/* Quality Group */}
        <MetricGroup title="Quality">
          {qualityMetrics.map((m) => (
            <MetricRow
              key={m.key}
              label={m.label}
              values={m.renderedValues}
              isIdentical={m.isIdentical}
              showIdentical={showIdentical}
            />
          ))}
        </MetricGroup>
      </div>

      {/* Difference Filter */}
      <div className="mt-4 px-4">
        <DifferenceFilter
          showIdentical={showIdentical}
          onToggle={() => setShowIdentical(!showIdentical)}
          identicalCount={identicalCount}
          totalCount={CORE_METRICS.length}
        />
      </div>
    </div>
  );
}

// =============================================================================
// EXPORT UTILITIES (preserved from original)
// =============================================================================

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

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export function ComparisonPage() {
  const rawEntries = getAnalysisHistory();
  // Limit to 4 columns by default
  const entries = rawEntries.slice(0, 4);

  const handleClearHistory = () => {
    if (window.confirm('Clear all analysis history?')) {
      clearAnalysisHistory();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <Link
                to="/"
                className="text-lg font-semibold tracking-tight text-indigo-600 hover:text-indigo-700"
              >
                DocSignals
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-sm text-slate-500">Compare</span>
            </div>
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="mb-6 text-sm text-slate-400">
              No analyses saved. Run at least two analyses to compare them.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Start Analyzing
            </Link>
          </div>
        ) : entries.length === 1 ? (
          <div className="py-16 text-center">
            <p className="mb-6 text-sm text-slate-400">
              1 analysis saved. Run one more to enable comparison.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Analyze Another URL
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-700">
                Comparing {entries.length} URL{entries.length !== 1 ? 's' : ''}
                {rawEntries.length > 4 && (
                  <span className="ml-2 text-xs text-slate-400">
                    ({rawEntries.length - 4} more in history)
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearHistory}
                  className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    const content = generateComparisonJSON(entries);
                    const timestamp = new Date().toISOString().split('T')[0];
                    downloadFile(content, `docsignals-${timestamp}.json`, 'application/json');
                  }}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  JSON
                </button>
                <button
                  onClick={() => {
                    const content = generateComparisonCSV(entries);
                    const timestamp = new Date().toISOString().split('T')[0];
                    downloadFile(content, `docsignals-${timestamp}.csv`, 'text/csv');
                  }}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  CSV
                </button>
              </div>
            </div>

            {/* Comparison View */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <ComparisonViewContent entries={entries} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
