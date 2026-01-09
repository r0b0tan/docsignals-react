import type { AnalysisResult } from '../analysis/types';
import { HeaderBar } from './HeaderBar';
import { TechnicalMetrics } from './TechnicalMetrics';
import { InterpretationPanel } from './InterpretationPanel';
import { ExportButton } from './ExportButton';
import { ComparisonButton } from './ComparisonView';
import { FooterNote } from './FooterNote';

type DashboardState =
  | { status: 'idle' }
  | { status: 'running'; progress: number; currentStep: string }
  | { status: 'error'; message: string }
  | { status: 'done'; result: AnalysisResult };

interface DashboardProps {
  state: DashboardState;
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  analysisCount: number;
  onCompare: () => void;
}

export function Dashboard({ state, url, onUrlChange, onSubmit, analysisCount, onCompare }: DashboardProps) {
  return (
    <div className="min-h-screen bg-white">
      <HeaderBar
        url={url}
        onUrlChange={onUrlChange}
        onSubmit={onSubmit}
        isRunning={state.status === 'running'}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {state.status === 'error' && (
          <div className="mb-8 rounded-xl bg-red-50/80 px-5 py-4 ring-1 ring-red-200/60">
            <p className="text-sm text-red-700">{state.message}</p>
          </div>
        )}

        {state.status === 'running' && (
          <div className="rounded-xl bg-white px-6 py-8 shadow-sm ring-1 ring-gray-200/60">
            <div className="mx-auto max-w-md">
              <p className="mb-3 text-center text-sm font-medium text-gray-700">
                {state.currentStep}
              </p>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-gray-900 transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-center text-xs text-gray-500">
                {Math.round(state.progress)}%
              </p>
            </div>
          </div>
        )}

        {state.status === 'idle' && (
          <div className="py-20 text-center">
            <p className="text-sm text-gray-400">
              Enter a URL above to analyze its structural signals.
            </p>
          </div>
        )}

        {state.status === 'done' && (
          <div className="space-y-8 sm:space-y-10">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Analysis Results</h2>
              <div className="flex items-center gap-2">
                <ComparisonButton onCompare={onCompare} analysisCount={analysisCount} />
                <ExportButton result={state.result} url={url} />
              </div>
            </div>

            {/* Technical Metrics Section */}
            <section>
              <TechnicalMetrics
                structure={state.result.structure}
                semantics={state.result.semantics}
              />
            </section>

            {/* Interpretation Section */}
            <section>
              <InterpretationPanel
                structure={state.result.structure}
                semantics={state.result.semantics}
              />
            </section>

            <FooterNote />
          </div>
        )}
      </main>
    </div>
  );
}
