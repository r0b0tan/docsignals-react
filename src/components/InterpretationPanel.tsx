import type { StructureResult, SemanticResult } from '../analysis/types';
import { Tooltip } from './Tooltip';

interface Interpretation {
  category: string;
  finding: React.ReactNode;
  implication: React.ReactNode;
}

function generateInterpretations(
  structure: StructureResult,
  semantics: SemanticResult
): Interpretation[] {
  const interpretations: Interpretation[] = [];

  // Structure consistency
  if (structure.classification === 'deterministic') {
    interpretations.push({
      category: 'Structure',
      finding: 'Identical across 3 fetches',
      implication: 'Machines can expect consistent content representation on each visit.',
    });
  } else if (structure.classification === 'mostly-deterministic') {
    interpretations.push({
      category: 'Structure',
      finding: `${structure.differenceCount} minor variation(s) detected`,
      implication: 'Structure is largely stable but machines may encounter small differences between visits.',
    });
  } else {
    interpretations.push({
      category: 'Structure',
      finding: `${structure.differenceCount} structural difference(s) detected`,
      implication: 'Machines may encounter varying content representations, which can complicate parsing and indexing.',
    });
  }

  // Heading structure
  if (semantics.headings.h1Count === 1 && !semantics.headings.hasSkips) {
    interpretations.push({
      category: 'Headings',
      finding: '1 H1, sequential hierarchy',
      implication: 'Document outline can be reliably parsed for topic identification and navigation.',
    });
  } else if (semantics.headings.h1Count === 0) {
    interpretations.push({
      category: 'Headings',
      finding: 'No H1 element present',
      implication: 'Machines cannot identify the primary topic from markup and may rely on heuristics or content analysis.',
    });
  } else if (semantics.headings.h1Count > 1) {
    interpretations.push({
      category: 'Headings',
      finding: `${semantics.headings.h1Count} H1 elements present`,
      implication: 'Multiple primary headings can create ambiguity about document structure and topic hierarchy.',
    });
  } else if (semantics.headings.hasSkips) {
    interpretations.push({
      category: 'Headings',
      finding: 'Heading hierarchy has gaps',
      implication: 'Automated tools may need to reconstruct the intended outline structure from context.',
    });
  }

  // Landmark coverage
  if (semantics.landmarks.coveragePercent >= 80) {
    interpretations.push({
      category: 'Landmarks',
      finding: `${semantics.landmarks.coveragePercent}% within semantic regions`,
      implication: 'Content regions are explicitly defined, enabling reliable navigation and content extraction.',
    });
  } else if (semantics.landmarks.coveragePercent >= 50) {
    interpretations.push({
      category: 'Landmarks',
      finding: `${semantics.landmarks.coveragePercent}% within semantic regions`,
      implication: 'Some content areas are explicitly defined; others may require contextual interpretation.',
    });
  } else {
    interpretations.push({
      category: 'Landmarks',
      finding: `${semantics.landmarks.coveragePercent}% within semantic regions`,
      implication: 'Machines often need to infer content boundaries from visual cues or surrounding context.',
    });
  }

  // Element composition
  const divPercent = Math.round(semantics.divRatio * 100);
  if (semantics.divRatio > 0.6) {
    interpretations.push({
      category: 'Markup',
      finding: `${divPercent}% generic containers`,
      implication: 'Structural meaning often relies on class names or visual presentation rather than semantic markup.',
    });
  } else if (semantics.divRatio > 0.4) {
    interpretations.push({
      category: 'Markup',
      finding: `${divPercent}% generic containers`,
      implication: 'Balance between semantic and presentational markup; some interpretation may be needed.',
    });
  } else {
    interpretations.push({
      category: 'Markup',
      finding: `${divPercent}% generic containers`,
      implication: 'Semantic elements predominate, providing clear structural cues for automated parsing.',
    });
  }

  // Link descriptiveness
  if (semantics.linkIssues > 0) {
    interpretations.push({
      category: 'Links',
      finding: `${semantics.linkIssues} non-descriptive link(s)`,
      implication: 'Link purpose may need to be inferred from surrounding text or context.',
    });
  } else {
    interpretations.push({
      category: 'Links',
      finding: 'All links have descriptive text',
      implication: 'Link destinations can be understood without additional context.',
    });
  }

  return interpretations;
}

interface InterpretationPanelProps {
  structure: StructureResult;
  semantics: SemanticResult;
}

export function InterpretationPanel({ structure, semantics }: InterpretationPanelProps) {
  const interpretations = generateInterpretations(structure, semantics);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-900">
          Interpretation{' '}
          <Tooltip text="Analysis of what the measured values mean for how machines understand and process this page.">
            <span className="text-indigo-700 font-normal">ⓘ</span>
          </Tooltip>
        </h3>
        <p className="mt-1 text-xs text-gray-500">What these measurements suggest for machine readers</p>
      </div>

      <div className="space-y-4">
        {interpretations.map((item, index) => (
          <div
            key={index}
            className="rounded-lg bg-gray-50/80 p-4 ring-1 ring-gray-200/40"
          >
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              {item.category}
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:gap-4">
              <div className="text-sm font-medium text-gray-900 md:w-1/3 md:shrink-0">
                {item.finding}
              </div>
              <div className="text-sm leading-relaxed text-gray-600">
                {item.implication}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
