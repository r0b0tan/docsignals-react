export function FooterNote() {
  return (
    <footer className="pt-4 text-center space-y-2">
      <p className="text-xs text-gray-400">
        DocSignals evaluates document structure, not content quality or ranking.
      </p>
      <p className="text-xs text-gray-500">
        Built by{" "}
        <a
          href="https://www.christophbauer.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Christoph Bauer
        </a>{" "}
        · Follow me on{" "}
        <a
          href="https://github.com/r0b0tan"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          GitHub
        </a>
        {" "}·{" "}
        <a
          href="https://christophbauer.dev/dataprivacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Data Privacy
        </a>
        {" "}·{" "}
        <a
          href="https://christophbauer.dev/legalnotice/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Legal Notice
        </a>
      </p>
    </footer>
  );
}
