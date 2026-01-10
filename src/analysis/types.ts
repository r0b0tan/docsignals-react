export interface NormalizedNode {
  tag: string;
  childTags: string[];
}

export interface StructureResult {
  classification: 'deterministic' | 'mostly-deterministic' | 'unstable';
  differenceCount: number;
  domNodes: number;
  maxDepth: number;
  topLevelSections: number;
  customElements: number;
}

export interface ImageResult {
  total: number;
  withAlt: number;
  emptyAlt: number;  // Decorative images (alt="")
  missingAlt: number;
  inFigure: number;  // Images wrapped in <figure>
  withDimensions: number;  // Images with width/height attributes
  withSrcset: number;  // Responsive images
  withLazyLoading: number;  // loading="lazy"
}

export interface SemanticResult {
  classification: 'explicit' | 'partial' | 'opaque';
  headings: { h1Count: number; hasSkips: boolean };
  landmarks: { found: string[]; coveragePercent: number };
  divRatio: number;
  linkIssues: number;
  timeElements: { total: number; withDatetime: number };
  lists: { total: number; ordered: number; unordered: number; description: number };
  tables: { total: number; withHeaders: number };
  langAttribute: boolean;
  images: ImageResult;
}

export interface AnalysisResult {
  url: string;
  structure: StructureResult;
  semantics: SemanticResult;
}
