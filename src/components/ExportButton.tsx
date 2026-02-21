import type { AnalysisResult } from '../analysis/types';

interface ExportButtonProps {
  result: AnalysisResult;
  url: string;
}

function generateJSON(result: AnalysisResult, url: string): string {
  return JSON.stringify(
    {
      meta: {
        url,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
      structure: {
        classification: result.structure.classification,
        differenceCount: result.structure.differenceCount,
        domNodes: result.structure.domNodes,
        maxDepth: result.structure.maxDepth,
        topLevelSections: result.structure.topLevelSections,
        shadowDomHosts: result.structure.customElements,
      },
      semantics: {
        classification: result.semantics.classification,
        langAttribute: result.semantics.langAttribute,
        headings: {
          h1Count: result.semantics.headings.h1Count,
          hasSkips: result.semantics.headings.hasSkips,
        },
        landmarks: {
          found: result.semantics.landmarks.found,
          coveragePercent: result.semantics.landmarks.coveragePercent,
        },
        images: {
          total: result.semantics.images.total,
          withAlt: result.semantics.images.withAlt,
          decorative: result.semantics.images.emptyAlt,
          missingAlt: result.semantics.images.missingAlt,
          inFigure: result.semantics.images.inFigure,
          withDimensions: result.semantics.images.withDimensions,
          withSrcset: result.semantics.images.withSrcset,
          withLazyLoading: result.semantics.images.withLazyLoading,
        },
        lists: {
          total: result.semantics.lists.total,
          ordered: result.semantics.lists.ordered,
          unordered: result.semantics.lists.unordered,
          description: result.semantics.lists.description,
        },
        tables: {
          total: result.semantics.tables.total,
          withHeaders: result.semantics.tables.withHeaders,
        },
        timeElements: {
          total: result.semantics.timeElements.total,
          withDatetime: result.semantics.timeElements.withDatetime,
        },
        divSpanRatio: result.semantics.divRatio,
        linkIssues: result.semantics.linkIssues,
      },
    },
    null,
    2
  );
}

function generateCSV(result: AnalysisResult, url: string): string {
  const headers = [
    'url',
    'exported_at',
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

  const values = [
    url,
    new Date().toISOString(),
    result.structure.classification,
    result.structure.differenceCount,
    result.structure.domNodes,
    result.structure.maxDepth,
    result.structure.topLevelSections,
    result.structure.customElements,
    result.semantics.classification,
    result.semantics.langAttribute,
    result.semantics.headings.h1Count,
    result.semantics.headings.hasSkips,
    result.semantics.landmarks.found.join('|'),
    result.semantics.landmarks.coveragePercent,
    result.semantics.images.total,
    result.semantics.images.withAlt,
    result.semantics.images.emptyAlt,
    result.semantics.images.missingAlt,
    result.semantics.images.inFigure,
    result.semantics.images.withDimensions,
    result.semantics.images.withSrcset,
    result.semantics.images.withLazyLoading,
    result.semantics.lists.total,
    result.semantics.lists.ordered,
    result.semantics.lists.unordered,
    result.semantics.lists.description,
    result.semantics.tables.total,
    result.semantics.tables.withHeaders,
    result.semantics.timeElements.total,
    result.semantics.timeElements.withDatetime,
    result.semantics.divRatio,
    result.semantics.linkIssues,
  ];

  const escapeCSV = (val: unknown): string => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [
    headers.join(','),
    values.map(escapeCSV).join(','),
  ].join('\n');
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

export function ExportButton({ result, url }: ExportButtonProps) {
  function handleExport(format: 'json' | 'csv') {
    let hostname = 'unknown';
    try {
      hostname = new URL(url).hostname.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 100);
    } catch {
      // Use fallback if URL is invalid
    }
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `docsignals-${hostname}-${timestamp}.${format}`;

    if (format === 'json') {
      const content = generateJSON(result, url);
      downloadFile(content, filename, 'application/json');
    } else {
      const content = generateCSV(result, url);
      downloadFile(content, filename, 'text/csv');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500" title="Raw signals for further processing">Export data:</span>
      <button
        onClick={() => handleExport('json')}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
      >
        JSON
      </button>
      <button
        onClick={() => handleExport('csv')}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
      >
        CSV
      </button>
    </div>
  );
}
