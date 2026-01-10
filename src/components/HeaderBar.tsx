import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderBarProps {
  url?: string;
  onUrlChange?: (url: string) => void;
  onSubmit?: () => void;
  isRunning?: boolean;
  mode?: 'analysis' | 'help';
}

const EXAMPLE_URLS = [
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/HTML' },
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'MDN Docs', url: 'https://developer.mozilla.org' },
];

function getUrlHistory(): string[] {
  try {
    const history = localStorage.getItem('docSignalsHistory');
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

function saveToHistory(url: string) {
  try {
    const history = getUrlHistory();
    const updated = [url, ...history.filter(u => u !== url)].slice(0, 5);
    localStorage.setItem('docSignalsHistory', JSON.stringify(updated));
  } catch {}
}

export function HeaderBar({
  url = '',
  onUrlChange,
  onSubmit,
  isRunning = false,
  mode = 'analysis',
}: HeaderBarProps) {
  const navigate = useNavigate();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(getUrlHistory());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (url && !isRunning) {
          onSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [url, isRunning, onSubmit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (url && onSubmit) {
      saveToHistory(url);
      setHistory(getUrlHistory());
      onSubmit();
      setShowSuggestions(false);
    }
  }

  function selectUrl(selectedUrl: string) {
    onUrlChange?.(selectedUrl);
    setShowSuggestions(false);
  }

  function handleHelpClick() {
    if (mode === 'help') {
      navigate('/');
    } else {
      navigate('/help');
    }
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5">
        {/* App shell: brand + action on same row at md+ */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Brand block: name and claim inline */}
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-indigo-600">
              DocSignals
            </h1>
            <span>|</span>
            <span className="hidden text-sm text-gray-400 sm:inline">
              Structural signals for machine interpretability
            </span>
          </div>

          {/* Action area */}
          <div className="flex items-center gap-2 flex-1 md:max-w-md md:flex-initial">
            {mode === 'analysis' && onUrlChange && onSubmit ? (
              <form onSubmit={handleSubmit} className="flex-1 md:flex-initial">
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1 md:w-64">
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => onUrlChange(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="https://example.com"
                        className="w-full rounded-lg bg-gray-50 px-3 py-2 pr-16 text-sm text-gray-900 ring-1 ring-gray-200/80 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-gray-300"
                      />
                      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">
                        ⌘↵
                      </kbd>
                    </div>
                    <button
                      type="submit"
                      disabled={isRunning || !url}
                      className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isRunning ? 'Analyzing...' : 'Analyze'}
                    </button>
                    <button
                      type="button"
                      onClick={handleHelpClick}
                      className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-600 ring-1 ring-indigo-600 hover:bg-indigo-50"
                    >
                      Help
                    </button>
                  </div>

                  {/* Suggestions dropdown */}
                  {showSuggestions && (history.length > 0 || EXAMPLE_URLS.length > 0) && (
                    <div className="absolute left-0 right-12 top-full z-10 mt-1 rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5">
                      {history.length > 0 && (
                        <div className="px-2 py-1">
                          <p className="mb-1 px-2 text-xs font-medium text-gray-400">Recent</p>
                          {history.map((historyUrl) => (
                            <button
                              key={historyUrl}
                              type="button"
                              onClick={() => selectUrl(historyUrl)}
                              className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {historyUrl}
                            </button>
                          ))}
                        </div>
                      )}
                      {EXAMPLE_URLS.length > 0 && (
                        <div className="border-t border-gray-100 px-2 py-1">
                          <p className="mb-1 px-2 text-xs font-medium text-gray-400">Examples</p>
                          {EXAMPLE_URLS.map((example) => (
                            <button
                              key={example.url}
                              type="button"
                              onClick={() => selectUrl(example.url)}
                              className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <span className="font-medium">{example.label}</span>
                              <span className="ml-2 text-xs text-gray-400">{example.url}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={handleHelpClick}
                className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-600 ring-1 ring-indigo-600 hover:bg-indigo-50"
              >
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
