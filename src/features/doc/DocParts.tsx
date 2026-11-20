import { Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { cx } from "../../ui/primitives";

/** A large, borderless, auto-growing title, as in a document app. */
export function Title({
  value,
  onChange,
  focusWhenEmpty,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Focus the title when a document with this id opens and has no title yet. */
  focusWhenEmpty?: string;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(ref, value);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when a different document opens
  useEffect(() => {
    if (!value) ref.current?.focus();
  }, [focusWhenEmpty]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          document.querySelector<HTMLElement>("article .doc-editor .cm-content")?.focus();
        }
      }}
      placeholder={placeholder}
      rows={1}
      spellCheck={false}
      autoCorrect="off"
      aria-label="Title"
      className="block w-full resize-none overflow-hidden bg-transparent text-[34px] font-semibold leading-[1.16] tracking-[-0.025em] text-ink outline-none placeholder:text-ink-faint"
    />
  );
}

/** One row of the properties list: an icon and a label, then the value. */
export function Property({
  icon,
  label,
  children,
  onRemove,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  /** Shows a remove button on hover, for optional properties. */
  onRemove?: () => void;
}) {
  return (
    <div className="group/prop flex min-h-[34px] items-start gap-3 py-[3px]">
      <dt className="flex h-7 w-[128px] shrink-0 items-center gap-2 text-[13px] text-ink-faint [&_svg]:size-[15px]">
        {icon}
        {label}
      </dt>
      <dd className="flex min-h-7 min-w-0 flex-1 items-center">{children}</dd>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          title={`Remove ${label}`}
          className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-md text-ink-faint opacity-0 transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover/prop:opacity-100 [&_svg]:size-3.5"
        >
          <X />
        </button>
      ) : null}
    </div>
  );
}

const proofing = { spellCheck: false, autoCorrect: "off", autoComplete: "off" } as const;

/** Text that reads as plain text until hovered or focused, like a property value. */
export function InlineText({
  value,
  onChange,
  placeholder,
  multiline,
  mono,
  label,
  className,
  autoFocus,
  invalid,
  fit,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  mono?: boolean;
  label: string;
  className?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  /** Size the field to its text, so something can sit right after it. */
  fit?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(area, value);
  const cls = cx(
    "-mx-1.5 block min-w-0 rounded-md bg-transparent px-1.5 py-[3px] text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint hover:bg-hover focus:bg-hover",
    mono && "font-mono text-[12.5px] placeholder:font-sans placeholder:text-[13.5px]",
    invalid && "text-danger",
    fit ? "w-auto max-w-full [field-sizing:content]" : "w-full",
    className,
  );
  return multiline ? (
    <textarea
      ref={area}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid || undefined}
      // biome-ignore lint/a11y/noAutofocus: focuses a property the user just added
      autoFocus={autoFocus}
      {...proofing}
      className={cx(cls, "resize-none overflow-hidden leading-relaxed")}
    />
  ) : (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid || undefined}
      // biome-ignore lint/a11y/noAutofocus: focuses a property the user just added
      autoFocus={autoFocus}
      {...proofing}
      className={cls}
    />
  );
}

function useAutoHeight(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the text changes
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
}

/**
 * Buttons for the usual sections a document does not have yet. Choosing one
 * appends its `##` heading and puts the cursor under it.
 */
export function AddSections({
  body,
  sections,
  onAdd,
}: {
  body: string;
  sections: string[];
  onAdd: (title: string) => void;
}) {
  const present = new Set(splitHeadings(body));
  const missing = sections.filter((s) => !present.has(s.toLowerCase()));
  if (missing.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-dashed border-line pt-4">
      <span className="mr-1 text-[12px] text-ink-faint">Add section</span>
      {missing.map((title) => (
        <button
          key={title}
          type="button"
          onClick={() => onAdd(title)}
          className="flex h-7 items-center gap-1 rounded-full border border-line-strong px-2.5 text-[12.5px] text-ink-muted transition-colors hover:border-accent hover:text-ink [&_svg]:size-3.5"
        >
          <Plus />
          {title}
        </button>
      ))}
    </div>
  );
}

/** The `##` headings in a document, including empty sections, lower-cased. */
function splitHeadings(body: string): string[] {
  // Empty sections are dropped by splitSections, so read the headings directly,
  // skipping fenced code.
  const heads: string[] = [];
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (f?.[1]) {
      if (!fence) fence = f[1][0] ?? null;
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (!fence) {
      const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
      if (h?.[1]) heads.push(h[1].toLowerCase());
    }
  }
  return heads;
}
