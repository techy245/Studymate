import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  blockLatex?: boolean;
  className?: string;
}

function renderLatexHtml(expr: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expr.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return expr;
  }
}

function formatPlainSegment(segment: string): React.ReactNode[] {
  // Handle basic **bold**, *italic*, `code`, and newlines cleanly
  const lines = segment.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    parts.forEach((part, partIdx) => {
      const key = `${lineIdx}-${partIdx}`;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        nodes.push(
          <strong key={key} className="font-semibold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        nodes.push(
          <code
            key={key}
            className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 font-mono text-[0.9em]"
          >
            {part.slice(1, -1)}
          </code>
        );
      } else {
        nodes.push(<React.Fragment key={key}>{part}</React.Fragment>);
      }
    });
    if (lineIdx < lines.length - 1) {
      nodes.push(<br key={`br-${lineIdx}`} />);
    }
  });

  return nodes;
}

export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  blockLatex = false,
  className = '',
}) => {
  if (!text) return null;

  if (blockLatex && !text.includes('$')) {
    return (
      <div
        className={`overflow-x-auto ${className}`}
        dangerouslySetInnerHTML={{ __html: renderLatexHtml(text, true) }}
      />
    );
  }

  // Split by $$...$$ or $...$
  const tokens = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <div className={`leading-relaxed break-words ${className}`}>
      {tokens.map((token, idx) => {
        if (token.startsWith('$$') && token.endsWith('$$') && token.length > 4) {
          const expr = token.slice(2, -2);
          return (
            <div
              key={idx}
              className="my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: renderLatexHtml(expr, true) }}
            />
          );
        }
        if (token.startsWith('$') && token.endsWith('$') && token.length > 2) {
          const expr = token.slice(1, -1);
          return (
            <span
              key={idx}
              className="inline-block align-middle mx-0.5"
              dangerouslySetInnerHTML={{ __html: renderLatexHtml(expr, false) }}
            />
          );
        }
        return <React.Fragment key={idx}>{formatPlainSegment(token)}</React.Fragment>;
      })}
    </div>
  );
};
