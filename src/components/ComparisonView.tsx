import type { AnalysisResult } from '../analysis/types';

interface AnalysisEntry {
  url: string;
  timestamp: string;
  result: AnalysisResult;
}

interface ComparisonViewProps {
  entries: AnalysisEntry[];
  onClose: () => void;
}

function generateComparisonCSV(entries: AnalysisEntry[]): string {
  const headers = ['Metric', ...entries.map((_, i) => `Analysis ${i + 1}`)];

  const rows = [
    headers,
    ['URL', ...entries.map(e => new URL(e.url).hostname)],
    ['Timestamp', ...entries.map(e => new Date(e.timestamp).toISOString())],
    ['', ...entries.map(() => '')],
    ['STRUCTURE', ...entries.map(() => '')],
    ['Classification', ...entries.map(e => e.result.structure.classification)],
    ['Difference Count', ...entries.map(e => e.result.structure.differenceCount.toString())],
    ['DOM Nodes', ...entries.map(e => e.result.structure.domNodes.toString())],
    ['Max DOM Depth', ...entries.map(e => e.result.structure.maxDepth.toString())],
    ['Top-level Sections', ...entries.map(e => e.result.structure.topLevelSections.toString())],
    ['Shadow DOM Hosts', ...entries.map(e => e.result.structure.customElements.toString())],
    ['', ...entries.map(() => '')],
    ['SEMANTICS', ...entries.map(() => '')],
    ['Classification', ...entries.map(e => e.result.semantics.classification)],
    ['H1 Count', ...entries.map(e => e.result.semantics.headings.h1Count.toString())],
    ['Has Heading Skips', ...entries.map(e => e.result.semantics.headings.hasSkips ? 'Yes' : 'No')],
    ['Landmark Coverage %', ...entries.map(e => e.result.semantics.landmarks.coveragePercent.toString())],
    ['Div/Span Ratio', ...entries.map(e => `${(e.result.semantics.divRatio * 100).toFixed(1)}%`)],
    ['Link Issues', ...entries.map(e => e.result.semantics.linkIssues.toString())],
    ['Time Elements (total)', ...entries.map(e => e.result.semantics.timeElements.total.toString())],
    ['Time Elements (with datetime)', ...entries.map(e => e.result.semantics.timeElements.withDatetime.toString())],
    ['List Structures', ...entries.map(e => e.result.semantics.lists.total.toString())],
    ['Tables (total)', ...entries.map(e => e.result.semantics.tables.total.toString())],
    ['Tables (with headers)', ...entries.map(e => e.result.semantics.tables.withHeaders.toString())],
    ['Lang Attribute', ...entries.map(e => e.result.semantics.langAttribute ? 'Yes' : 'No')],
    ['', ...entries.map(() => '')],
    ['IMAGES', ...entries.map(() => '')],
    ['Images (total)', ...entries.map(e => (e.result.semantics.images?.total ?? 0).toString())],
    ['Images with alt', ...entries.map(e => (e.result.semantics.images?.withAlt ?? 0).toString())],
    ['Images decorative (alt="")', ...entries.map(e => (e.result.semantics.images?.emptyAlt ?? 0).toString())],
    ['Images missing alt', ...entries.map(e => (e.result.semantics.images?.missingAlt ?? 0).toString())],
    ['Images in figure', ...entries.map(e => (e.result.semantics.images?.inFigure ?? 0).toString())],
    ['Images with dimensions', ...entries.map(e => (e.result.semantics.images?.withDimensions ?? 0).toString())],
    ['Images with srcset', ...entries.map(e => (e.result.semantics.images?.withSrcset ?? 0).toString())],
    ['Images with lazy loading', ...entries.map(e => (e.result.semantics.images?.withLazyLoading ?? 0).toString())],
  ];

  return rows.map(row => row.map(cell => `"${cell}"`).join(';')).join('\n');
}

