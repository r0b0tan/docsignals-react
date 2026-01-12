import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnalysisResult } from '../analysis/types';
import { HeaderBar } from './HeaderBar';
import { TechnicalMetrics } from './TechnicalMetrics';
import { InterpretationPanel } from './InterpretationPanel';
import { ExportButton } from './ExportButton';
import { FooterNote } from './FooterNote';
import { getAnalysisHistory, clearAnalysisHistory } from './ComparisonView';
import { Tooltip } from './Tooltip';
import { ConfirmModal } from './ConfirmModal';

// =============================================================================
// RELATIVE TIME FORMATTING
// =============================================================================

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getFullTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function TimestampPill({ timestamp }: { timestamp: string }) {
  return (
    <Tooltip text={getFullTimestamp(timestamp)}>
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 cursor-default">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {getRelativeTime(timestamp)}
      </span>
    </Tooltip>
  );
}

type DashboardState =
  | { status: 'idle' }
  | { status: 'running'; progress: number; currentStep: string }
  | { status: 'error'; message: string }
  | { status: 'done'; result: AnalysisResult; analyzedUrl?: string; analyzedAt?: string };

type ViewMode = 'analysis' | 'compare';

interface DashboardProps {
  state: DashboardState;
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  fetchCount: number;
  onFetchCountChange: (count: number) => void;
  onLoadFromHistory?: (index: number) => void;
  fetchWarnings?: string[];
  onDismissWarnings?: () => void;
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
  const semLabel = sem === 'explicit' ? 'Explicit' : sem === 'partial' ? 'Partial' : 'Opaque';

  const structTooltip = struct === 'deterministic' 
    ? 'Structure: DOM is identical across requests' 
    : struct === 'mostly-deterministic' 
    ? 'Structure: Minor variations between requests'
    : 'Structure: Changes significantly between requests';
  
  const semTooltip = sem === 'explicit'
    ? 'Semantics: Meaning is encoded in HTML elements'
    : sem === 'partial'
    ? 'Semantics: Some semantic structure, with gaps'
    : 'Semantics: Meaning relies on visual presentation';

  const tooltipText = `${structTooltip}\n${semTooltip}`;

  const isBad = struct === 'unstable' || sem === 'opaque';
  const isGood = struct === 'deterministic' && sem === 'explicit';

  const infoIcon = (
    <Tooltip text={tooltipText}>
      <span className="text-indigo-600 ml-1.5 cursor-help">ⓘ</span>
    </Tooltip>
  );

  const baseClasses = 'text-xs font-medium rounded px-1.5 py-0.5 border';

  if (isBad) {
    return (
      <span className="inline-flex items-center">
        <span className={`${baseClasses} text-indigo-600 border-indigo-300 bg-white`}>{semLabel}</span>
        {infoIcon}
      </span>
    );
  }

