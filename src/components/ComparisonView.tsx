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
  const headers = [
    'url',
    'timestamp',
    'structure_classification',
    'structure_difference_count',
    'structure_dom_nodes',
    'structure_max_depth',
    'structure_top_level_sections',
    'structure_shadow_dom_hosts',
    'semantics_classification',
    'semantics_lang_attribute',
    'semantics_h1_count',
    'semantics_heading_skips',
    'semantics_landmarks_found',
    'semantics_landmarks_coverage_percent',
    'semantics_images_total',
    'semantics_images_with_alt',
    'semantics_images_decorative',
    'semantics_images_missing_alt',
    'semantics_images_in_figure',
    'semantics_images_with_dimensions',
    'semantics_images_with_srcset',
    'semantics_images_with_lazy_loading',
    'semantics_lists_total',
    'semantics_lists_ordered',
    'semantics_lists_unordered',
    'semantics_lists_description',
    'semantics_tables_total',
    'semantics_tables_with_headers',
    'semantics_time_elements_total',
    'semantics_time_elements_with_datetime',
    'semantics_div_span_ratio',
    'semantics_link_issues',
  ];

  const escapeCSV = (val: unknown): string => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = entries.map(e => [
    e.url,
    e.timestamp,
    e.result.structure.classification,
    e.result.structure.differenceCount,
    e.result.structure.domNodes,
    e.result.structure.maxDepth,
    e.result.structure.topLevelSections,
    e.result.structure.customElements,
    e.result.semantics.classification,
    e.result.semantics.langAttribute,
    e.result.semantics.headings.h1Count,
    e.result.semantics.headings.hasSkips,
    e.result.semantics.landmarks.found.join('|'),
    e.result.semantics.landmarks.coveragePercent,
    e.result.semantics.images?.total ?? 0,
    e.result.semantics.images?.withAlt ?? 0,
    e.result.semantics.images?.emptyAlt ?? 0,
    e.result.semantics.images?.missingAlt ?? 0,
    e.result.semantics.images?.inFigure ?? 0,
    e.result.semantics.images?.withDimensions ?? 0,
    e.result.semantics.images?.withSrcset ?? 0,
    e.result.semantics.images?.withLazyLoading ?? 0,
    e.result.semantics.lists.total,
    e.result.semantics.lists.ordered,
    e.result.semantics.lists.unordered,
    e.result.semantics.lists.description,
    e.result.semantics.tables.total,
    e.result.semantics.tables.withHeaders,
    e.result.semantics.timeElements.total,
    e.result.semantics.timeElements.withDatetime,
    e.result.semantics.divRatio,
    e.result.semantics.linkIssues,
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');
}

function generateComparisonJSON(entries: AnalysisEntry[]): string {
  return JSON.stringify({
    meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      count: entries.length,
    },
    analyses: entries.map(e => ({
      meta: {
        url: e.url,
        analyzedAt: e.timestamp,
      },
      structure: {
        classification: e.result.structure.classification,
        differenceCount: e.result.structure.differenceCount,
        domNodes: e.result.structure.domNodes,
        maxDepth: e.result.structure.maxDepth,
        topLevelSections: e.result.structure.topLevelSections,
        shadowDomHosts: e.result.structure.customElements,
      },
      semantics: {
        classification: e.result.semantics.classification,
        langAttribute: e.result.semantics.langAttribute,
        headings: {
          h1Count: e.result.semantics.headings.h1Count,
          hasSkips: e.result.semantics.headings.hasSkips,
        },
        landmarks: {
          found: e.result.semantics.landmarks.found,
          coveragePercent: e.result.semantics.landmarks.coveragePercent,
        },
        images: {
          total: e.result.semantics.images?.total ?? 0,
          withAlt: e.result.semantics.images?.withAlt ?? 0,
          decorative: e.result.semantics.images?.emptyAlt ?? 0,
          missingAlt: e.result.semantics.images?.missingAlt ?? 0,
          inFigure: e.result.semantics.images?.inFigure ?? 0,
          withDimensions: e.result.semantics.images?.withDimensions ?? 0,
          withSrcset: e.result.semantics.images?.withSrcset ?? 0,
          withLazyLoading: e.result.semantics.images?.withLazyLoading ?? 0,
        },
        lists: {
          total: e.result.semantics.lists.total,
          ordered: e.result.semantics.lists.ordered,
          unordered: e.result.semantics.lists.unordered,
          description: e.result.semantics.lists.description,
        },
        tables: {
          total: e.result.semantics.tables.total,
          withHeaders: e.result.semantics.tables.withHeaders,
        },
        timeElements: {
          total: e.result.semantics.timeElements.total,
          withDatetime: e.result.semantics.timeElements.withDatetime,
        },
        divSpanRatio: e.result.semantics.divRatio,
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

        <div className="px-6 pt-4">
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Reading note:</span>{' '}
            Values differ due to page type and rendering model. Differences are highlighted but do not imply better or worse.
          </div>
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
            <span className="text-sm text-gray-500" title="Raw signals for further processing">Export data:</span>
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
    // Strip query params to avoid storing sensitive data (tokens, etc.)
    let cleanUrl = url;
    try {
      const urlObj = new URL(url);
      cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {}

    const history = getAnalysisHistory();
    const entry: AnalysisEntry = {
      url: cleanUrl,
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
