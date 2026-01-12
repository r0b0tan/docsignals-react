import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    longDescription:
      'DocSignals fetches the same URL multiple times and compares the resulting DOM tree shape (e.g., element nesting, tag sequence, and the presence/absence of structural nodes). If repeated fetches yield an effectively identical structure, downstream automation—such as crawlers, content extractors, test automation, and assistive-tech mappings—can rely on stable selectors and a stable reading order. If the structure changes between requests (e.g., due to personalization, A/B tests, geo-variation, rotating ad slots, or client-side rendering differences), identical queries can return different nodes or different content regions, leading to brittle extraction and inconsistent interpretation.',
    example: 'A page with randomly positioned ad banners has different structure on each fetch.',
    goodValue: 'Deterministic (identical across multiple fetches)',
    badValue: 'Non-deterministic (different structure on each fetch)',
  },
  {
    term: 'Structure Depth',
    category: 'Structure',
    shortDescription: 'How deeply are HTML elements nested?',
    longDescription:
      'Structure depth refers to the maximum nesting level of elements in the parsed DOM (i.e., the longest ancestor chain from the document root to any element). Very deep trees are harder to reason about, often correlate with over-wrapped layouts (excess <div>/<span> layers), and can increase complexity for traversal algorithms (querying, diffing, accessibility mapping). In practice, extreme depth can also be a signal of heavy component nesting or framework-generated wrappers, which may reduce robustness of selectors and complicate segmentation.',
    example: '<div><div><div><span>Text</span></div></div></div> has a depth of 4.',
    goodValue: 'Under 10 levels',
    badValue: 'Over 15 levels',
  },
  {
    term: 'Structure Sections',
    category: 'Structure',
    shortDescription: 'How many main sections does the page have at the top level?',
    longDescription:
      'This signal approximates whether the page exposes a clear, machine-discernible “layout skeleton”. DocSignals looks for high-level regions that segment the document (commonly direct children of <body> and/or primary containers like <main>). A small number of well-defined sections (e.g., header, navigation, main content, sidebar, footer) makes it easier for machines to isolate primary content, ignore boilerplate, and establish a stable reading order. Pages that present one monolithic container or many unstructured siblings are harder to segment reliably.',
    goodValue: '3 or more clearly defined sections',
    badValue: 'No recognizable segmentation',
  },
  {
    term: 'Shadow DOM',
    category: 'Structure',
    shortDescription: 'Are Web Components with encapsulated DOM used?',
    longDescription:
      'Shadow DOM encapsulates a subtree behind a shadow root. While this is beneficial for component isolation, it can reduce visibility for tools that only traverse the light DOM. Depending on whether shadow roots are open/closed and how content is projected (slots), crawlers, DOM-based extractors, and some accessibility tooling may miss or misattribute content unless they explicitly traverse the composed tree. Heavy reliance on Shadow DOM can therefore make content discovery and structural analysis less straightforward.',
    example: '<my-widget> with Shadow Root contains content that document.querySelector cannot find.',
  },

  // Semantic Headings
  {
    term: 'Semantic Headings',
    category: 'Semantics',
    shortDescription: 'How is the heading hierarchy structured?',
    longDescription:
      'Heading elements (H1–H6) define a document outline that both assistive technologies and automated parsers use to navigate and summarize content. A technically strong heading structure typically includes a single primary H1 for the page/topic and a monotonic, non-skipping hierarchy for subsequent sections (e.g., H2 for major sections, H3 for subsections). Skips (e.g., jumping from H2 to H4) and multiple competing H1s degrade outline quality, making navigation, summarization, and section extraction less reliable.',
    example: 'H1 → H2 → H3 → H2 → H3 is correct. H1 → H3 → H2 has a skip.',
    goodValue: '1 H1, sequential hierarchy without skips',
    badValue: 'No H1, multiple H1s, or skips in hierarchy',
  },
  {
    term: 'H1 Element',
    category: 'Semantics',
    shortDescription: 'The main heading of a page',
    longDescription:
      'The H1 should represent the primary topic/title of the document as presented to users. Many tooling pipelines (search, summarizers, accessibility navigation) treat the H1 as the top-level anchor for understanding “what this page is about”. Missing H1s force heuristics (e.g., largest text, logo, title tag), and multiple H1s can introduce ambiguity about the primary topic, especially on pages that are aggregations or dashboards.',
    goodValue: 'Exactly 1 H1 per page',
    badValue: 'No H1 or multiple H1s',
  },
  {
    term: 'Heading Hierarchy Gaps',
    category: 'Semantics',
    shortDescription: 'Are heading levels skipped?',
    longDescription:
      'A hierarchy gap occurs when heading levels jump by more than one step (e.g., H2 directly followed by H4). Technically, this breaks the implied outline structure and can confuse screen-reader “heading navigation” as well as automated sectioning algorithms. Gaps often indicate visual styling being used in place of semantic structure (e.g., choosing H4 for smaller font size instead of using CSS on the correct level).',
    example: 'H1 → H2 → H4 skips H3.',
  },

  // Landmarks
  {
    term: 'Semantic Landmarks',
    category: 'Semantics',
    shortDescription: 'How much content is within semantic regions?',
    longDescription:
      'Landmark elements (<main>, <nav>, <header>, <footer>, <aside>, <article>) and equivalent ARIA landmark roles create navigational regions in the accessibility tree. When most meaningful content is placed inside these regions, assistive technologies can offer region-jump shortcuts, and automated extractors can distinguish primary content from boilerplate more reliably. Low landmark coverage usually means the page relies on generic containers, requiring heuristics to infer region semantics from class names or layout.',
    example: '<main>Main content</main><aside>Sidebar</aside>',
    goodValue: '80% or more content in landmarks',
    badValue: 'Under 50% in landmarks',
  },
  {
    term: 'main',
    category: 'Landmarks',
    shortDescription: 'Main content of the page',
    longDescription:
      'The <main> element identifies the dominant content of the document. It should exclude repeated UI such as site navigation, header chrome, and footer links. In accessibility APIs, <main> typically maps to the “main” landmark, enabling quick navigation and improving extraction of the central article/product/page content.',
  },
  {
    term: 'nav',
    category: 'Landmarks',
    shortDescription: 'Navigation area',
    longDescription:
      'The <nav> element indicates a section that provides navigation links (site navigation, table of contents, pagination). Marking navigation explicitly helps assistive technologies allow users to skip or target navigation regions, and helps automated systems separate boilerplate navigation from unique page content.',
  },
  {
    term: 'header',
    category: 'Landmarks',
    shortDescription: 'Header area of page or section',
    longDescription:
      'The <header> element contains introductory content for the nearest sectioning root (or the page when used under <body>). It commonly contains branding, headings, and navigation. Correct use clarifies structure without relying on visual layout and can improve region-based navigation in the accessibility tree.',
  },
  {
    term: 'footer',
    category: 'Landmarks',
    shortDescription: 'Footer area of page or section',
    longDescription:
      'The <footer> element identifies concluding content for the nearest sectioning root (or the page). Typical content includes legal links, secondary navigation, contact info, and related resources. Explicit footers help tools categorize and potentially de-prioritize boilerplate content during extraction.',
  },
  {
    term: 'aside',
    category: 'Landmarks',
    shortDescription: 'Supplementary content (sidebar)',
    longDescription:
      'The <aside> element represents tangential or complementary content (sidebars, related links, callouts). Properly marking asides helps machines avoid conflating secondary content with the primary narrative, and helps assistive technologies provide region navigation semantics.',
  },
  {
    term: 'article',
    category: 'Landmarks',
    shortDescription: 'Self-contained, reusable content',
    longDescription:
      'The <article> element marks a self-contained unit that could be independently distributed or reused (e.g., a blog post, news item, comment). For machine processing, articles are useful boundaries for chunking, summarization, indexing, and repeated-layout pages that contain multiple independent content blocks.',
  },

  // Semantic Markup
  {
    term: 'Semantic Markup',
    category: 'Semantics',
    shortDescription: 'Ratio of generic to semantic elements',
    longDescription:
      'This signal estimates how much of the document is expressed with generic containers (<div>/<span>) versus semantic elements (e.g., <main>, <nav>, <section>, <article>, <button>, <time>, headings). Semantic elements provide intrinsic meaning that is reflected in the accessibility tree and is easier to interpret programmatically. A high generic ratio typically means meaning is encoded only via CSS and class names, which is more brittle for crawlers, readers, and downstream extraction pipelines.',
    goodValue: 'Under 40% generic containers',
    badValue: 'Over 60% generic containers',
  },
  {
    term: 'Generic Containers',
    category: 'Semantics',
    shortDescription: 'div and span elements',
    longDescription:
      '<div> and <span> are semantically neutral. They are appropriate for grouping and styling, but overuse can remove explicit meaning from the markup. When important regions or controls are built from generic containers, machines must infer intent from attributes, classes, and event handlers, which is less reliable than using purpose-built elements (or correct ARIA roles when necessary).',
    example: 'Instead of <div class="nav">, use <nav>',
  },

  // Links
  {
    term: 'Semantic Links',
    category: 'Semantics',
    shortDescription: 'Do links have descriptive labels?',
    longDescription:
      'Link text (and more generally, the accessible name of interactive elements) should communicate destination or action without requiring surrounding context. Many assistive-technology users navigate by listing links; similarly, extractors often treat anchor text as a label for the target resource. Generic labels like “Click here”, “More”, or icon-only links without accessible names reduce usability and degrade machine interpretability.',
    example: '"Download product catalog" instead of "Click here"',
    goodValue: 'All links have descriptive text',
    badValue: 'Links with "click here", "more", or empty text',
  },
  {
    term: 'Non-descriptive Links',
    category: 'Semantics',
    shortDescription: 'Links without clear purpose',
    longDescription:
      'Non-descriptive links include anchors with empty/whitespace text, vague labels (e.g., “here”, “more”, “read more”), or links that do not represent real navigation (e.g., javascript: pseudo-links). These patterns degrade keyboard/screen-reader navigation and reduce the signal quality for crawlers and summarizers that rely on link labels to infer structure and intent.',
  },

  // Time
  {
    term: 'Semantic Time',
    category: 'Semantics',
    shortDescription: 'Are dates marked up for machine readability?',
    longDescription:
      'Using <time> with a valid datetime attribute provides an unambiguous, machine-parseable representation of dates/times (ISO-8601 recommended). Human-readable strings vary by locale and formatting, but datetime enables consistent parsing for indexing, sorting, timeline extraction, and accessibility tooling that may announce times with locale-appropriate formatting.',
    example: '<time datetime="2024-01-03">January 3, 2024</time>',
    goodValue: 'All time elements have datetime attribute',
    badValue: 'time without datetime or only plain text dates',
  },

  // Lists
  {
    term: 'Semantic Lists',
    category: 'Semantics',
    shortDescription: 'Are enumerations marked up as lists?',
    longDescription:
      'Lists (<ul>, <ol>, <dl>) encode enumeration semantics: item boundaries, count, and (for ordered lists) sequence. This improves screen-reader announcements (e.g., “list of N items”) and makes extraction straightforward (each <li> as an item). Visual bullet points built from <div>s are harder to interpret programmatically and can lose item boundaries.',
    example: '<ul><li>Item 1</li><li>Item 2</li></ul>',
  },

  // Tables
  {
    term: 'Semantic Tables',
    category: 'Semantics',
    shortDescription: 'Do tables have header markup?',
    longDescription:
      'Data tables should identify headers using <th> (optionally grouped in <thead>) so user agents can associate each data cell with its corresponding row/column labels. For complex tables, attributes like scope or headers may be required to disambiguate associations. Without header markup, machines cannot reliably distinguish labels from values, harming accessibility and automated extraction/CSV-style conversion.',
    example: '<table><thead><tr><th>Name</th><th>Price</th></tr></thead>...</table>',
    goodValue: 'All data tables with <th> or <thead>',
    badValue: 'Tables without header markup',
  },

  // Language
  {
    term: 'Semantic Language',
    category: 'Semantics',
    shortDescription: 'Is the document language declared?',
    longDescription:
      'Declaring document language via <html lang="..."> informs browsers and accessibility APIs about the primary language of the content. This enables correct pronunciation, braille translation rules, hyphenation, spellchecking behavior, and language-aware NLP pipelines. Missing or incorrect lang values can cause mispronunciation and reduce quality of language-specific processing.',
    example: '<html lang="en">',
    goodValue: 'lang attribute present',
    badValue: 'No lang attribute',
  },

  // Images
  {
    term: 'Image Accessibility',
    category: 'Images',
    shortDescription: 'Do images have alt text?',
    longDescription:
      'The alt attribute provides the textual alternative used by screen readers and by tools that cannot or do not load images. Informative images should have meaningful alt text; purely decorative images should use alt="" so they are skipped. Missing alt reduces accessibility and forces machines to guess meaning from filenames or surrounding text.',
    example: '<img src="photo.jpg" alt="Team photo at the holiday party">',
    goodValue: 'All images have alt attribute',
    badValue: 'Images without alt attribute',
  },
  {
    term: 'Image Context',
    category: 'Images',
    shortDescription: 'Are images embedded in figure elements?',
    longDescription:
      '<figure> provides a semantic container that groups media with an optional <figcaption>. This explicitly binds a caption/description to the image, which helps machines understand what text describes what media, improves extraction of “image + caption” pairs, and clarifies boundaries compared to loosely positioned captions in generic containers.',
    example: '<figure><img src="chart.png" alt="..."><figcaption>Revenue growth 2023</figcaption></figure>',
  },
  {
    term: 'Decorative Images',
    category: 'Images',
    shortDescription: 'Images without informational meaning',
    longDescription:
      'Decorative images convey no content (e.g., separators, background flourishes, purely aesthetic icons). Marking them with alt="" prevents redundant or noisy announcements in screen readers and reduces false positives for systems extracting “meaningful images”. If an icon conveys meaning (e.g., “Warning”), it should not be treated as decorative.',
    example: '<img src="decorative-line.png" alt="">',
  },

  // Classifications
  {
    term: 'Deterministic',
    category: 'Classification',
    shortDescription: 'Structure is identical on each fetch',
    longDescription:
      '“Deterministic” means repeated requests produce structurally equivalent HTML/DOM: the same major regions, stable element nesting, and stable node presence. Minor differences that do not affect structure (e.g., cache headers) are not relevant, but DOM-level changes usually indicate runtime variability. Determinism improves reliability of selectors, diffing, automated testing, and machine extraction.',
  },
  {
    term: 'Mostly Deterministic',
    category: 'Classification',
    shortDescription: 'Structure is mostly stable with minor variations',
    longDescription:
      '“Mostly deterministic” indicates the page’s core layout is stable, but small, localized variability exists across fetches (e.g., timestamps, rotating IDs, small recommendation modules). For machines, this usually means primary content can be extracted reliably, but strict DOM diffs or brittle selectors may still fail unless variability is accounted for (normalization, robust selectors, ignoring volatile regions).',
  },
  {
    term: 'Non-Deterministic',
    category: 'Classification',
    shortDescription: 'Structure varies significantly between fetches',
    longDescription:
      '“Non-deterministic” indicates substantial DOM structure changes across repeated fetches (not just text changes): sections appear/disappear, order changes, or component trees differ. Common causes include A/B experiments, personalization, geo/device adaptation, ad auctions, or client-side rendering that depends on runtime state. This materially increases the difficulty of stable extraction, regression testing, and consistent interpretation.',
  },
  {
    term: 'Explicit',
    category: 'Classification',
    shortDescription: 'High semantic quality',
    longDescription:
      '“Explicit” means the document encodes intent in markup rather than relying on styling and heuristics: a clear heading outline (one H1 and logical levels), broad use of landmark regions, descriptive link text / accessible names, and appropriate semantic elements for lists, tables, and time. As a result, both accessibility tooling and automated parsers can locate and interpret core content with minimal guessing.',
  },
  {
    term: 'Partial',
    category: 'Classification',
    shortDescription: 'Medium semantic quality',
    longDescription:
      '“Partial” indicates some semantic best practices are present, but gaps remain (e.g., landmarks exist but coverage is incomplete, headings are mostly correct but contain skips, links are mixed quality, or generic containers dominate certain regions). Machines can often extract key content, but with reduced confidence and more reliance on heuristics compared to an “explicit” page.',
  },
  {
    term: 'Opaque',
    category: 'Classification',
    shortDescription: 'Low semantic quality',
    longDescription:
      '“Opaque” indicates that little meaning is expressed via semantic HTML/ARIA patterns: structure is dominated by generic wrappers, landmarks/headings are missing or inconsistent, and interactive/navigation elements may not have reliable accessible names. In this state, automated systems typically must infer intent from fragile signals (CSS classes, visual layout, text proximity, click handlers), which is error-prone and can break easily when markup or styling changes.',
  },
  // Accessibility
  {
    term: 'ARIA Labels',
    category: 'Accessibility',
    shortDescription: 'Accessible names for interactive elements',
    longDescription:
      'ARIA labels (aria-label, aria-labelledby) provide accessible names for elements that lack visible text or have ambiguous labels. Screen readers and other assistive technologies use these to announce what an element does. Missing or generic ARIA labels (e.g., "button", "link") make it difficult for users and automated tools to understand the purpose of interactive elements.',
    example: '<button aria-label="Close dialog">×</button>',
    goodValue: 'All interactive elements have meaningful labels',
    badValue: 'Generic or missing labels on buttons/links',
  },
  {
    term: 'Focus Order',
    category: 'Accessibility',
    shortDescription: 'Logical keyboard navigation sequence',
    longDescription:
      'Focus order determines the sequence in which focusable elements receive keyboard focus when users press Tab. A logical focus order follows the visual reading order and allows keyboard-only users to navigate efficiently. Disrupted focus order (e.g., from CSS reordering, incorrect tabindex values) creates confusion and accessibility barriers.',
    goodValue: 'Focus follows visual/reading order',
    badValue: 'Focus jumps unexpectedly or skips elements',
  },
  {
    term: 'Skip Links',
    category: 'Accessibility',
    shortDescription: 'Shortcuts to bypass repetitive content',
    longDescription:
      'Skip links allow keyboard users to jump directly to main content, bypassing navigation menus and other repeated elements. They are typically hidden until focused and are essential for efficient keyboard navigation on content-heavy pages.',
    example: '<a href="#main-content" class="skip-link">Skip to main content</a>',
    goodValue: 'Skip link present and functional',
    badValue: 'No skip link; users must tab through all navigation',
  },
  {
    term: 'Color Contrast',
    category: 'Accessibility',
    shortDescription: 'Text readability against background',
    longDescription:
      'Color contrast ratio measures the difference in luminance between foreground text and background. WCAG 2.1 requires a minimum ratio of 4.5:1 for normal text and 3:1 for large text. Insufficient contrast makes content difficult to read for users with low vision or color blindness, and can affect automated text extraction accuracy.',
    goodValue: '4.5:1 or higher for body text',
    badValue: 'Below 3:1 contrast ratio',
  },

  // Links
  {
    term: 'Link Quality',
    category: 'Links',
    shortDescription: 'How descriptive are link texts?',
    longDescription:
      'Link quality measures whether anchor text clearly describes the destination or action. Descriptive links ("Read our privacy policy") help users and machines understand context without reading surrounding text. Generic links ("click here", "read more") provide no context and require additional heuristics to determine purpose.',
    example: '"View product details" vs "Click here"',
    goodValue: 'Descriptive, context-independent anchor text',
    badValue: 'Generic text like "click here" or "learn more"',
  },
  {
    term: 'Internal Links',
    category: 'Links',
    shortDescription: 'Links pointing to the same domain',
    longDescription:
      'Internal links connect pages within the same website and help establish site structure and navigation patterns. A healthy internal link structure aids both users and crawlers in discovering content. Broken internal links or orphaned pages indicate structural issues.',
    goodValue: 'Well-connected pages with logical hierarchy',
    badValue: 'Broken links or isolated pages',
  },
  {
    term: 'External Links',
    category: 'Links',
    shortDescription: 'Links pointing to other domains',
    longDescription:
      'External links reference resources on other websites. They should have clear indication of leaving the site (e.g., icon, text) and appropriate rel attributes (noopener, noreferrer for security). The presence and quality of external links can signal content credibility and context.',
    example: '<a href="https://example.com" rel="noopener" target="_blank">',
    goodValue: 'Clearly marked with security attributes',
    badValue: 'No indication of external navigation',
  },
  {
    term: 'Anchor Fragments',
    category: 'Links',
    shortDescription: 'Links to specific page sections',
    longDescription:
      'Anchor fragments (#section-id) enable deep linking to specific content sections. They improve navigation for long documents and allow external references to precise locations. Missing or broken fragment targets reduce content addressability.',
    example: '<a href="#pricing">Jump to pricing</a>',
    goodValue: 'Fragments link to existing IDs',
    badValue: 'Broken or missing fragment targets',
  },

  // Meta
  {
    term: 'Meta Tags',
    category: 'Meta',
    shortDescription: 'HTML metadata for search and sharing',
    longDescription:
      'Meta tags provide structured information about a page including title, description, viewport settings, and character encoding. These are essential for SEO, social sharing, and proper rendering across devices. Missing or duplicate meta tags can affect search visibility and user experience.',
    example: '<meta name="description" content="Page summary...">',
    goodValue: 'Complete, unique meta tags per page',
    badValue: 'Missing or duplicate descriptions',
  },
  {
    term: 'Open Graph',
    category: 'Meta',
    shortDescription: 'Social media preview metadata',
    longDescription:
      'Open Graph (og:) meta tags control how pages appear when shared on social platforms like Facebook, LinkedIn, and Twitter. They define the title, description, image, and URL shown in previews. Missing OG tags result in unpredictable or unappealing social previews.',
    example: '<meta property="og:title" content="Article Title">',
    goodValue: 'Complete OG tags with proper image dimensions',
    badValue: 'Missing or incomplete social metadata',
  },
  {
    term: 'Structured Data',
    category: 'Meta',
    shortDescription: 'Machine-readable content markup (Schema.org)',
    longDescription:
      'Structured data uses Schema.org vocabulary (typically JSON-LD) to explicitly describe content types, properties, and relationships. This enables rich search results, knowledge graph integration, and improved content extraction. Valid structured data significantly improves machine interpretability.',
    example: '<script type="application/ld+json">{"@type": "Article"...}</script>',
    goodValue: 'Valid JSON-LD with appropriate schema types',
    badValue: 'No structured data or validation errors',
  },
  {
    term: 'Canonical URL',
    category: 'Meta',
    shortDescription: 'Preferred URL for duplicate content',
    longDescription:
      'The canonical tag specifies the authoritative URL when content is accessible via multiple URLs (e.g., with/without www, query parameters, pagination). This prevents duplicate content issues in search engines and ensures consistent link attribution.',
    example: '<link rel="canonical" href="https://example.com/page">',
    goodValue: 'Canonical points to correct primary URL',
    badValue: 'Missing or self-referencing incorrectly',
  },

  // Performance
  {
    term: 'Render Blocking',
    category: 'Performance',
    shortDescription: 'Resources that delay page rendering',
    longDescription:
      'Render-blocking resources (synchronous scripts, CSS in <head>) prevent the browser from displaying content until they load and execute. This affects perceived performance and can delay content availability for both users and automated tools. Minimizing blocking resources improves time-to-first-content.',
    example: '<script src="large.js"></script> in <head> blocks rendering',
    goodValue: 'Scripts deferred/async, critical CSS inlined',
    badValue: 'Multiple synchronous scripts blocking render',
  },
  {
    term: 'Lazy Loading',
    category: 'Performance',
    shortDescription: 'Deferred loading of off-screen content',
    longDescription:
      'Lazy loading defers loading of images, iframes, and other resources until they approach the viewport. This improves initial load performance but can affect content discovery if not implemented with proper fallbacks. Native lazy loading (loading="lazy") is preferred over JavaScript solutions.',
    example: '<img src="photo.jpg" loading="lazy" alt="...">',
    goodValue: 'Native lazy loading with proper dimensions',
    badValue: 'JavaScript-only lazy loading without fallbacks',
  },
  {
    term: 'Resource Hints',
    category: 'Performance',
    shortDescription: 'Preload, prefetch, and preconnect directives',
    longDescription:
      'Resource hints (preload, prefetch, preconnect, dns-prefetch) inform browsers about resources needed soon, allowing optimized loading. Proper use improves perceived performance; misuse can waste bandwidth or delay critical resources.',
    example: '<link rel="preload" href="font.woff2" as="font" crossorigin>',
    goodValue: 'Strategic hints for critical resources',
    badValue: 'Over-hinting or missing critical preloads',
  },
  {
    term: 'JavaScript Dependency',
    category: 'Performance',
    shortDescription: 'Content requiring JavaScript to render',
    longDescription:
      'Pages with high JavaScript dependency may show minimal or no content before scripts execute. This affects crawlers, accessibility tools, and users with slow connections or disabled JavaScript. Server-side rendering or progressive enhancement improves baseline accessibility.',
    goodValue: 'Core content visible without JavaScript',
    badValue: 'Blank page or loading spinner without JS',
  },

  // Quality
  {
    term: 'HTML Validity',
    category: 'Quality',
    shortDescription: 'Conformance to HTML specification',
    longDescription:
      'Valid HTML follows the specification without syntax errors, improper nesting, or deprecated elements. While browsers are forgiving, invalid HTML can cause unpredictable rendering and parsing issues for automated tools. Validation errors often indicate maintenance issues.',
    goodValue: 'No critical validation errors',
    badValue: 'Unclosed tags, invalid nesting, deprecated elements',
  },
  {
    term: 'Content-to-Code Ratio',
    category: 'Quality',
    shortDescription: 'Proportion of visible text to HTML markup',
    longDescription:
      'Content-to-code ratio measures meaningful text content versus total HTML size. A low ratio (heavy markup, little content) can indicate bloated templates, excessive wrappers, or sparse pages. While not a strict quality metric, extreme ratios may signal structural issues.',
    goodValue: 'Above 10% text content',
    badValue: 'Below 5% or mostly boilerplate',
  },
  {
    term: 'Duplicate IDs',
    category: 'Quality',
    shortDescription: 'Multiple elements with the same ID',
    longDescription:
      'HTML IDs must be unique within a document. Duplicate IDs break fragment navigation, form label associations, ARIA references, and JavaScript getElementById. They indicate copy-paste issues or template problems and can cause accessibility and functionality bugs.',
    example: 'Two elements with id="submit-btn" on same page',
    goodValue: 'All IDs unique',
    badValue: 'Duplicate IDs present',
  },
  {
    term: 'Empty Elements',
    category: 'Quality',
    shortDescription: 'Elements with no meaningful content',
    longDescription:
      'Empty elements (empty headings, links, buttons, paragraphs) provide no value and can confuse users and automated tools. They often result from conditional rendering issues, template placeholders, or removed content without cleanup.',
    example: '<h2></h2> or <a href="/page"></a>',
    goodValue: 'No empty interactive or semantic elements',
    badValue: 'Multiple empty headings, links, or buttons',
  },];

const categories = [...new Set(helpEntries.map((e) => e.category))];

export function HelpPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <HeaderBar mode="help" />

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="space-y-8 sm:space-y-10">
          {/* Page title row - same style as Analysis Results / Comparing URLs */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
              <h2 className="text-lg font-semibold text-gray-900 py-1">
                Help
              </h2>
              <div className="flex items-center gap-2 py-2">
                <span className="hidden text-gray-300 sm:inline">|</span>
                <span className="text-sm text-gray-500">Glossary & Documentation</span>
              </div>
            </div>
            {/* Search bar + Back button */}
            <div className="flex items-center justify-center gap-3 w-full sm:w-auto sm:ml-6">
              <div className="relative w-56 sm:w-64 sm:flex-initial">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search terms..."
                  className="w-full rounded-lg bg-white px-3 py-2 pl-9 text-sm text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-gray-400"
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
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex h-9 items-center gap-1.5 shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>
            </div>
          </div>

          {/* Category filters */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-400">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} found
            </p>

            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-end">
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
