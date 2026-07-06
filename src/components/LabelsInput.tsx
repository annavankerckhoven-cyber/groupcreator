import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  value: string[];
  onChange: (labels: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}

export function LabelsInput({ value, onChange, suggestions = [], placeholder, id, autoFocus }: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function addLabel(raw: string) {
    const clean = raw.trim().replace(/\s+/g, "_");
    if (!clean) return;
    if (value.includes(clean)) {
      setDraft("");
      return;
    }
    onChange([...value, clean]);
    setDraft("");
  }

  function removeLabel(label: string) {
    onChange(value.filter((l) => l !== label));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === " " || e.key === "Enter" || e.key === ",") {
      if (draft.trim()) {
        e.preventDefault();
        addLabel(draft);
      } else if (e.key === "Enter") {
        e.preventDefault();
      }
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      removeLabel(value[value.length - 1]);
    }
  }

  const filteredSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const pool = suggestions.filter((s) => !value.includes(s));
    if (!q) return pool.slice(0, 8);
    return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [draft, suggestions, value]);

  return (
    <div className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeLabel(label);
              }}
              className="rounded-sm hover:bg-muted"
              aria-label={`Remove label ${label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 150);
            if (draft.trim()) addLabel(draft);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[80px] flex-1 border-0 bg-transparent p-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {focused && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md">
          {filteredSuggestions.map((s) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                addLabel(s);
                inputRef.current?.focus();
              }}
              className="block w-full rounded px-2 py-1 text-left hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}