import { useState } from 'react';
import { analyze, type AnalysisResult } from './analysis';
import { validateUrl, fetchHtml } from './fetch';
import { Dashboard, saveAnalysis, getAnalysisHistory, ComparisonView } from './components';

type State =
  | { status: 'idle' }
  | { status: 'running'; progress: number; currentStep: string }
  | { status: 'error'; message: string }
  | { status: 'done'; result: AnalysisResult };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function App() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [showComparison, setShowComparison] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState(getAnalysisHistory());
  const [fetchCount, setFetchCount] = useState(3);

  async function run() {
    const validation = validateUrl(url);
    if (!validation.ok) {
      setState({ status: 'error', message: validation.error });
      return;
    }

    setState({ status: 'running', progress: 0, currentStep: 'Starting analysis...' });

    try {
      const samples: string[] = [];

      for (let i = 0; i < fetchCount; i++) {
        setState({
          status: 'running',
          progress: (i / fetchCount) * 100,
          currentStep: `Fetching sample ${i + 1} of ${fetchCount}...`
        });
        if (i > 0) await delay(300);
        samples.push(await fetchHtml(validation.url));
      }

      setState({ status: 'running', progress: 100, currentStep: 'Analyzing structure and semantics...' });
      await delay(200); // Brief pause to show completion

      const result = analyze(samples, validation.url);
      
      // Save to history
      saveAnalysis(validation.url, result);
      setAnalysisHistory(getAnalysisHistory());
      
      setState({ status: 'done', result });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Fetch failed',
      });
    }
  }

  return (
    <>
      <Dashboard
        state={state}
        url={url}
        onUrlChange={setUrl}
        onSubmit={run}
        analysisCount={analysisHistory.length}
        onCompare={() => setShowComparison(true)}
        fetchCount={fetchCount}
        onFetchCountChange={setFetchCount}
      />
      {showComparison && (
        <ComparisonView
          entries={analysisHistory}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}
