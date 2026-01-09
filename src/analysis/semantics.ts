import type { SemanticResult } from './types';

const LANDMARK_TAGS = ['main', 'nav', 'header', 'footer', 'aside', 'article'];
const SEMANTIC_TAGS = ['main', 'nav', 'header', 'footer', 'aside', 'article', 'section', 'figure'];
const GENERIC_LINK_TEXT = new Set(['click here', 'here', 'read more', 'more', 'learn more', 'link']);

export function checkSemantics(html: string): SemanticResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Headings
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const levels: number[] = [];
  for (const h of headings) {
    levels.push(parseInt(h.tagName[1], 10));
  }

  const h1Count = levels.filter((l) => l === 1).length;
  let hasSkips = false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      hasSkips = true;
      break;
    }
  }

  // Landmarks
  const found: string[] = [];
  for (const tag of LANDMARK_TAGS) {
    if (doc.querySelector(tag)) {
      found.push(tag);
    }
  }

  const totalText = doc.body?.textContent?.length ?? 1;
  let landmarkText = 0;
  for (const tag of LANDMARK_TAGS) {
    const els = doc.querySelectorAll(tag);
    for (const el of els) {
      landmarkText += el.textContent?.length ?? 0;
    }
  }
  const coveragePercent = Math.round((landmarkText / totalText) * 100);

  // Div ratio
  const divCount = doc.querySelectorAll('div, span').length;
  let semanticCount = 0;
  for (const tag of SEMANTIC_TAGS) {
    semanticCount += doc.querySelectorAll(tag).length;
  }
  const divRatio = divCount / (divCount + semanticCount + 1);

  // Link issues
  const links = doc.querySelectorAll('a');
  let linkIssues = 0;
  for (const link of links) {
    const text = (link.textContent ?? '').trim().toLowerCase();
    const href = link.getAttribute('href') ?? '';

    if (!text && !link.querySelector('img[alt]')) {
      linkIssues++;
    } else if (GENERIC_LINK_TEXT.has(text)) {
      linkIssues++;
    } else if (href.startsWith('javascript:')) {
      linkIssues++;
    }
  }

  // Time elements
  const timeEls = doc.querySelectorAll('time');
  const timeTotal = timeEls.length;
  let timeWithDatetime = 0;
  for (const el of timeEls) {
    if (el.hasAttribute('datetime')) {
      timeWithDatetime++;
    }
  }

  // Lists
  const orderedLists = doc.querySelectorAll('ol').length;
  const unorderedLists = doc.querySelectorAll('ul').length;
  const descriptionLists = doc.querySelectorAll('dl').length;
  const listsTotal = orderedLists + unorderedLists + descriptionLists;

  // Tables
  const tables = doc.querySelectorAll('table');
  const tablesTotal = tables.length;
  let tablesWithHeaders = 0;
  for (const table of tables) {
    if (table.querySelector('thead') || table.querySelector('th')) {
      tablesWithHeaders++;
    }
  }

  // Language attribute
  const htmlEl = doc.documentElement;
  const langAttribute = htmlEl?.hasAttribute('lang') ?? false;

  // Classification
  let score = 0;
  if (h1Count === 1 && !hasSkips) score += 25;
  if (coveragePercent >= 80) score += 30;
  if (divRatio < 0.6) score += 25;
  if (linkIssues === 0) score += 20;

  let classification: SemanticResult['classification'];
  if (score >= 75) {
    classification = 'explicit';
  } else if (score >= 40) {
    classification = 'partial';
  } else {
    classification = 'opaque';
  }

  return {
    classification,
    headings: { h1Count, hasSkips },
    landmarks: { found, coveragePercent },
    divRatio,
    linkIssues,
    timeElements: { total: timeTotal, withDatetime: timeWithDatetime },
    lists: { total: listsTotal, ordered: orderedLists, unordered: unorderedLists, description: descriptionLists },
    tables: { total: tablesTotal, withHeaders: tablesWithHeaders },
    langAttribute,
  };
}
