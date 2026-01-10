import { useState, useMemo } from 'react';
import { HeaderBar } from './HeaderBar';
import { FooterNote } from './FooterNote';

interface HelpEntry {
  term: string;
  category: string;
  shortDescription: string;
  longDescription: string;
  example?: string;
  goodValue?: string;
  badValue?: string;
}

const helpEntries: HelpEntry[] = [
  // Structure
  {
    term: 'Structure Consistency',
    category: 'Structure',
    shortDescription: 'How consistent is the HTML structure across repeated visits?',
    longDescription: 'DevSignals fetches a page multiple times and compares the HTML structure. When the structure is identical on each fetch, machines (crawlers, screen readers, etc.) can reliably process the page. Variable structure can lead to inconsistent results.',
    example: 'A page with randomly positioned ad banners has different structure on each fetch.',
    goodValue: 'Deterministic (identical across multiple fetches)',
    badValue: 'Non-deterministic (different structure on each fetch)',
  },
  {
    term: 'Structure Depth',
    category: 'Structure',
    shortDescription: 'How deeply are HTML elements nested?',
    longDescription: 'Maximum nesting depth shows how many layers of HTML elements are nested inside each other. Deep nesting (>15 levels) can complicate parsing and may indicate overly complex layouts.',
    example: '<div><div><div><span>Text</span></div></div></div> has a depth of 4.',
    goodValue: 'Under 10 levels',
    badValue: 'Over 15 levels',
  },
  {
    term: 'Structure Sections',
    category: 'Structure',
    shortDescription: 'How many main sections does the page have at the top level?',
    longDescription: 'Top-level sections are direct children of the <body> element or <main> area. Clear sections help machines quickly grasp the page structure and identify important regions.',
    goodValue: '3 or more clearly defined sections',
    badValue: 'No recognizable segmentation',
  },
  {
    term: 'Shadow DOM',
    category: 'Structure',
    shortDescription: 'Are Web Components with encapsulated DOM used?',
    longDescription: 'Shadow DOM is a technique used by Web Components that "hides" parts of the DOM. Content inside Shadow DOM is not visible to standard DOM traversal methods, which can challenge crawlers and screen readers.',
    example: '<my-widget> with Shadow Root contains content that document.querySelector cannot find.',
  },

  // Semantic Headings
  {
    term: 'Semantic Headings',
    category: 'Semantics',
    shortDescription: 'How is the heading hierarchy structured?',
    longDescription: 'Headings (H1-H6) structure content hierarchically. A well-structured page has exactly one H1 as the main heading and follows a logical sequence without skips (e.g., H2 after H1, not H4 after H1).',
    example: 'H1 → H2 → H3 → H2 → H3 is correct. H1 → H3 → H2 has a skip.',
    goodValue: '1 H1, sequential hierarchy without skips',
    badValue: 'No H1, multiple H1s, or skips in hierarchy',
  },
  {
    term: 'H1 Element',
    category: 'Semantics',
    shortDescription: 'The main heading of a page',
    longDescription: 'The H1 element should describe the main title or topic of the page. It should appear only once per page. Multiple H1s or a missing H1 make it harder for machines to identify the main topic.',
    goodValue: 'Exactly 1 H1 per page',
    badValue: 'No H1 or multiple H1s',
  },
  {
    term: 'Heading Hierarchy Gaps',
    category: 'Semantics',
    shortDescription: 'Are heading levels skipped?',
    longDescription: 'A skip occurs when, for example, an H4 follows directly after an H2 (H3 is missing). This can hinder navigation with screen readers and break the logical document structure.',
    example: 'H1 → H2 → H4 skips H3.',
  },

  // Landmarks
  {
    term: 'Semantic Landmarks',
    category: 'Semantics',
    shortDescription: 'How much content is within semantic regions?',
    longDescription: 'Landmark elements like <main>, <nav>, <header>, <footer>, <aside>, and <article> mark important page regions. A high percentage of content within these regions enables better navigation and content extraction.',
    example: '<main>Main content</main><aside>Sidebar</aside>',
    goodValue: '80% or more content in landmarks',
    badValue: 'Under 50% in landmarks',
  },
  {
    term: 'main',
    category: 'Landmarks',
    shortDescription: 'Main content of the page',
    longDescription: 'The <main> element contains the central content of a page, excluding repeated elements like navigation or footer. Screen readers can jump directly to the main content.',
  },
  {
    term: 'nav',
    category: 'Landmarks',
    shortDescription: 'Navigation area',
    longDescription: 'The <nav> element marks areas with navigation links. This allows screen reader users to skip navigation or target it specifically.',
  },
  {
    term: 'header',
    category: 'Landmarks',
    shortDescription: 'Header area of page or section',
    longDescription: 'The <header> element contains introductory content or navigation links. In the context of <body>, it represents the page header.',
  },
  {
    term: 'footer',
    category: 'Landmarks',
    shortDescription: 'Footer area of page or section',
    longDescription: 'The <footer> element typically contains copyright information, links to legal documents, or contact information.',
  },
  {
    term: 'aside',
    category: 'Landmarks',
    shortDescription: 'Supplementary content (sidebar)',
    longDescription: 'The <aside> element contains content related to the main content but that could also stand alone – e.g., sidebars, pull-quotes, or advertisements.',
  },
  {
    term: 'article',
    category: 'Landmarks',
    shortDescription: 'Self-contained, reusable content',
    longDescription: 'The <article> element wraps self-contained content like blog posts, news articles, or comments that would make sense outside the current context.',
  },

  // Semantic Markup
  {
    term: 'Semantic Markup',
    category: 'Semantics',
    shortDescription: 'Ratio of generic to semantic elements',
    longDescription: 'The proportion of <div> and <span> (generic containers without meaning) compared to semantic elements. A high proportion of generic containers means meaning must be derived from class names or visual styling.',
    goodValue: 'Under 40% generic containers',
    badValue: 'Over 60% generic containers',
  },
  {
    term: 'Generic Containers',
    category: 'Semantics',
    shortDescription: 'div and span elements',
    longDescription: '<div> and <span> are generic containers without inherent semantic meaning. They are useful for styling, but semantic alternatives should be used where possible for machine readability.',
    example: 'Instead of <div class="nav">, use <nav>',
  },

  // Links
  {
    term: 'Semantic Links',
    category: 'Semantics',
    shortDescription: 'Do links have descriptive labels?',
    longDescription: 'Links should be understandable from their text alone. "Click here" or "More" are not descriptive. Screen reader users often navigate through a list of all links – these must be understandable without context.',
    example: '"Download product catalog" instead of "Click here"',
    goodValue: 'All links have descriptive text',
    badValue: 'Links with "click here", "more", or empty text',
  },
  {
    term: 'Non-descriptive Links',
    category: 'Semantics',
    shortDescription: 'Links without clear purpose',
    longDescription: 'Non-descriptive links include: empty links, links with generic text like "here", "more", "read more", or javascript: links. These hinder navigation and comprehension.',
  },

  // Time
  {
    term: 'Semantic Time',
    category: 'Semantics',
    shortDescription: 'Are dates marked up for machine readability?',
    longDescription: 'The <time> element with datetime attribute makes dates machine-readable. "January 3, 2024" can have many formats – datetime="2024-01-03" is unambiguous.',
    example: '<time datetime="2024-01-03">January 3, 2024</time>',
    goodValue: 'All time elements have datetime attribute',
    badValue: 'time without datetime or only plain text dates',
  },

  // Lists
  {
    term: 'Semantic Lists',
    category: 'Semantics',
    shortDescription: 'Are enumerations marked up as lists?',
    longDescription: 'HTML provides <ul> (unordered), <ol> (numbered), and <dl> (definition lists). This markup allows machines to recognize list items and announce the count.',
    example: '<ul><li>Item 1</li><li>Item 2</li></ul>',
  },

  // Tables
  {
    term: 'Semantic Tables',
    category: 'Semantics',
    shortDescription: 'Do tables have header markup?',
    longDescription: 'Tables should use <thead> or <th> elements to identify column or row headers. Without this markup, machines cannot distinguish between labels and data.',
    example: '<table><thead><tr><th>Name</th><th>Price</th></tr></thead>...</table>',
    goodValue: 'All data tables with <th> or <thead>',
    badValue: 'Tables without header markup',
  },

  // Language
  {
    term: 'Semantic Language',
    category: 'Semantics',
    shortDescription: 'Is the document language declared?',
    longDescription: 'The lang attribute on <html> (e.g., lang="en") tells browsers and screen readers the language. This enables correct pronunciation, hyphenation, and text processing.',
    example: '<html lang="en">',
    goodValue: 'lang attribute present',
    badValue: 'No lang attribute',
  },

  // Images
  {
    term: 'Image Accessibility',
    category: 'Images',
    shortDescription: 'Do images have alt text?',
    longDescription: 'The alt attribute describes image content for screen readers and displays when images fail to load. An empty alt="" marks an image as decorative (no content). Missing alt leaves machines uncertain.',
    example: '<img src="photo.jpg" alt="Team photo at the holiday party">',
    goodValue: 'All images have alt attribute',
    badValue: 'Images without alt attribute',
  },
  {
    term: 'Image Context',
    category: 'Images',
    shortDescription: 'Are images embedded in figure elements?',
    longDescription: 'The <figure> element with optional <figcaption> semantically groups an image with its caption. This helps machines understand the relationship between image and caption.',
    example: '<figure><img src="chart.png" alt="..."><figcaption>Revenue growth 2023</figcaption></figure>',
  },
  {
    term: 'Decorative Images',
    category: 'Images',
    shortDescription: 'Images without informational meaning',
    longDescription: 'Decorative images (backgrounds, dividers, icons without information) should have alt="". This tells screen readers they can be skipped.',
    example: '<img src="decorative-line.png" alt="">',
  },

  // Classifications
  {
    term: 'Deterministic',
    category: 'Classification',
    shortDescription: 'Structure is identical on each fetch',
    longDescription: 'A deterministic structure means the HTML output remains the same across repeated visits. This is ideal for crawlers and machine processing.',
  },
  {
    term: 'Mostly Deterministic',
    category: 'Classification',
    shortDescription: 'Structure is mostly stable with minor variations',
    longDescription: 'With mostly deterministic structure, there are only small differences between fetches – e.g., timestamps or session IDs. The core structure remains stable.',
  },
  {
    term: 'Non-Deterministic',
    category: 'Classification',
    shortDescription: 'Structure varies significantly between fetches',
    longDescription: 'With non-deterministic structure, the HTML layout changes substantially between fetches. This can be caused by A/B tests, personalized content, or dynamic components.',
  },
  {
    term: 'Explicit',
    category: 'Classification',
    shortDescription: 'High semantic quality',
    longDescription: 'An "explicit" semantic rating means: good heading structure, high landmark coverage, few generic containers, and descriptive links. Machines can understand the page well.',
  },
  {
    term: 'Partial',
    category: 'Classification',
    shortDescription: 'Medium semantic quality',
    longDescription: 'With "partial" semantics, some best practices are implemented, but there is room for improvement. Machines can partially process the page well.',
  },
  {
    term: 'Opaque',
    category: 'Classification',
    shortDescription: 'Low semantic quality',
    longDescription: 'An "opaque" rating indicates missing semantic structure. Machines must use heuristics and visual analysis to understand the content.',
  },
];

