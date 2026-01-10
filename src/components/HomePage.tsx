import { useState, useEffect } from 'react';
import { analyze, type AnalysisResult } from '../analysis';
import { validateUrl, fetchHtml } from '../fetch';
import { Dashboard } from './Dashboard';
import { saveAnalysis, getAnalysisHistory } from './ComparisonView';

type State =
  | { status: 'idle' }
  | { status: 'running'; progress: number; currentStep: string }
  | { status: 'error'; message: string }
  | { status: 'done'; result: AnalysisResult; analyzedUrl: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function HomePage() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [fetchCount, setFetchCount] = useState(3);
  const [fetchWarnings, setFetchWarnings] = useState<string[]>([]);

  // Load last analysis result on mount
  useEffect(() => {
    const history = getAnalysisHistory();
    if (history.length > 0) {
      const last = history[0];
      setUrl(last.url);
      setState({ status: 'done', result: last.result, analyzedUrl: last.url });
    }
  }, []);

  // Load a specific analysis from history
  function loadFromHistory(index: number) {
    const history = getAnalysisHistory();
    if (history[index]) {
      const entry = history[index];
      setUrl(entry.url);
      setState({ status: 'done', result: entry.result, analyzedUrl: entry.url });
    }
  }

  const run = async () => {
    setFetchWarnings([]); // Clear previous warnings

    const validation = validateUrl(url);
    if (!validation.ok) {
      setState({ status: 'error', message: validation.error });
      return;
    }

    setState({ status: 'running', progress: 0, currentStep: 'Starting analysis...' });

    try {
      const samples: string[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < fetchCount; i++) {
        setState({
          status: 'running',
          progress: (i / fetchCount) * 100,
          currentStep: `Fetching sample ${i + 1} of ${fetchCount}...`
        });
        if (i > 0) await delay(300);
        
        const result = await fetchHtml(validation.url);
        if (result.error) {
          warnings.push(`Sample ${i + 1}: ${result.error}`);
        } else if (result.html) {
          samples.push(result.html);
        }
      }

      // If all fetches failed, show error with details
      if (samples.length === 0) {
        const errorDetails = warnings.length > 0 
          ? warnings.map(w => w.replace(/^Sample \d+: /, '')).filter((v, i, a) => a.indexOf(v) === i).join('\n')
          : 'Unknown error';
        
        // Determine the type of error for the hint
        const isNetworkError = warnings.some(w => 
          w.toLowerCase().includes('unable to connect') || 
          w.toLowerCase().includes('network')
        );
        const isNotFound = warnings.some(w => w.toLowerCase().includes('not found') || w.includes('404'));
        const isForbidden = warnings.some(w => w.toLowerCase().includes('forbidden') || w.includes('403'));
        const isTimeout = warnings.some(w => w.toLowerCase().includes('timeout'));
        const isServerError = warnings.some(w => w.includes('500') || w.includes('502') || w.includes('503'));
        
        let hint = '';
        if (isNotFound) {
          hint = '\n\nPlease check that the URL is correct and the page exists.';
        } else if (isForbidden) {
          hint = '\n\nThis page may require authentication or is not publicly accessible.';
        } else if (isTimeout) {
          hint = '\n\nThe server is slow or unresponsive. Try again later.';
        } else if (isServerError) {
          hint = '\n\nThe website is experiencing issues. Try again later.';
        } else if (isNetworkError) {
          hint = '\n\nCheck your internet connection or try a different URL.';
        }
        
        setState({
          status: 'error',
          message: `Could not fetch the URL.\n\n${errorDetails}${hint}`,
        });
        return;
      }

      // If some fetches failed, store warnings but continue
      if (warnings.length > 0) {
        setFetchWarnings(warnings);
      }

      setState({ status: 'running', progress: 100, currentStep: 'Analyzing structure and semantics...' });
      await delay(200);

      const result = analyze(samples, validation.url);

      saveAnalysis(validation.url, result);

      setState({ status: 'done', result, analyzedUrl: validation.url });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Fetch failed',
      });
    }
  };

  return (
    <Dashboard
      state={state}
      url={url}
      onUrlChange={setUrl}
      onSubmit={run}
      fetchCount={fetchCount}
      onFetchCountChange={setFetchCount}
      onLoadFromHistory={loadFromHistory}
      fetchWarnings={fetchWarnings}
      onDismissWarnings={() => setFetchWarnings([])}
    />
  );
}
