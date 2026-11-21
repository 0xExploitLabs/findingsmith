import { syntaxTree } from "@codemirror/language";
import { type EditorView, WidgetType } from "@codemirror/view";

/**
 * The languages offered for a code block, most used in a pentest report first.
 * Each id is what goes after the opening fence; both the editor and the PDF
 * highlight every one of them.
 */
export const CODE_LANGUAGES: { id: string; label: string; alias?: string[] }[] = [
  { id: "bash", label: "Bash", alias: ["sh", "shell", "zsh", "console"] },
  { id: "http", label: "HTTP", alias: ["request", "response"] },
  { id: "json", label: "JSON" },
  { id: "javascript", label: "JavaScript", alias: ["js"] },
  { id: "python", label: "Python", alias: ["py"] },
  { id: "sql", label: "SQL" },
  { id: "html", label: "HTML" },
  { id: "xml", label: "XML" },
  { id: "yaml", label: "YAML", alias: ["yml"] },
  { id: "powershell", label: "PowerShell", alias: ["ps1"] },
  { id: "php", label: "PHP" },
  { id: "java", label: "Java" },
  { id: "typescript", label: "TypeScript", alias: ["ts"] },
  { id: "go", label: "Go", alias: ["golang"] },
  { id: "ruby", label: "Ruby", alias: ["rb"] },
  { id: "csharp", label: "C#", alias: ["cs"] },
  { id: "c", label: "C" },
  { id: "diff", label: "Diff", alias: ["patch"] },
  { id: "dockerfile", label: "Dockerfile", alias: ["docker"] },
  { id: "nginx", label: "Nginx" },
];

const PLAIN = "Plain text";

/** The name shown on a block for what its fence says: "bash" is Bash, "" is plain text. */
export function languageLabel(info: string): string {
  const id = info.trim().toLowerCase();
  if (!id) return PLAIN;
  const known = CODE_LANGUAGES.find((l) => l.id === id || l.alias?.includes(id));
  return known ? known.label : info.trim();
}

/** Sets the language of the fenced block whose opening fence is on the line at `pos`. */
export function setLanguage(view: EditorView, pos: number, id: string) {
  const { state } = view;
  const line = state.doc.lineAt(pos);
  let node = syntaxTree(state).resolveInner(line.to, -1);
  while (node.name !== "FencedCode" && node.parent) node = node.parent;
  if (node.name !== "FencedCode" || state.doc.lineAt(node.from).number !== line.number) return;
  const info = node.getChild("CodeInfo");
  const mark = node.firstChild;
  if (info) view.dispatch({ changes: { from: info.from, to: info.to, insert: id } });
  else if (mark?.name === "CodeMark") view.dispatch({ changes: { from: mark.to, insert: id } });
}

let closeOpenMenu: (() => void) | null = null;

/** A small searchable list under the block's language button. */
function openMenu(view: EditorView, anchor: HTMLElement, currentLabel: string) {
  closeOpenMenu?.();
  const pos = view.posAtDOM(anchor);
  const panel = document.createElement("div");
  panel.className = "cm-lang-menu";
  const input = document.createElement("input");
  input.className = "cm-lang-search";
  input.placeholder = "Search languages";
  input.setAttribute("aria-label", "Search languages");
  input.spellcheck = false;
  input.autocomplete = "off";
  const list = document.createElement("ul");
  list.className = "cm-lang-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Languages");
  panel.append(input, list);

  let options: { id: string; label: string }[] = [];
  let active = 0;

  const close = (refocus = true) => {
    panel.remove();
    document.removeEventListener("mousedown", outside, true);
    window.removeEventListener("resize", onResize);
    anchor.setAttribute("aria-expanded", "false");
    closeOpenMenu = null;
    if (refocus) view.focus();
  };
  const onResize = () => close(false);
  const outside = (e: MouseEvent) => {
    if (!panel.contains(e.target as Node)) close(false);
  };
  const choose = (id: string) => {
    close();
    setLanguage(view, pos, id);
  };

  const render = () => {
    const q = input.value.trim().toLowerCase();
    options = [{ id: "", label: PLAIN, alias: ["text", "none"] }, ...CODE_LANGUAGES].filter(
      (l) =>
        !q ||
        l.label.toLowerCase().includes(q) ||
        l.id.includes(q) ||
        l.alias?.some((a) => a.startsWith(q)),
    );
    // Any other language can be typed in: the fence takes whatever name it is given.
    if (q && /^[\w+#.-]+$/.test(q) && !options.some((o) => o.id === q)) {
      options.push({ id: q, label: `Use “${q}”` });
    }
    active = Math.min(active, Math.max(0, options.length - 1));
    list.textContent = "";
    options.forEach((o, i) => {
      const li = document.createElement("li");
      li.className = "cm-lang-option";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === active));
      const name = document.createElement("span");
      name.textContent = o.label;
      li.append(name);
      if (o.label === currentLabel) {
        const check = document.createElement("span");
        check.className = "cm-lang-check";
        check.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
        li.append(check);
      }
      li.addEventListener("mousemove", () => {
        if (active === i) return;
        active = i;
        for (const [n, el] of [...list.children].entries()) {
          el.setAttribute("aria-selected", String(n === i));
        }
      });
      li.addEventListener("mousedown", (e) => e.preventDefault());
      li.addEventListener("click", () => choose(o.id));
      list.append(li);
    });
    if (options.length === 0) {
      const none = document.createElement("li");
      none.className = "cm-lang-option cm-lang-none";
      none.textContent = "No language matches.";
      list.append(none);
    }
    list.children[active]?.scrollIntoView({ block: "nearest" });
  };

  input.addEventListener("input", () => {
    active = 0;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (options.length === 0) return;
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[active];
      if (option) choose(option.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      e.preventDefault();
    }
  });

  document.body.append(panel);
  render();
  const rect = anchor.getBoundingClientRect();
  const width = panel.offsetWidth;
  const below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  const flip = below < 240 && above > below;
  panel.style.left = `${Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))}px`;
  if (flip) panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  else panel.style.top = `${rect.bottom + 6}px`;
  list.style.maxHeight = `${Math.max(120, Math.min(280, (flip ? above : below) - 52))}px`;
  anchor.setAttribute("aria-expanded", "true");
  document.addEventListener("mousedown", outside, true);
  window.addEventListener("resize", onResize);
  closeOpenMenu = () => close(false);
  input.focus();
}

/** The language of a code block, shown on it as a button that changes it. */
export class LanguageWidget extends WidgetType {
  constructor(readonly info: string) {
    super();
  }
  eq(other: LanguageWidget) {
    return other.info === this.info;
  }
  toDOM(view: EditorView) {
    const label = languageLabel(this.info);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-lp-lang";
    if (!this.info.trim()) button.classList.add("is-plain");
    button.setAttribute("aria-label", `Code language: ${label}`);
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.title = "Change language";
    const name = document.createElement("span");
    name.textContent = label;
    button.append(name);
    button.insertAdjacentHTML(
      "beforeend",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    );
    button.addEventListener("mousedown", (e) => e.preventDefault());
    button.addEventListener("click", () => openMenu(view, button, label));
    return button;
  }
  ignoreEvent() {
    return true;
  }
}
