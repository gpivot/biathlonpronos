"use client";

import { useEffect, useRef, useState } from "react";
import { SPECIAL_RULES, isSpecialRuleAllowed } from "./labels";

/**
 * Choix de la course spéciale, qui suit le format choisi dans le même formulaire :
 * une règle non autorisée pour ce format (Brouillard hors sprint/individuelle) est grisée,
 * et retirée si elle était sélectionnée. Les actions serveur revérifient.
 */
export function SpecialRuleSelect({ defaultValue = "", defaultFormat, className }: { defaultValue?: string; defaultFormat: string; className: string }) {
  const ref = useRef<HTMLSelectElement>(null);
  const [format, setFormat] = useState(defaultFormat);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const formatSelect = ref.current?.form?.elements.namedItem("format") as HTMLSelectElement | null;
    if (!formatSelect) return;
    const onChange = () => setFormat(formatSelect.value);
    onChange();
    formatSelect.addEventListener("change", onChange);
    return () => formatSelect.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isSpecialRuleAllowed(format, value)) setValue("");
  }, [format, value]);

  return (
    <select ref={ref} name="special_rule" value={value} onChange={(e) => setValue(e.target.value)} className={className}>
      {SPECIAL_RULES.map((r) => (
        <option key={r.value} value={r.value} disabled={!isSpecialRuleAllowed(format, r.value)}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
