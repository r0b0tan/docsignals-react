import type { AnalysisResult } from '../analysis/types';

interface ExportButtonProps {
  result: AnalysisResult;
  url: string;
}

function generateJSON(result: AnalysisResult, url: string): string {
  return JSON.stringify(
    {
      url,
      timestamp: new Date().toISOString(),
      structure: result.structure,
      semantics: result.semantics,
    },
    null,
    2
  );
}

function generateCSV(result: AnalysisResult, url: string): string {
  const rows = [
    ['Metric', 'Value'],
    ['URL', url],
    ['Timestamp', new Date().toISOString()],
    ['', ''],
    ['STRUCTURE', ''],
    ['Classification', result.structure.classification],
    ['Difference Count', result.structure.differenceCount.toString()],
    ['DOM Nodes', result.structure.domNodes.toString()],
    ['Max DOM Depth', result.structure.maxDepth.toString()],
    ['Top-level Sections', result.structure.topLevelSections.toString()],
    ['Shadow DOM Hosts', result.structure.customElements.toString()],
    ['', ''],
    ['SEMANTICS', ''],
    ['Classification', result.semantics.classification],
    ['H1 Count', result.semantics.headings.h1Count.toString()],
    ['Has Heading Skips', result.semantics.headings.hasSkips ? 'Yes' : 'No'],
    ['Landmark Coverage %', result.semantics.landmarks.coveragePercent.toString()],
    ['Div/Span Ratio', (result.semantics.divRatio * 100).toFixed(1) + '%'],
    ['Link Issues', result.semantics.linkIssues.toString()],
    ['Time Elements (total)', result.semantics.timeElements.total.toString()],
    ['Time Elements (with datetime)', result.semantics.timeElements.withDatetime.toString()],
    ['List Structures', result.semantics.lists.total.toString()],
    ['Tables (total)', result.semantics.tables.total.toString()],
    ['Tables (with headers)', result.semantics.tables.withHeaders.toString()],
    ['Lang Attribute', result.semantics.langAttribute ? 'Yes' : 'No'],
    ['', ''],
    ['IMAGES', ''],
    ['Images (total)', result.semantics.images.total.toString()],
    ['Images with alt', result.semantics.images.withAlt.toString()],
    ['Images decorative (alt="")', result.semantics.images.emptyAlt.toString()],
    ['Images missing alt', result.semantics.images.missingAlt.toString()],
    ['Images in figure', result.semantics.images.inFigure.toString()],
    ['Images with dimensions', result.semantics.images.withDimensions.toString()],
    ['Images with srcset', result.semantics.images.withSrcset.toString()],
    ['Images with lazy loading', result.semantics.images.withLazyLoading.toString()],
  ];

  // Use semicolon as delimiter for better Excel compatibility (especially in European locales)
  return rows.map((row) => row.map((cell) => `"${cell}"`).join(';')).join('\n');
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
    const hostname = new URL(url).hostname;
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
      <span className="text-sm text-gray-600">Export:</span>
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
