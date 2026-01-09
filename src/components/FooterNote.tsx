export function FooterNote() {
  return (
    <footer className="pt-10 text-center space-y-2">
      <p className="text-xs text-gray-400">
        DevSignals evaluates document structure, not content quality or ranking.
      </p>
      <p className="text-xs text-gray-500">
        Built by{" "}
        <a
          href="https://www.christophbauer.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          Christoph Bauer
        </a>{" "}
        · Follow me on{" "}
        <a
          href="https://github.com/r0b0tan"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}
