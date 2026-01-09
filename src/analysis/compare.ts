import type { NormalizedNode, StructureResult } from './types';

function treesEqual(a: NormalizedNode, b: NormalizedNode): boolean {
  if (a.tag !== b.tag) return false;
  if (a.childTags.length !== b.childTags.length) return false;

  for (let i = 0; i < a.childTags.length; i++) {
    if (a.childTags[i] !== b.childTags[i]) return false;
  }

  return true;
}

export interface DomMetrics {
  domNodes: number;
  maxDepth: number;
  topLevelSections: number;
}

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'path']);
const SECTION_TAGS = new Set(['header', 'nav', 'main', 'section', 'article', 'aside', 'footer']);

export function analyzeDomMetrics(html: string): DomMetrics {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  if (!body) {
    return { domNodes: 0, maxDepth: 0, topLevelSections: 0 };
  }

  let domNodes = 0;
  let maxDepth = 0;

  function walk(el: Element, depth: number): void {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;

    domNodes++;
    maxDepth = Math.max(maxDepth, depth);

    for (const child of el.children) {
      walk(child, depth + 1);
    }
  }

  walk(body, 1);

  // Count top-level sections (direct children of body that are semantic sections)
  let topLevelSections = 0;
  for (const child of body.children) {
    const tag = child.tagName.toLowerCase();
    if (SECTION_TAGS.has(tag)) {
      topLevelSections++;
    }
  }

  return { domNodes, maxDepth, topLevelSections };
}

export function compare(trees: NormalizedNode[], domMetrics: DomMetrics): StructureResult {
  let differences = 0;

  for (let i = 0; i < trees.length; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      if (!treesEqual(trees[i], trees[j])) {
        differences++;
      }
    }
  }

  let classification: StructureResult['classification'];
  if (differences === 0) {
    classification = 'deterministic';
  } else if (differences === 1) {
    classification = 'mostly-deterministic';
  } else {
    classification = 'unstable';
  }

  return {
    classification,
    differenceCount: differences,
    ...domMetrics,
  };
}
