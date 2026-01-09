import type { AnalysisResult } from './types';
import { normalize } from './normalize';
import { compare, analyzeDomMetrics } from './compare';
import { checkSemantics } from './semantics';

export function analyze(htmlSamples: string[], url: string): AnalysisResult {
  const trees = htmlSamples.map(normalize);
  const domMetrics = analyzeDomMetrics(htmlSamples[0]);
  const structure = compare(trees, domMetrics);
  const semantics = checkSemantics(htmlSamples[0]);

  return { url, structure, semantics };
}

export type { AnalysisResult, StructureResult, SemanticResult } from './types';
