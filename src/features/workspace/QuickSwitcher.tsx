import {
  BookOpen,
  CornerDownLeft,
  FileDown,
  FilePlus2,
  FolderOpen,
  LayoutList,
  Search,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { rate } from "../../domain/severity";
import type { Finding } from "../../domain/types";
import { cx, Dialog, SEVERITY_CLASS } from "../../ui/primitives";

export interface SwitcherAction {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
}

interface Entry {
  id: string;
  label: string;
  detail?: ReactNode;
  icon: ReactNode;
  run: () => void;
}

/** True when every character of the query appears in the text, in order. */
function matches(text: string, query: string): boolean {
  const t = text.toLowerCase();
  let at = 0;
  for (const ch of query.toLowerCase()) {
    if (ch === " ") continue;
    at = t.indexOf(ch, at);
    if (at === -1) return false;
    at++;
  }
  return true;
}

/**
 * Jump to any finding or run a command from the keyboard, opened with Ctrl+K
 * (Cmd+K on macOS), as in Obsidian's quick switcher.
 */
export function QuickSwitcher({
  open,
  onClose,
  findings,
  refs,
  onOpenFinding,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  findings: Finding[];
  refs: Map<string, string>;
  onOpenFinding: (f: Finding) => void;
  actions: SwitcherAction[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const found: Entry[] = [...findings]
      .sort((a, b) => (refs.get(a.id) ?? "").localeCompare(refs.get(b.id) ?? ""))
      .map((f) => {
        const severity = rate(f).severity;
        return {
          id: f.id,
          label: f.title || "Untitled finding",
          detail: (
            <span className="flex items-center gap-2 font-mono text-[11.5px]">
              <span className="text-ink-faint">{refs.get(f.id)}</span>
              <span className={SEVERITY_CLASS[severity].text}>{severity}</span>
            </span>
          ),
          icon: (
            <span className={cx("mx-[5px] size-2 rounded-[2px]", SEVERITY_CLASS[severity].dot)} />
          ),
          run: () => onOpenFinding(f),
        };
      });
    const all = [...found, ...actions.map((a) => ({ ...a }))];
    return query.trim()
      ? all.filter((e) => matches(`${e.label} ${refs.get(e.id) ?? ""}`, query.trim()))
      : all;
  }, [findings, refs, actions, query, onOpenFinding]);

  const choose = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    e.run();
  };

  return (
    <Dialog open={open} onClose={onClose} width={560} bare placement="top">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-ink-faint" />
        <input
          data-autofocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, entries.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(entries[active]);
            }
          }}
          placeholder="Jump to a finding or run a command"
          aria-label="Search findings and commands"
          spellCheck={false}
          autoComplete="off"
          className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
        />
      </div>
      <ul className="max-h-[360px] overflow-y-auto p-1.5" aria-label="Results">
        {entries.length === 0 ? (
          <li className="px-3 py-6 text-center text-[13px] text-ink-faint">Nothing matches.</li>
        ) : null}
        {entries.map((e, i) => (
          <li key={e.id}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(e)}
              className={cx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-muted",
                i === active && "bg-hover",
              )}
            >
              {e.icon}
              <span className="min-w-0 flex-1 truncate">{e.label}</span>
              {e.detail}
              {i === active ? <CornerDownLeft className="!size-3.5 !text-ink-faint" /> : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-4 border-t border-line px-4 py-2.5 text-[11.5px] text-ink-faint">
        <span>↑↓ to move</span>
        <span>Enter to open</span>
        <span>Esc to close</span>
      </div>
    </Dialog>
  );
}

export const SWITCHER_ICONS = {
  newFinding: <FilePlus2 />,
  library: <BookOpen />,
  export: <FileDown />,
  project: <LayoutList />,
  projects: <FolderOpen />,
};
