import type { StructureResult, SemanticResult } from '../analysis/types';
import { Tooltip } from './Tooltip';

interface Interpretation {
  category: string;
  finding: React.ReactNode;
  implication: React.ReactNode;
}

function generateInterpretations(
  structure: StructureResult,
  semantics: SemanticResult,
  fetchCount: number
): Interpretation[] {
  const interpretations: Interpretation[] = [];

  // Structure consistency
  if (structure.classification === 'deterministic') {
    const finding = fetchCount === 1 
      ? 'Single fetch completed'
      : `Identical across ${fetchCount} fetches`;
    const implication = fetchCount === 1
      ? 'Baseline captured; multiple fetches needed to verify consistency across visits.'
      : 'Machines can expect consistent content representation on each visit.';
    interpretations.push({
      category: 'Structure Consistency',
      finding,
      implication,
    });
  } else if (structure.classification === 'mostly-deterministic') {
    interpretations.push({
      category: 'Structure Consistency',
      finding: `${structure.differenceCount} minor variation(s) detected`,
      implication: 'Structure is largely stable but machines may encounter small differences between visits.',
    });
  } else {
    interpretations.push({
      category: 'Structure Consistency',
      finding: `${structure.differenceCount} structural difference(s) detected`,
      implication: 'Machines may encounter varying content representations, which can complicate parsing and indexing.',
    });
  }

  // Heading structure
  if (semantics.headings.h1Count === 1 && !semantics.headings.hasSkips) {
    interpretations.push({
      category: 'Semantic Headings',
      finding: '1 H1, sequential hierarchy',
      implication: 'Document outline can be reliably parsed for topic identification and navigation.',
    });
  } else if (semantics.headings.h1Count === 0) {
    interpretations.push({
      category: 'Semantic Headings',
      finding: 'No H1 element present',
      implication: 'Machines cannot identify the primary topic from markup and may rely on heuristics or content analysis.',
    });
  } else if (semantics.headings.h1Count > 1) {
    interpretations.push({
      category: 'Semantic Headings',
      finding: `${semantics.headings.h1Count} H1 elements present`,
      implication: 'Multiple primary headings can create ambiguity about document structure and topic hierarchy.',
    });
  } else if (semantics.headings.hasSkips) {
    interpretations.push({
      category: 'Semantic Headings',
      finding: 'Heading hierarchy has gaps',
      implication: 'Automated tools may need to reconstruct the intended outline structure from context.',
    });
  }

  // Landmark coverage
  if (semantics.landmarks.coveragePercent >= 80) {
    interpretations.push({
      category: 'Semantic Landmarks',
      finding: `${semantics.landmarks.coveragePercent}% within semantic regions`,
      implication: 'Content regions are explicitly defined, enabling reliable navigation and content extraction.',
    });
  } else if (semantics.landmarks.coveragePercent >= 50) {
    interpretations.push({
      category: 'Semantic Landmarks',
      finding: `${semantics.landmarks.coveragePercent}% within semantic regions`,
      implication: 'Some content areas are explicitly defined; others may require contextual interpretation.',
    });
  } else {
    interpretations.push({
      category: 'Semantic Landmarks',
      finding: `${semantics.landmarks.coveragePercent}% within semantic regions`,
      implication: 'Machines often need to infer content boundaries from visual cues or surrounding context.',
    });
  }

  // Max DOM depth
  if (structure.maxDepth >= 15) {
    interpretations.push({
      category: 'Structure Depth',
      finding: `${structure.maxDepth} levels of nesting`,
      implication: 'Deep nesting may require machines to traverse multiple layers to infer context.',
    });
  } else if (structure.maxDepth >= 10) {
    interpretations.push({
      category: 'Structure Depth',
      finding: `${structure.maxDepth} levels of nesting`,
      implication: 'Moderate nesting depth; machines may need to traverse several layers to infer context.',
    });
  }

  // Top-level sections
  if (structure.topLevelSections >= 3) {
    interpretations.push({
      category: 'Structure Sections',
      finding: `${structure.topLevelSections} top-level sections`,
      implication: 'Clear top-level segmentation allows machines to identify major content regions early during parsing.',
    });
  } else if (structure.topLevelSections > 0) {
    interpretations.push({
      category: 'Structure Sections',
      finding: `${structure.topLevelSections} top-level section${structure.topLevelSections === 1 ? '' : 's'}`,
      implication: 'Limited top-level segmentation; machines may need to infer content region boundaries from other cues.',
    });
  } else {
    interpretations.push({
      category: 'Structure Sections',
      finding: 'No top-level sections',
      implication: 'Without explicit top-level segmentation, machines must infer content region boundaries from context.',
    });
  }

  // Shadow DOM hosts (custom elements)
  if (structure.customElements > 0) {
    interpretations.push({
      category: 'Structure Shadow DOM',
      finding: `${structure.customElements} shadow DOM host${structure.customElements === 1 ? '' : 's'}`,
      implication: 'Content inside shadow DOM boundaries is not visible to standard document traversal methods.',
    });
  }

  // Element composition
  const divPercent = Math.round(semantics.divRatio * 100);
  if (semantics.divRatio > 0.6) {
    interpretations.push({
      category: 'Semantic Markup',
      finding: `${divPercent}% generic containers`,
      implication: 'Structural meaning often relies on class names or visual presentation rather than semantic markup.',
    });
  } else if (semantics.divRatio > 0.4) {
    interpretations.push({
      category: 'Semantic Markup',
      finding: `${divPercent}% generic containers`,
      implication: 'Balance between semantic and presentational markup; some interpretation may be needed.',
    });
  } else {
    interpretations.push({
      category: 'Semantic Markup',
      finding: `${divPercent}% generic containers`,
      implication: 'Semantic elements predominate, providing clear structural cues for automated parsing.',
    });
  }

  // Link descriptiveness
  if (semantics.linkIssues > 0) {
    interpretations.push({
      category: 'Semantic Links',
      finding: `${semantics.linkIssues} non-descriptive link(s)`,
      implication: 'Link purpose may need to be inferred from surrounding text or context.',
    });
  } else {
    interpretations.push({
      category: 'Semantic Links',
      finding: 'All links have descriptive text',
      implication: 'Link destinations can be understood without additional context.',
    });
  }

  // Time elements
  if (semantics.timeElements.total > 0) {
    if (semantics.timeElements.withDatetime === semantics.timeElements.total) {
      interpretations.push({
        category: 'Semantic Time',
        finding: `${semantics.timeElements.total} time element${semantics.timeElements.total === 1 ? '' : 's'} with datetime`,
        implication: 'Machine-readable timestamps allow unambiguous date extraction without parsing natural language.',
      });
    } else if (semantics.timeElements.withDatetime > 0) {
      interpretations.push({
        category: 'Semantic Time',
        finding: `${semantics.timeElements.withDatetime}/${semantics.timeElements.total} time elements with datetime`,
        implication: 'Some timestamps are machine-readable; others require natural language date parsing.',
      });
    } else {
      interpretations.push({
        category: 'Semantic Time',
        finding: `${semantics.timeElements.total} time element${semantics.timeElements.total === 1 ? '' : 's'} without datetime`,
        implication: 'Time elements lack machine-readable datetime attributes, requiring natural language date parsing.',
      });
    }
  }

  // List structures
  if (semantics.lists.total > 0) {
    interpretations.push({
      category: 'Semantic Lists',
      finding: `${semantics.lists.total} list structure${semantics.lists.total === 1 ? '' : 's'}`,
      implication: 'List markup signals enumerable content, allowing machines to identify item boundaries without heuristics.',
    });
  }

  // Tables
  if (semantics.tables.total > 0) {
    const withoutHeaders = semantics.tables.total - semantics.tables.withHeaders;
    if (withoutHeaders > 0) {
      interpretations.push({
        category: 'Semantic Tables',
        finding: `${withoutHeaders} table${withoutHeaders === 1 ? '' : 's'} without header markup`,
        implication: 'Tables without header markup require machines to infer which cells are labels versus data.',
      });
    }
  }

  // Language attribute
  if (semantics.langAttribute) {
    interpretations.push({
      category: 'Semantic Language',
      finding: 'Language declared',
      implication: 'Language declaration allows machines to apply appropriate text processing and tokenization rules.',
    });
  } else {
    interpretations.push({
      category: 'Semantic Language',
      finding: 'No language declared',
      implication: 'Without a lang attribute, machines must detect the document language through content analysis.',
    });
  }

  // Images
  if (semantics.images.total > 0) {
    const { total, withAlt, emptyAlt, missingAlt, inFigure } = semantics.images;
    
    // Alt text coverage
    if (missingAlt === 0) {
      interpretations.push({
        category: 'Image Accessibility',
        finding: 'All images have alt attributes',
        implication: 'Machines can distinguish between meaningful images (with descriptions) and decorative ones (empty alt).',
      });
    } else if (missingAlt > 0) {
      const percent = Math.round((missingAlt / total) * 100);
      interpretations.push({
        category: 'Image Accessibility',
        finding: `${missingAlt} image${missingAlt === 1 ? '' : 's'} missing alt attribute (${percent}%)`,
        implication: 'Machines cannot determine whether these images convey meaning or are purely decorative.',
      });
    }

    // Semantic context (figure/figcaption)
    if (inFigure > 0) {
      const percent = Math.round((inFigure / total) * 100);
      interpretations.push({
        category: 'Image Context',
        finding: `${inFigure} image${inFigure === 1 ? '' : 's'} in figure elements (${percent}%)`,
        implication: 'Figure markup provides semantic grouping and potential caption association for machine understanding.',
      });
    }

    // Decorative images
    if (emptyAlt > 0 && withAlt > 0) {
      interpretations.push({
        category: 'Image Classification',
        finding: `${withAlt} meaningful, ${emptyAlt} decorative image${emptyAlt === 1 ? '' : 's'}`,
        implication: 'Clear distinction between content images and decorative elements allows machines to prioritize relevant visuals.',
      });
    }
  }

  return interpretations;
}

interface InterpretationPanelProps {
  structure: StructureResult;
  semantics: SemanticResult;
  fetchCount: number;
}

export function InterpretationPanel({ structure, semantics, fetchCount }: InterpretationPanelProps) {
  const interpretations = generateInterpretations(structure, semantics, fetchCount);

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
