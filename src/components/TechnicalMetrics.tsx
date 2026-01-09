import type { StructureResult, SemanticResult } from '../analysis/types';
import { Code } from './Code';
import { Tooltip } from './Tooltip';

interface MetricRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

interface TechnicalMetricsProps {
  structure: StructureResult;
  semantics: SemanticResult;
  fetchCount: number;
}

export function TechnicalMetrics({ structure, semantics, fetchCount }: TechnicalMetricsProps) {
  const divPercent = Math.round(semantics.divRatio * 100);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">
          Measured Values{' '}
          <Tooltip text="Raw data points extracted from the page's HTML structure without interpretation.">
            <span className="text-indigo-700 font-normal">ⓘ</span>
          </Tooltip>
        </h3>
        <p className="mt-1 text-xs text-gray-500">Raw observations from document analysis</p>
      </div>

      <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
        {/* Structure Metrics */}
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Structure
          </h4>
          <div className="divide-y divide-gray-100">
            <MetricRow
              label="Fetches performed"
              value={fetchCount}
            />
            <MetricRow
              label="Structural differences"
              value={structure.differenceCount}
            />
            <MetricRow
              label={<>DOM nodes {' '}
                <Tooltip text="Total number of HTML elements in the document, excluding scripts, styles, and SVG.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={structure.domNodes.toLocaleString()}
            />
            <MetricRow
              label={<>Max DOM depth {' '}
                <Tooltip text="The deepest level of nesting in the document's element hierarchy.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={structure.maxDepth}
            />
            <MetricRow
              label={<>Top-level sections {' '}
                <Tooltip text="Number of semantic section elements (header, nav, main, section, article, aside, footer) directly under the body.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={structure.topLevelSections}
            />
            <MetricRow
              label={<>Shadow DOM hosts {' '}
                <Tooltip text="Custom elements (hyphenated tag names) that may encapsulate content in shadow DOM, making it invisible to standard document traversal.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={structure.customElements}
            />
          </div>
        </div>

        {/* Semantics Metrics */}
        <div className="mt-6 md:mt-0">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Semantics
          </h4>
          <div className="divide-y divide-gray-100">
            <MetricRow
              label={<><Code>h1</Code> elements</>}
              value={semantics.headings.h1Count}
            />
            <MetricRow
              label={<>Heading level gaps {' '}
                <Tooltip text="Indicates skipped heading levels (e.g. h1 → h3), which can confuse document outline parsers.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={semantics.headings.hasSkips ? 'Yes' : 'No'}
            />
            <MetricRow
              label={<>Content in landmarks {' '}
                <Tooltip text="Percentage of text content located within semantic landmark elements (header, nav, main, footer, aside, section, article).">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={`${semantics.landmarks.coveragePercent}%`}
            />
            <MetricRow
              label={<>Generic containers (<Code>div</Code>/<Code>span</Code>) {' '}
                <Tooltip text="Percentage of all HTML elements that are non-semantic containers (div or span) rather than meaningful elements like p, article, or button.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={`${divPercent}%`}
            />
            <MetricRow
              label={<>Non-descriptive links {' '}
                <Tooltip text="Links with generic text like 'click here', 'read more', or 'learn more' that don't describe the destination.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={semantics.linkIssues}
            />
            <MetricRow
              label={<><Code>time</Code> elements {' '}
                <Tooltip text="Elements using the <time> tag. Those with a datetime attribute provide machine-readable timestamps.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={semantics.timeElements.total === 0
                ? '0'
                : `${semantics.timeElements.withDatetime}/${semantics.timeElements.total} with datetime`}
            />
            <MetricRow
              label={<>List structures {' '}
                <Tooltip text="Count of ordered (ol), unordered (ul), and description (dl) lists in the document.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={semantics.lists.total}
            />
            <MetricRow
              label={<>Tables with headers {' '}
                <Tooltip text="Tables that include thead or th elements to identify header cells.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={semantics.tables.total === 0
                ? '0'
                : `${semantics.tables.withHeaders}/${semantics.tables.total}`}
            />
            <MetricRow
              label={<><Code>lang</Code> attribute {' '}
                <Tooltip text="Whether the html element declares a language via the lang attribute.">
                  <span className="text-indigo-700">ⓘ</span>
                </Tooltip>
              </>}
              value={semantics.langAttribute ? 'Yes' : 'No'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
