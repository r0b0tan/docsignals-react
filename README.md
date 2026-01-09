# DocSignals

> **Structural and semantic signals for machine interpretability**

DocSignals is a React-based frontend for analyzing and rendering
structural and semantic signals in HTML documents as they are traversed by machines.

It exposes measurable signals about document consistency, segmentation,
and semantic explicitness — without scoring, ranking, or content evaluation.

---

## What DocSignals is

DocSignals is a document analysis tool that:

- measures **structural properties** of HTML documents
- detects **semantic signals encoded in markup**
- makes **no quality judgments**
- separates **measurement** from **interpretation**

It does **not** evaluate:
- content quality
- SEO performance
- accessibility compliance
- ranking potential

DocSignals focuses solely on **document structure and explicitness**.

---

## Tech Stack

- React 18 (UI framework)
- TypeScript (static typing)
- Vite (build and dev tooling)
- Tailwind CSS (utility-first styling)

---


## Core Concepts

### 1. Measured Values

Measured Values are **raw observations** derived directly from document analysis.
They are factual, reproducible, and interpretation-free.

Examples include:

**Structure**
- Fetches performed
- Structural differences across fetches
- DOM node count
- Maximum DOM depth
- Top-level sections
- Shadow DOM hosts

**Semantics**
- Heading structure (`h1` count, level gaps)
- Top-level landmark usage
- Generic container ratio (`div` / `span`)
- Non-descriptive links
- List structures
- Table header markup
- Language declaration
- Machine-readable time elements

These values describe **what exists**, not whether it is good or bad.

---

### 2. Interpretation

Interpretation translates measured values into **contextual implications for machine readers**.

Interpretations are:
- cautious
- modal (using *may*, *can*, *require*)
- non-judgmental

Example:

> **Measured:** 29 levels of DOM nesting  
> **Interpretation:** Machines may need to traverse multiple layers to infer context.

Interpretation does **not** prescribe fixes or optimizations.
It explains *what additional inference or traversal may be required*.

---

## Shadow DOM

DocSignals treats Shadow DOM as a **first-class structural reality**.

If a document contains Shadow DOM:

- it is measured
- it is reported
- it is interpreted once, without special weighting

Shadow DOM is not flagged as a problem.
It is acknowledged as part of modern document structures that machines must explicitly traverse.

---

## Design Principles

DocSignals is built around a few strict principles:

- **Measurement before interpretation**
- **No scoring systems**
- **No hidden heuristics**
- **No “AI-ready” claims**
- **No SEO framing**

If a signal cannot be measured reliably, it is excluded.

---

## Output

Results can be exported as:

- JSON
- CSV

This allows further processing, comparison, or integration into other analysis workflows.

---

## Intended Audience

DocSignals is built for:

- developers interested in document structure
- engineers working with crawlers, parsers, or agents
- people thinking about how machines interpret HTML beyond visual rendering

It assumes familiarity with HTML and DOM concepts.

---

## Scope and Limitations

DocSignals analyzes **static document structure** as fetched.
It does not:

- execute JavaScript beyond initial rendering
- simulate user interaction
- infer intent
- evaluate correctness of content

Its purpose is to make **structural reality visible**, not to judge it.

---

## Status

DocSignals is currently in **v1**.
The scope is intentionally limited and stable.

Future versions may expand measurement coverage,
but the core philosophy will remain unchanged.

---

## Author

Built by **Christoph Bauer**

Follow on GitHub: https://github.com/your-handle

---

*DocSignals evaluates document structure, not content quality or ranking.*
