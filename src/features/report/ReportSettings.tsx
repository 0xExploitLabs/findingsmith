import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { assetUrl, storeImage } from "../../data/assets";
import { CLASSIFICATIONS, type Project } from "../../domain/types";
import { cx, IconButton, Menu, SelectButton, TextInput } from "../../ui/primitives";
import { toast } from "../../ui/toast";
import { ColourPicker } from "./ColourPicker";

const ACCENTS = ["#036877", "#0B5FA5", "#5B3FA0", "#9B2C55", "#B3541E", "#2F6B3A", "#24292F"];

/** The few choices that change how the PDF looks, kept next to the preview. */
export function ReportSettings({
  project,
  onChange,
}: {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
}) {
  return (
    <div className="space-y-4 px-5 py-4">
      <Row label="Prepared by">
        <TextInput
          value={project.preparedBy}
          onChange={(e) => onChange({ preparedBy: e.target.value })}
          placeholder="Your company or team"
          aria-label="Prepared by"
          className="h-8 text-[13px]"
        />
      </Row>
      <div className="grid grid-cols-[1fr_88px] gap-3">
        <Row label="Classification">
          <Menu
            value={project.classification}
            items={CLASSIFICATIONS.map((c) => ({ value: c, label: c }))}
            onSelect={(classification) => onChange({ classification })}
            trigger={({ toggle, ref, open }) => (
              <SelectButton
                ref={ref}
                open={open}
                onClick={toggle}
                label={project.classification}
                aria-label="Classification"
                className="h-8 w-full justify-between border border-line-strong bg-surface-1 px-2.5"
              />
            )}
          />
        </Row>
        <Row label="ID prefix">
          <TextInput
            value={project.idPrefix}
            onChange={(e) => onChange({ idPrefix: e.target.value.toUpperCase() })}
            maxLength={6}
            placeholder="F"
            aria-label="Finding ID prefix"
            className="h-8 font-mono text-[13px]"
          />
        </Row>
      </div>
      <Row label="Colour">
        <div className="flex flex-wrap items-center gap-1.5">
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={project.accent.toLowerCase() === c.toLowerCase()}
              onClick={() => onChange({ accent: c })}
              className={cx(
                "size-6 rounded-full border-2 transition-transform hover:scale-110",
                project.accent.toLowerCase() === c.toLowerCase()
                  ? "border-ink"
                  : "border-transparent",
              )}
              style={{ background: c }}
            />
          ))}
          <ColourPicker
            value={project.accent}
            active={!ACCENTS.some((c) => c.toLowerCase() === project.accent.toLowerCase())}
            onChange={(accent) => onChange({ accent })}
          />
        </div>
      </Row>
      <Logo project={project} onChange={onChange} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-ink-muted">{label}</div>
      {children}
    </div>
  );
}

function Logo({
  project,
  onChange,
}: {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    if (project.logoAssetId) void assetUrl(project.logoAssetId).then((u) => live && setUrl(u));
    else setUrl(null);
    return () => {
      live = false;
    };
  }, [project.logoAssetId]);
  return (
    <Row label="Logo">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cx(
            "flex h-12 flex-1 items-center justify-center overflow-hidden rounded-lg border px-3 text-[13px] transition-colors duration-(--dur-micro)",
            url
              ? "border-line-strong bg-sheet hover:border-line-hover"
              : "border-dashed border-line-strong bg-surface-2 text-ink-muted hover:border-line-hover hover:text-ink",
          )}
          aria-label={url ? "Replace logo" : "Add logo"}
        >
          {url ? (
            <img src={url} alt="Report logo" className="max-h-9 max-w-full object-contain" />
          ) : (
            <span className="flex items-center gap-1.5 [&_svg]:size-4">
              <ImagePlus /> Add logo
            </span>
          )}
        </button>
        {url ? (
          <IconButton
            label="Remove logo"
            onClick={() => onChange({ logoAssetId: null })}
            className="size-8"
          >
            <X />
          </IconButton>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const asset = await storeImage(project.id, file, file.name);
            onChange({ logoAssetId: asset.id });
          } catch (err) {
            toast(
              `Could not use that image: ${err instanceof Error ? err.message : String(err)}`,
              "error",
            );
          }
        }}
      />
    </Row>
  );
}
