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
}

export interface SemanticResult {
  classification: 'explicit' | 'partial' | 'opaque';
  headings: { h1Count: number; hasSkips: boolean };
  landmarks: { found: string[]; coveragePercent: number };
  divRatio: number;
  linkIssues: number;
}

export interface AnalysisResult {
  url: string;
  structure: StructureResult;
  semantics: SemanticResult;
}