function generateComparisonJSON(entries: AnalysisEntry[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    analyses: entries.map(e => ({
      url: e.url,
      timestamp: e.timestamp,
      structure: e.result.structure,
      semantics: e.result.semantics,
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

function ComparisonMetricRow({ 
  label, 
  values 
}: { 
  label: string; 
  values: (string | number)[] 
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-4 text-sm font-medium text-gray-700">{label}</td>
      {values.map((value, index) => (
        <td key={index} className="py-2 px-4 text-sm text-gray-600">
          {value}
        </td>
      ))}
    </tr>
  );
}

export function ComparisonView({ entries, onClose }: ComparisonViewProps) {
  if (entries.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
        <div className="my-8 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">No Analyses to Compare</h2>
          <p className="mb-6 text-sm text-gray-600">
            Run at least two analyses to compare them. Each analysis is saved automatically.
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-6xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Compare Analyses
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Metric
                </th>
                {entries.map((_, index) => (
                  <th key={index} className="pb-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Analysis {index + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ComparisonMetricRow
                label="URL"
                values={entries.map(e => new URL(e.url).hostname)}
              />
              <ComparisonMetricRow
                label="Timestamp"
                values={entries.map(e => new Date(e.timestamp).toLocaleString())}
              />
              <tr><td colSpan={entries.length + 1} className="py-2"></td></tr>
              
              <tr className="bg-gray-50">
                <td colSpan={entries.length + 1} className="py-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Structure
                </td>
              </tr>
              <ComparisonMetricRow
                label="Classification"
                values={entries.map(e => e.result.structure.classification)}
              />
              <ComparisonMetricRow
                label="Difference Count"
                values={entries.map(e => e.result.structure.differenceCount)}
              />
              <ComparisonMetricRow
                label="DOM Nodes"
                values={entries.map(e => e.result.structure.domNodes?.toLocaleString() ?? '-')}
              />
              <ComparisonMetricRow
                label="Max DOM Depth"
                values={entries.map(e => e.result.structure.maxDepth ?? '-')}
              />
              <ComparisonMetricRow
                label="Top-level Sections"
                values={entries.map(e => e.result.structure.topLevelSections ?? '-')}
              />
              <ComparisonMetricRow
                label="Shadow DOM Hosts"
                values={entries.map(e => e.result.structure.customElements ?? '-')}
              />

              <tr><td colSpan={entries.length + 1} className="py-2"></td></tr>

              <tr className="bg-gray-50">
                <td colSpan={entries.length + 1} className="py-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Semantics
                </td>
              </tr>
              <ComparisonMetricRow
                label="Classification"
                values={entries.map(e => e.result.semantics.classification)}
              />
              <ComparisonMetricRow
                label="H1 Count"
                values={entries.map(e => e.result.semantics.headings.h1Count)}
              />
              <ComparisonMetricRow
                label="Has Heading Skips"
                values={entries.map(e => e.result.semantics.headings.hasSkips ? 'Yes' : 'No')}
              />
              <ComparisonMetricRow
                label="Landmark Coverage"
                values={entries.map(e => `${e.result.semantics.landmarks.coveragePercent}%`)}
              />
              <ComparisonMetricRow
                label="Div/Span Ratio"
                values={entries.map(e => `${Math.round(e.result.semantics.divRatio * 100)}%`)}
              />
              <ComparisonMetricRow
                label="Link Issues"
                values={entries.map(e => e.result.semantics.linkIssues)}
              />
              <ComparisonMetricRow
                label="Time Elements"
                values={entries.map(e => {
                  const te = e.result.semantics.timeElements;
                  if (!te) return '-';
                  return te.total === 0 ? '0' : `${te.withDatetime}/${te.total}`;
                })}
              />
              <ComparisonMetricRow
                label="List Structures"
                values={entries.map(e => e.result.semantics.lists?.total ?? '-')}
              />
              <ComparisonMetricRow
                label="Tables"
                values={entries.map(e => {
                  const t = e.result.semantics.tables;
                  if (!t) return '-';
                  return t.total === 0 ? '0' : `${t.withHeaders}/${t.total} with headers`;
                })}
              />
              <ComparisonMetricRow
                label="Lang Attribute"
                values={entries.map(e => e.result.semantics.langAttribute === undefined ? '-' : (e.result.semantics.langAttribute ? 'Yes' : 'No'))}
              />
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Export:</span>
            <button
              onClick={() => {
                const content = generateComparisonJSON(entries);
                const timestamp = new Date().toISOString().split('T')[0];
                downloadFile(content, `docsignals-comparison-${timestamp}.json`, 'application/json');
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              JSON
            </button>
            <button
              onClick={() => {
                const content = generateComparisonCSV(entries);
                const timestamp = new Date().toISOString().split('T')[0];
                downloadFile(content, `docsignals-comparison-${timestamp}.csv`, 'text/csv');
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ComparisonButtonProps {
  onCompare: () => void;
}

export function ComparisonButton({ onCompare }: ComparisonButtonProps) {
  return (
    <button
      onClick={onCompare}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
      title="Compare analyses"
    >
      Compare
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// Storage helpers
export function saveAnalysis(url: string, result: AnalysisResult) {
  try {
    const history = getAnalysisHistory();
    const entry: AnalysisEntry = {
      url,
      timestamp: new Date().toISOString(),
      result,
    };
    const updated = [entry, ...history].slice(0, 10); // Keep last 10
    localStorage.setItem('docSignalsAnalyses', JSON.stringify(updated));
  } catch {}
}

export function getAnalysisHistory(): AnalysisEntry[] {
  try {
    const data = localStorage.getItem('docSignalsAnalyses');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function clearAnalysisHistory() {
  try {
    localStorage.removeItem('docSignalsAnalyses');
  } catch {}
}