  if (isGood) {
    return (
      <span className="inline-flex items-center">
        <span className={`${baseClasses} text-slate-400 border-slate-200 bg-white`}>{semLabel}</span>
        {infoIcon}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center">
      <span className={`${baseClasses} text-slate-600 border-slate-300 bg-white`}>{semLabel}</span>
      {infoIcon}
    </span>
  );
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
  if (values.length <= 1) return false; // Show single entries, only compare when 2+
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
  const navigate = useNavigate();
  const [showIdentical, setShowIdentical] = useState(true);
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

  const [showClearModal, setShowClearModal] = useState(false);

  const handleClearHistory = () => {
    setShowClearModal(true);
  };

  const confirmClearHistory = () => {
    clearAnalysisHistory();
    window.location.reload();
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header row - same style as Analysis Results */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="text-lg font-semibold text-gray-900 py-1">
            Comparing {displayEntries.length} URLs
          </h2>
          <div className="flex items-center gap-2 py-2">
            <span className="hidden text-gray-300 sm:inline">|</span>
            <span className="text-sm text-gray-500">
              {differentCount} difference{differentCount !== 1 ? 's' : ''}
            </span>
            {identicalCount > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <button
                  onClick={() => setShowIdentical(!showIdentical)}
                  className={`text-sm transition-colors ${
                    showIdentical ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'
                  }`}
                >
                  {showIdentical ? 'Hide' : 'Show'} {identicalCount} identical
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Clear History */}
          <button
            onClick={handleClearHistory}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Clear</span>
          </button>
          {/* Back */}
          <button
            onClick={onBack}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-separate border-spacing-0">
            {/* URL Header */}
            <thead>
              <tr className="bg-slate-50">
                <th className="w-40 sticky left-0 bg-slate-50 z-10 px-4 py-3 border-b border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" />
                {displayEntries.map((entry, i) => (
                  <th key={i} className="min-w-[180px] px-4 py-3 text-left font-normal border-b border-slate-200">
                    <div className="truncate text-sm font-medium text-slate-700" title={entry.url}>
                      {new URL(entry.url).hostname.replace('www.', '')}
                    </div>
                    <div className="mt-1">
                      <TimestampPill timestamp={entry.timestamp} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Signal row */}
              <tr className="bg-white">
                <td className="sticky left-0 bg-white z-10 px-4 py-3 border-b border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <span className="text-sm font-medium text-slate-700">Result</span>
                </td>
                {displayEntries.map((entry, i) => (
                  <td key={i} className="px-4 py-3 border-b border-slate-200">
                    <SignalLabel struct={entry.result.structure.classification} sem={entry.result.semantics.classification} />
                  </td>
                ))}
              </tr>
              {/* Structure group header */}
              <tr className="bg-slate-50">
                <td className="sticky left-0 bg-slate-50 z-10 px-4 py-1.5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Structure</span>
                </td>
                {displayEntries.map((_, i) => (
                  <td key={i} className="px-4 py-1.5" />
                ))}
              </tr>
              {/* Structure metrics */}
              {structureMetrics.map((m) => (
                (!m.isIdentical || showIdentical) && (
                  <tr key={m.key} className={`${m.isIdentical ? 'opacity-40' : ''}`}>
                    <td className="sticky left-0 bg-white z-10 px-4 py-2.5 border-b border-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <span className="text-sm text-slate-500">{m.label}</span>
                    </td>
                    {m.renderedValues.map((value, i) => (
                      <td key={i} className="px-4 py-2.5 border-b border-slate-50">{value}</td>
                    ))}
                  </tr>
                )
              ))}
              {/* Semantics group header */}
              <tr className="bg-slate-50">
                <td className="sticky left-0 bg-slate-50 z-10 px-4 py-1.5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Semantics</span>
                </td>
                {displayEntries.map((_, i) => (
                  <td key={i} className="px-4 py-1.5" />
                ))}
              </tr>
              {/* Semantics metrics */}
              {semanticsMetrics.map((m) => (
                (!m.isIdentical || showIdentical) && (
                  <tr key={m.key} className={`${m.isIdentical ? 'opacity-40' : ''}`}>
                    <td className="sticky left-0 bg-white z-10 px-4 py-2.5 border-b border-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <span className="text-sm text-slate-500">{m.label}</span>
                    </td>
                    {m.renderedValues.map((value, i) => (
                      <td key={i} className="px-4 py-2.5 border-b border-slate-50">{value}</td>
                    ))}
                  </tr>
                )
              ))}
              {/* Quality group header */}
              <tr className="bg-slate-50">
                <td className="sticky left-0 bg-slate-50 z-10 px-4 py-1.5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Quality</span>
                </td>
                {displayEntries.map((_, i) => (
                  <td key={i} className="px-4 py-1.5" />
                ))}
              </tr>
              {/* Quality metrics */}
              {qualityMetrics.map((m) => (
                (!m.isIdentical || showIdentical) && (
                  <tr key={m.key} className={`${m.isIdentical ? 'opacity-40' : ''}`}>
                    <td className="sticky left-0 bg-white z-10 px-4 py-2.5 border-b border-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <span className="text-sm text-slate-500">{m.label}</span>
                    </td>
                    {m.renderedValues.map((value, i) => (
                      <td key={i} className="px-4 py-2.5 border-b border-slate-50">{value}</td>
                    ))}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Export Section - same position as Analysis view */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => navigate('/help')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-indigo-600 ring-1 ring-indigo-600 hover:bg-indigo-50"
        >
          Help
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
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

      <ConfirmModal
        isOpen={showClearModal}
        title="Clear History"
        message="Are you sure you want to clear all analysis history? This action cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onConfirm={confirmClearHistory}
        onCancel={() => setShowClearModal(false)}
      />
    </div>
  );
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export function Dashboard({
  state,
  url,
  onUrlChange,
  onSubmit,
  fetchCount,
  onFetchCountChange,
  onLoadFromHistory,
  fetchWarnings = [],
  onDismissWarnings,
}: DashboardProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('analysis');
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showFetchDropdown, setShowFetchDropdown] = useState(false);
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
        <div className="space-y-8 sm:space-y-10">
          {/* Fetch warnings banner */}
          {fetchWarnings.length > 0 && (
            <div className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-200/60">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-indigo-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-indigo-800">
                    Not all samples could be fetched
                  </p>
                  <ul className="mt-2 space-y-1">
                    {fetchWarnings.filter(w => !w.startsWith('Hint:')).map((warning, idx) => (
                      <li key={idx} className="text-xs text-indigo-700">
                        {warning}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-indigo-600">
                    {(() => {
                      const warningsLower = fetchWarnings.join(' ').toLowerCase();
                      if (warningsLower.includes('timeout')) {
                        return 'Some requests timed out. The server may be slow. Consistency detection may be less accurate.';
                      }
                      if (warningsLower.includes('cors') || warningsLower.includes('unable to connect')) {
                        return 'Some requests were blocked or failed to connect. Structural consistency detection may be less accurate with fewer samples.';
                      }
                      if (warningsLower.includes('rate') || warningsLower.includes('429')) {
                        return 'Rate limited by the server. Fewer samples were collected. Try again later for more accurate consistency detection.';
                      }
                      return 'Analysis continued with fewer samples. Results may be less accurate for consistency detection.';
                    })()}
                  </p>
                </div>
                {onDismissWarnings && (
                  <button
                    onClick={onDismissWarnings}
                    className="text-indigo-400 hover:text-indigo-600 transition-colors"
                    aria-label="Dismiss warnings"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {state.status === 'error' && (
            <div className="mb-8 rounded-xl bg-indigo-50/80 px-5 py-4 ring-1 ring-indigo-200/60">
              <p className="text-sm font-medium text-indigo-800 mb-2">Analysis Failed</p>
              <p className="text-sm text-indigo-700 whitespace-pre-line">{state.message}</p>
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
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
                <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 py-1">
                    Analysis Results
                  </h2>
                  <div className="flex items-center gap-2 py-2">
                    {state.analyzedUrl && (
                      <>
                        <span className="hidden text-gray-300 sm:inline">|</span>
                        <span className="text-sm text-gray-500">
                          {(() => {
                            try {
                              return new URL(state.analyzedUrl).hostname;
                            } catch {
                              return state.analyzedUrl;
                            }
                          })()}
                        </span>
                      </>
                    )}
                    {state.analyzedAt && (
                      <>
                        <span className="text-gray-300">•</span>
                        <TimestampPill timestamp={state.analyzedAt} />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Fetches Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowFetchDropdown(!showFetchDropdown)}
                      onBlur={() => setTimeout(() => setShowFetchDropdown(false), 200)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                      title={`${fetchCount} ${fetchCount === 1 ? 'Fetch' : 'Fetches'}`}
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{fetchCount}<span className="hidden sm:inline"> {fetchCount === 1 ? 'Fetch' : 'Fetches'}</span></span>
                      <svg className={`h-4 w-4 text-gray-400 transition-transform ${showFetchDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showFetchDropdown && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 sm:left-auto sm:right-0">
                        <p className="px-3 py-1.5 text-xs font-medium text-gray-400">Sample count</p>
                        {[1, 2, 3, 5].map((count) => (
                          <button
                            key={count}
                            onClick={() => {
                              onFetchCountChange(count);
                              setShowFetchDropdown(false);
                            }}
                            className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${fetchCount === count ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-700'}`}
                          >
                            {count} {count === 1 ? 'Fetch' : 'Fetches'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* History Dropdown */}
                  {analysisHistory.length > 0 && onLoadFromHistory && (
                    <div className="relative">
                      <button
                        onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                        onBlur={() => setTimeout(() => setShowHistoryDropdown(false), 200)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                        title="History"
                      >
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>History</span>
                        <svg className={`h-4 w-4 text-gray-400 transition-transform ${showHistoryDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showHistoryDropdown && (
                        <div className="absolute left-1/2 top-full z-20 mt-1 w-72 max-h-64 -translate-x-1/2 overflow-y-auto overflow-x-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 sm:left-auto sm:right-0 sm:translate-x-0">
                          <p className="px-3 py-1.5 text-xs font-medium text-gray-400">Recent analyses</p>
                          {analysisHistory.map((entry, index) => {
                            const hostname = (() => {
                              try {
                                return new URL(entry.url).hostname;
                              } catch {
                                return entry.url;
                              }
                            })();
                            const isActive = state.analyzedUrl === entry.url && state.analyzedAt === entry.timestamp;
                            return (
                              <button
                                key={`${entry.url}-${entry.timestamp}`}
                                onClick={() => {
                                  onLoadFromHistory(index);
                                  setShowHistoryDropdown(false);
                                }}
                                className={`block w-full px-3 py-2 text-left hover:bg-gray-50 ${isActive ? 'bg-indigo-50' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <span className={`block text-sm truncate ${isActive ? 'font-medium text-indigo-700' : 'text-gray-700'}`}>
                                      {hostname}
                                    </span>
                                    <p className="mt-0.5 text-xs text-gray-400 truncate">{entry.url}</p>
                                  </div>
                                  <Tooltip text={getFullTimestamp(entry.timestamp)}>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 flex-shrink-0 cursor-default">
                                      {getRelativeTime(entry.timestamp)}
                                    </span>
                                  </Tooltip>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleCompare}
                    disabled={!hasHistory}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${
                      hasHistory
                        ? 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'
                        : 'bg-gray-50 text-gray-400 ring-gray-200 cursor-not-allowed'
                    }`}
                    title={hasHistory ? 'Compare analyses' : 'Run at least 2 analyses to compare'}
                  >
                    <svg className={`h-4 w-4 ${hasHistory ? 'text-gray-400' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <span>Compare</span>
                    <svg className={`h-4 w-4 ${hasHistory ? 'text-gray-400' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
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

              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => navigate('/help')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-indigo-600 ring-1 ring-indigo-600 hover:bg-indigo-50"
                >
                  Help
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <ExportButton result={state.result} url={url} />
              </div>

              <FooterNote />
            </div>
          )}

          {state.status === 'done' && viewMode === 'compare' && (
            <ComparisonContent entries={analysisHistory} onBack={handleBack} />
          )}
        </div>
      </main>
    </div>
  );
}
