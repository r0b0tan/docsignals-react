import type { StructureResult, SemanticResult } from '../analysis/types';
import { Code } from './Code';

interface MetricRowProps {
  label: string;
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
}

export function TechnicalMetrics({ structure, semantics }: TechnicalMetricsProps) {
  const divPercent = Math.round(semantics.divRatio * 100);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Measured Values</h3>
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
              value="3"
            />
            <MetricRow
              label="Structural differences"
              value={structure.differenceCount}
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
              label="Heading level gaps"
              value={semantics.headings.hasSkips ? 'Yes' : 'No'}
            />
            <MetricRow
              label="Content in landmarks"
              value={`${semantics.landmarks.coveragePercent}%`}
            />
            <MetricRow
              label={<>Generic containers (<Code>div</Code>/<Code>span</Code>)</>}
              value={`${divPercent}%`}
            />
            <MetricRow
              label="Non-descriptive links"
              value={semantics.linkIssues}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
