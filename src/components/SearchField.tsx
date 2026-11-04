"use client";

import { CloseIcon, SearchIcon } from "@/components/icons";

/** Champ de recherche des listes de pronostics (nom ou code pays à 3 lettres). */
export function SearchField({
  value,
  onChange,
  placeholder,
  clearLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
}) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-9 text-sm text-frost placeholder:text-text-dim focus:border-ice focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          title={clearLabel}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-text-dim hover:text-frost"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
