"use client";

import { useEffect, useRef, useState } from "react";
import { SPECIAL_RULES, isSpecialRuleAllowed } from "./labels";

/**
 * Choix de la course spéciale, qui suit le format choisi dans le même formulaire :
 * une règle non autorisée pour ce format (Brouillard hors sprint/individuelle) est grisée,
 * et retirée si elle était sélectionnée. Sur une étape Mondiaux/JO (coefficient 2), aucune course
 * spéciale (décision de Guillaume, 04/11/2026). Les actions serveur revérifient.
 */
export function SpecialRuleSelect({
  defaultValue = "",
  defaultFormat,
  className,
  championship = false,
}: {
  defaultValue?: string;
  defaultFormat: string;
  className: string;
  /** Étape Mondiaux/JO : pas de malus ni de Fête nationale. */
  championship?: boolean;
}) {
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

  const allowed = (rule: string) => isRuleAllowed(format, rule, championship);

  useEffect(() => {
    if (!isRuleAllowed(format, value, championship)) setValue("");
  }, [format, value, championship]);

  return (
    <select
      ref={ref}
      name="special_rule"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      title={championship ? "Pas de course spéciale sur les Mondiaux / JO" : undefined}
      className={className}
    >
      {SPECIAL_RULES.map((r) => (
        <option key={r.value} value={r.value} disabled={!allowed(r.value)}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

function isRuleAllowed(format: string, rule: string, championship: boolean): boolean {
  return rule === "" || (!championship && isSpecialRuleAllowed(format, rule));
}