const categories = [...new Set(helpEntries.map((e) => e.category))];

export function HelpPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    let entries = helpEntries;

    if (selectedCategory) {
      entries = entries.filter((e) => e.category === selectedCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.term.toLowerCase().includes(q) ||
          e.shortDescription.toLowerCase().includes(q) ||
          e.longDescription.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }

    return entries;
  }, [search, selectedCategory]);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, HelpEntry[]> = {};
    for (const entry of filteredEntries) {
      if (!groups[entry.category]) {
        groups[entry.category] = [];
      }
      groups[entry.category].push(entry);
    }
    return groups;
  }, [filteredEntries]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <HeaderBar mode="help" />

      {/* Main content */}
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-8 sm:space-y-10">
          {/* Page title row - same style as Analysis Results / Comparing URLs */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Help
              <span className="ml-2 text-sm font-normal text-gray-500">
                Glossary & Documentation
              </span>
            </h2>
          </div>

          {/* Search + Category filters */}
          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search terms..."
                className="w-full rounded-lg bg-white px-3 py-2.5 pl-10 text-sm text-gray-900 shadow-sm ring-1 ring-gray-200/80 placeholder:text-gray-400 focus:outline-none focus:ring-gray-300"
              />
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filters row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-400">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} found
              </p>

              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCategory === null
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Entries */}
          {Object.keys(groupedEntries).length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200/60">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-4 text-sm text-gray-500">No entries found for "{search}"</p>
              <button
                onClick={() => { setSearch(''); setSelectedCategory(null); }}
                className="mt-3 text-xs text-indigo-600 hover:text-indigo-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedEntries).map(([category, entries]) => (
                <div key={category} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {category}
                  </h2>
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div
                        key={entry.term}
                        className="rounded-lg bg-gray-50/80 ring-1 ring-gray-200/40 overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedTerm(expandedTerm === entry.term ? null : entry.term)}
                          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-100/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-gray-900">{entry.term}</span>
                            <span className="ml-2 text-sm text-gray-500 hidden sm:inline">— {entry.shortDescription}</span>
                            <p className="text-sm text-gray-500 sm:hidden mt-0.5">{entry.shortDescription}</p>
                          </div>
                          <svg
                            className={`ml-2 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${
                              expandedTerm === entry.term ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expandedTerm === entry.term && (
                          <div className="border-t border-gray-200/60 px-4 py-4 bg-white">
                            <p className="text-sm text-gray-700 leading-relaxed">{entry.longDescription}</p>

                            {entry.example && (
                              <div className="mt-4">
                                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                  Example
                                </span>
                                <pre className="mt-1.5 text-xs text-gray-600 font-mono bg-slate-50 rounded-lg px-3 py-2 overflow-x-auto ring-1 ring-slate-200/60">
                                  {entry.example}
                                </pre>
                              </div>
                            )}

                            {(entry.goodValue || entry.badValue) && (
                              <div className="mt-4 flex flex-wrap gap-4">
                                {entry.goodValue && (
                                  <div className="flex items-start gap-2">
                                    <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 flex-shrink-0">
                                      <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </span>
                                    <span className="text-xs text-gray-600">{entry.goodValue}</span>
                                  </div>
                                )}
                                {entry.badValue && (
                                  <div className="flex items-start gap-2">
                                    <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-600 flex-shrink-0">
                                      <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                          fillRule="evenodd"
                                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </span>
                                    <span className="text-xs text-gray-600">{entry.badValue}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <FooterNote />
        </div>
      </main>
    </div>
  );
}
