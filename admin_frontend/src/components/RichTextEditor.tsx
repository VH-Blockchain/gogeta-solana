'use client';

import { useEffect, useRef } from 'react';

const btn =
  'rounded px-2 py-1 text-xs font-medium text-zinc-300 border border-white/10 hover:bg-white/10';

/**
 * Lightweight WYSIWYG editor that outputs HTML (stored in CmsPage.content and
 * rendered in the app). Zero dependencies — uses a contentEditable surface with
 * a small formatting toolbar. Uncontrolled after mount to keep the caret stable.
 */
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (value || '')) el.innerHTML = value || '';
    // Initialise once from the incoming value; further edits stay in the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function renderTool({ label, cmd, arg }: { label: string; cmd: string; arg?: string }) {
    return (
      <button
        type="button"
        className={btn}
        onMouseDown={(e) => {
          e.preventDefault();
          exec(cmd, arg);
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      <div className="flex flex-wrap gap-1 border-b border-white/10 p-2">
        {renderTool({ label: "B", cmd: "bold" })}
        {renderTool({ label: "I", cmd: "italic" })}
        {renderTool({ label: "H2", cmd: "formatBlock", arg: "H2" })}
        {renderTool({ label: "H3", cmd: "formatBlock", arg: "H3" })}
        {renderTool({ label: "Paragraph", cmd: "formatBlock", arg: "P" })}
        {renderTool({ label: "• List", cmd: "insertUnorderedList" })}
        {renderTool({ label: "1. List", cmd: "insertOrderedList" })}
        <button
          type="button"
          className={btn}
          onMouseDown={(e) => {
            e.preventDefault();
            const url = window.prompt('Link URL (https://…)');
            if (url) exec('createLink', url);
          }}
        >
          Link
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        className="min-h-[200px] max-w-none px-3 py-2 text-sm leading-relaxed text-zinc-200 focus:outline-none [&_a]:text-cyan-300 [&_a]:underline [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}

/** True when the HTML has no visible text or media (empty editor). */
export function htmlIsEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
}
