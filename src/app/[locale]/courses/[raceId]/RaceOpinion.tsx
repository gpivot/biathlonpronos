/** Encadré « L'avis de Biathlonpronos » : commentaire de l'admin sur la course (masqué s'il est vide). */
export function RaceOpinion({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-ice">
        <span aria-hidden>🎙️</span>
        {title}
      </div>
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-frost">{text}</p>
    </div>
  );
}
