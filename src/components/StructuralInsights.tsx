import type { StructureResult, SemanticResult } from '../analysis/types';
import { Code } from './Code';

interface Fact {
  label: string;
  value: React.ReactNode;
}

function generateFacts(
  structure: StructureResult,
  semantics: SemanticResult
): Fact[] {
  const facts: Fact[] = [];

  // Structure consistency
  if (structure.differenceCount === 0) {
    facts.push({
      label: 'Structure consistency',
      value: 'Identical across 3 fetches',
    });
  } else {
    facts.push({
      label: 'Structure consistency',
      value: `${structure.differenceCount} difference(s) detected across 3 fetches`,
    });
  }

  // Heading structure
  const h1Text = semantics.headings.h1Count === 1 ? '1 H1' : `${semantics.headings.h1Count} H1 elements`;
  const skipText = semantics.headings.hasSkips ? ', hierarchy gaps present' : ', sequential hierarchy';
  facts.push({
    label: 'Primary heading',
    value: <>{h1Text}{skipText}</>,
  });

  // Landmark coverage
  facts.push({
    label: 'Landmark coverage',
    value: `${semantics.landmarks.coveragePercent}% of content within semantic regions`,
  });

  // Element composition
  const divPercent = Math.round(semantics.divRatio * 100);
  facts.push({
    label: 'Element composition',
    value: <>{divPercent}% generic containers (<Code>div</Code>, <Code>span</Code>)</>,
  });

  // Link descriptiveness
  if (semantics.linkIssues === 0) {
    facts.push({
      label: 'Link text',
      value: 'All links contain descriptive text',
    });
  } else {
    facts.push({
      label: 'Link text',
      value: `${semantics.linkIssues} link(s) use generic or empty text`,
    });
  }

  return facts;
}

interface StructuralInsightsProps {
  structure: StructureResult;
  semantics: SemanticResult;
}

export function StructuralInsights({ structure, semantics }: StructuralInsightsProps) {
  const facts = generateFacts(structure, semantics);

  return (
    <div className="rounded-lg bg-gray-50/50 px-5 py-4 ring-1 ring-gray-200/40">
      <div className="mb-3.5">
        <h4 className="text-xs font-medium text-gray-700">
          Additional Metrics
        </h4>
        <p className="mt-0.5 text-xs text-gray-500">
          Detailed measurements
        </p>
      </div>

      <div className="space-y-2.5">
        {facts.map((fact, index) => (
          <div key={index} className="flex flex-col gap-0.5">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {fact.label}
            </div>
            <div className="text-xs text-gray-700">
              {fact.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
