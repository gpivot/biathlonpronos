import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { LeaderBib, StageLeaderBib, YoungBib } from "@/components/PlayerBadgesRow";
import { CrystalGlobeIcon } from "@/components/SeasonCategoryIcon";
import { ScoreMockup } from "@/components/landing/Mockups";
import { PointsSimulator } from "@/components/PointsSimulator";
import { OpenChapterFromHash } from "./OpenChapterFromHash";
import {
  COMBINATION_BONUS,
  GROS_GLOBE_MULTIPLIERS,
  PETIT_GLOBE_MULTIPLIERS,
  RANK_MULTIPLIERS,
  RELAY_RANK_MULTIPLIERS,
  TES_COLLE_MALUS,
  TOUR_DE_PENA_MALUS_PER_LAP,
} from "@/lib/scoring/constants";

// Page Règlement, refondue le 02/11/2026 dans le style de l'accueil visiteur : 5 chapitres
// (les bases, les bonus, les courses spéciales, la saison, le classement), chaque règle en carte
// avec un picto, une phrase courte et un visuel (barème en tuiles, frise, exemple chiffré). Les
// chiffres viennent des constantes du moteur de scoring, pour ne jamais diverger du calcul réel.

// Deux niveaux (26/11/2026) : « L'essentiel » toujours visible (ce qu'il faut pour jouer sa
// 1re course), puis « Pour aller plus loin » en chapitres repliés, chacun avec le moment où il
// entre en jeu dans la saison. Objectif : ne pas noyer le nouveau joueur sous toutes les règles.
const CHAPTERS = ["when", "odds", "boosts", "special", "season", "standings", "lexique"] as const;
type Chapter = (typeof CHAPTERS)[number];
const CHAPTER_EMOJI: Record<Chapter, string> = {
  when: "🗓️",
  odds: "📊",
  boosts: "⚡",
  special: "⚠️",
  season: "🌐",
  standings: "🏆",
  lexique: "📖",
};

/** Lexique (27/11/2026) : mêmes définitions que les bulles du lexique cliquable (composant TermTip). */
const GLOSSARY_TERMS = [
  "cote",
  "top10",
  "combo",
  "parfait",
  "x2",
  "mondiaux",
  "etape",
  "horsClassement",
  "speciale",
  "serie",
  "cartes",
  "pepite",
  "equipeFavorite",
  "globes",
  "jokers",
  "dossardJaune",
  "dossardRouge",
  "ligue",
] as const;

const CARDS = [
  { type: "ca_farte", emoji: "🔥" },
  { type: "balle_de_pioche", emoji: "🃏" },
  { type: "aspiration", emoji: "💨", tag: "cardFrom4" },
  { type: "equipe", emoji: "👥", tag: "cardAfterWorlds" },
  { type: "fusee", emoji: "🚀" },
  { type: "gachette", emoji: "🎯" },
  { type: "talent", emoji: "❄️" },
] as const;

export default async function ReglesPage() {
  const [t, tLanding, tCards, tFormat, tBadges, tGlossary] = await Promise.all([
    getTranslations("Regles"),
    getTranslations("Landing"),
    getTranslations("BonusCards"),
    getTranslations("RaceFormat"),
    getTranslations("Badges"),
    getTranslations("Glossary"),
  ]);
  const cardNames = {
    farte: tCards("name_ca_farte"),
    fourth: tCards("name_balle_de_pioche"),
    aspiration: tCards("name_aspiration"),
  };
  const rank = (n: number) => t("rank", { rank: n });

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader backLabel={t("back")} emoji="📖" title={t("title")} subtitle={t("subtitle")} />
      <OpenChapterFromHash />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pb-16 pt-6 sm:px-5">
        <p className="text-center text-[15px] leading-relaxed text-text-dim">{t("intro")}</p>

        {/* La règle d'or (§18) en trois arguments, puis le sommaire. */}
        <div className="grid grid-cols-3 gap-2.5">
          {(
            [
              ["🧠", "golden1"],
              ["🎲", "golden2"],
              ["📈", "golden3"],
            ] as const
          ).map(([emoji, key]) => (
            <div key={key} className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-2 py-3 text-center">
              <span className="text-2xl">{emoji}</span>
              <span className="font-display text-[12px] font-extrabold leading-tight sm:text-sm">{t(`${key}Title`)}</span>
              <span className="text-[11px] leading-snug text-text-dim sm:text-xs">{t(`${key}Body`)}</span>
            </div>
          ))}
        </div>

        {/* ───────────── L'essentiel ───────────── */}
        <section id="essentiel" className="flex scroll-mt-4 flex-col gap-4">
          <div className="text-center">
            <div className="font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-ice">{t("essentialEyebrow")}</div>
            <h2 className="font-display text-2xl font-extrabold leading-tight">{t("essentialTitle")}</h2>
          </div>

          <ol className="flex flex-col gap-3">
            <EssentialStep n={1} emoji="🎯" title={t("essential1Title")} body={t("essential1Body")} />
            <EssentialStep n={2} emoji="📊" title={t("essential2Title")} body={t("essential2Body")}>
              <div className="flex flex-col gap-1">
                <div className="h-2.5 rounded-full bg-gradient-to-r from-ice via-blue to-gold" />
                <div className="flex justify-between text-[11px]">
                  <span>
                    <b className="font-display text-ice">{t("oddsFavorite")}</b> <span className="text-text-dim">· {t("oddsLow")}</span>
                  </span>
                  <span>
                    <span className="text-text-dim">{t("oddsHigh")} ·</span> <b className="font-display text-gold">{t("oddsOutsider")}</b>
                  </span>
                </div>
              </div>
            </EssentialStep>
            <EssentialStep n={3} emoji="🏁" title={t("essential3Title")} body={t("essential3Body")}>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {Object.entries(RANK_MULTIPLIERS).map(([r, m]) => (
                  <div key={r} className={`rounded-xl py-1.5 ${Number(r) <= 3 ? "bg-gold-soft" : "bg-ice-soft"}`}>
                    <div className="text-[10px] text-text-dim">{rank(Number(r))}</div>
                    <div className={`font-display text-sm font-extrabold ${Number(r) <= 3 ? "text-gold" : "text-ice"}`}>×{m}</div>
                  </div>
                ))}
              </div>
              <Example>{t("pickExample")}</Example>
            </EssentialStep>
            <EssentialStep n={4} emoji="🎁" title={t("essential4Title")} body={t("essential4Body")}>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["comboPodium", COMBINATION_BONUS.podium],
                    ["comboTop5", COMBINATION_BONUS.top5],
                    ["comboTop10", COMBINATION_BONUS.top10],
                    ["comboPerfect", COMBINATION_BONUS.pronoParfait],
                  ] as const
                ).map(([key, pts]) => (
                  <div key={key} className="flex flex-col gap-0.5 rounded-xl border border-green/40 bg-green/10 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-[13px] font-extrabold">{t(`${key}Name`)}</span>
                      <span className="font-display text-base font-extrabold text-green">+{pts}</span>
                    </div>
                    <span className="text-[11px] leading-snug text-text-dim">{t(`${key}Desc`)}</span>
                  </div>
                ))}
              </div>
            </EssentialStep>
            <EssentialStep n={5} emoji="🤝" title={t("essential5Title")} body={t("essential5Body")} />
          </ol>

          <PointsSimulator />

          {/* Capture commentée reprise de l'accueil visiteur (mêmes pastilles et légendes). */}
          <div className="grid items-center gap-6 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2 sm:p-6">
            <div className="flex flex-col gap-3">
              <Label>{t("exampleTitle")}</Label>
              <ol className="flex flex-col gap-2.5">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex gap-3 text-[13px] leading-snug">
                    <span className="mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold font-display text-[10px] font-extrabold text-on-gold">
                      {n}
                    </span>
                    <span>{tLanding(`f2Pin${n}`)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <ScoreMockup />
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-ice/40 bg-ice-soft p-4 text-center">
            <p className="text-[14px] font-semibold leading-relaxed">✅ {t("essentialEnd")}</p>
            <Link
              href="/courses"
              className="rounded-2xl bg-gradient-to-r from-blue to-teal px-6 py-3 font-display text-[14px] font-extrabold text-white hover:brightness-110"
            >
              {t("finalCta")} →
            </Link>
          </div>
        </section>

        {/* ───────────── Pour aller plus loin ───────────── */}
        <section id="plus-loin" className="flex scroll-mt-4 flex-col gap-3">
          <div className="text-center">
            <div className="font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim">{t("moreEyebrow")}</div>
            <h2 className="font-display text-2xl font-extrabold leading-tight">{t("moreTitle")}</h2>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-text-dim">{t("moreIntro")}</p>
          </div>

        <ChapterBlock id="when" title={t("ch_when_title")} teaser={t("ch_when_teaser")} tag={t("ch_when_tag")}>
          <RuleCard emoji="🗓️" title={t("whenTitle")} body={t("whenBody")}>
            <ul className="flex flex-col gap-1.5 text-[12px] leading-relaxed text-text-dim">
              <li>🔓 {t("whenOpen")}</li>
              <li>👥 {t("whenField")}</li>
              <li>⏱️ {t("whenQualified")}</li>
              <li>🔒 {t("whenClose")}</li>
            </ul>
          </RuleCard>
        </ChapterBlock>

        <ChapterBlock id="odds" title={t("ch_odds_title")} teaser={t("ch_odds_teaser")} tag={t("ch_odds_tag")}>
          <RuleCard emoji="📊" title={t("oddsTitle")} body={t("oddsBody")}>
            <div className="flex flex-wrap gap-1.5">
              {(["sprint", "poursuite", "individuel", "mass_start"] as const).map((f) => (
                <span key={f} className="rounded-full border border-border bg-card2 px-2.5 py-1 font-display text-[11px] font-bold">
                  {tFormat(f)}
                </span>
              ))}
            </div>
            <p className="text-[12px] leading-relaxed text-text-dim">🗓️ {t("oddsWhen")}</p>
          </RuleCard>

          <RuleCard emoji="⏱️" title={t("pursuitTitle")} body={t("pursuitBody")}>
            <Label>{t("pursuitExample")}</Label>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {(
                [
                  ["+12 s", 10],
                  ["+42 s", 20],
                  ["+1:10", 25],
                ] as const
              ).map(([gap, odds]) => (
                <div key={gap} className="rounded-xl bg-ice-soft py-2">
                  <div className="text-[11px] text-text-dim">{gap}</div>
                  <div className="font-display text-[13px] font-extrabold text-ice">
                    {t("oddsShort")} {odds}
                  </div>
                </div>
              ))}
            </div>
          </RuleCard>

          <RuleCard emoji="🤝" title={t("relayTitle")} body={t("relayBody")}>
            <Label>{t("relayScale")}</Label>
            <Scale multipliers={RELAY_RANK_MULTIPLIERS} rank={rank} />
          </RuleCard>
        </ChapterBlock>

        {/* ───────────── 2. Les bonus ───────────── */}
        <ChapterBlock id="boosts" title={t("ch_boosts_title")} teaser={t("ch_boosts_teaser")} tag={t("ch_boosts_tag")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <RuleCard emoji="⚡" title={t("x2Title")} body={t("x2Body")}>
              <div className="flex items-center gap-2">
                <span className="text-xl tracking-widest">⚡⚡⚡</span>
                <span className="font-display text-[12px] font-bold text-ice">{t("x2Count")}</span>
              </div>
            </RuleCard>
            <RuleCard emoji="🌍" title={t("worldsTitle")} body={t("worldsBody")}>
              <div className="flex items-center gap-2 font-display text-[12px] font-bold">
                <span className="rounded-full bg-gold-soft px-2.5 py-1 text-gold">{t("worldsAuto")}</span>
                <span className="rounded-full bg-red/10 px-2.5 py-1 text-red">{t("worldsNever")}</span>
              </div>
            </RuleCard>
          </div>

          <RuleCard emoji="❓" title={t("questionsTitle")} body={t("questionsBody")}>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card2 px-3 py-2">
                <span className="font-display text-[12px] font-extrabold">🕐 {t("questionsBeforeName")}</span>
                <span className="text-[11px] leading-snug text-text-dim">{t("questionsBeforeDesc")}</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl border border-red/40 bg-red/10 px-3 py-2">
                <span className="font-display text-[12px] font-extrabold">🔴 {t("questionsLiveName")}</span>
                <span className="text-[11px] leading-snug text-text-dim">{t("questionsLiveDesc")}</span>
              </div>
            </div>
            <div className="flex gap-2 font-display text-[12px] font-bold">
              <span className="rounded-full bg-green/10 px-2.5 py-1 text-green">{t("questionsGood")}</span>
              <span className="rounded-full bg-card2 px-2.5 py-1 text-text-dim">{t("questionsBad")}</span>
            </div>
          </RuleCard>

          <RuleCard emoji="🔟" title={t("streakTitle")} body={t("streakBody")}>
            <div className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className="flex h-6 flex-1 items-center justify-center rounded-md bg-gradient-to-br from-blue to-teal font-display text-[10px] font-extrabold text-white"
                >
                  {i + 1}
                </span>
              ))}
              <span className="ml-1 text-lg">→ 🃏</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CARDS.map((card) => (
                <div key={card.type} className="flex flex-col gap-1 rounded-xl bg-gold-soft px-3 py-2.5 last:col-span-2 sm:last:col-span-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg leading-none">{card.emoji}</span>
                    <span className="font-display text-[13px] font-extrabold text-gold">{tCards(`name_${card.type}`)}</span>
                  </div>
                  {"tag" in card && (
                    <span className="self-start rounded-full bg-gold px-2 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wide text-on-gold">
                      {t(card.tag)}
                    </span>
                  )}
                  <span className="text-[11px] leading-snug text-text-dim">{tCards(`desc_${card.type}`)}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] leading-relaxed text-text-dim">ℹ️ {t("streakRules", cardNames)}</p>
          </RuleCard>
        </ChapterBlock>

        {/* ───────────── 3. Les courses spéciales ───────────── */}
        <ChapterBlock id="special" title={t("ch_special_title")} teaser={t("ch_special_teaser")} tag={t("ch_special_tag")}>
          <p className="text-center text-[13px] text-text-dim">{t("specialIntro")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SpecialCard emoji="🎯" name={tFormat("specialRule_tour_de_pena")} value={`${TOUR_DE_PENA_MALUS_PER_LAP} pts`} body={t("penaDesc")} />
            <SpecialCard emoji="🌫️" name={tFormat("specialRule_brouillard")} value={t("fogValue")} body={t("fogDesc")} />
            <SpecialCard emoji="😬" name={tFormat("specialRule_tes_colle")} body={t("colleDesc")}>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {(
                  [
                    ["colleOne", TES_COLLE_MALUS.oneOutOfTop10],
                    ["colleTwo", TES_COLLE_MALUS.twoOutOfTop10],
                    ["colleThree", TES_COLLE_MALUS.threeOutOfTop10],
                    ["colleNone", TES_COLLE_MALUS.noBetOrIncomplete],
                  ] as const
                ).map(([key, pts]) => (
                  <div key={key} className="flex items-center justify-between gap-1 rounded-lg bg-bg/60 px-2 py-1 text-[11px]">
                    <span className="text-text-dim">{t(key)}</span>
                    <span className="font-display font-extrabold text-red">{pts}</span>
                  </div>
                ))}
              </div>
            </SpecialCard>
            <SpecialCard
              emoji="🎉"
              name={tFormat("specialRule_fete_nationale")}
              value="×2"
              positive
              body={t("feteDesc", { farte: cardNames.farte })}
            />
          </div>
        </ChapterBlock>

        {/* ───────────── 4. La saison ───────────── */}
        <ChapterBlock id="season" title={t("ch_season_title")} teaser={t("ch_season_teaser")} tag={t("ch_season_tag")}>
          <RuleCard emoji="🌐" title={t("globesTitle")} body={t("globesBody")}>
            <div className="grid grid-cols-2 gap-2">
              {(["women", "men"] as const).map((sex) => (
                <div key={sex} className="flex flex-col gap-1 rounded-xl border border-border bg-card2 px-3 py-2">
                  <span className="font-display text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t(sex)}</span>
                  <span className="flex items-center gap-1 text-[12px]">
                    <CrystalGlobeIcon className="h-4 w-4" /> {t("globeBig")}
                  </span>
                  <span className="flex items-center gap-1 text-[12px]">
                    <YoungBib /> {t("globeYoung")}
                  </span>
                  <span className="text-[12px]">🏳️ {t("globeNation")}</span>
                </div>
              ))}
            </div>
            <Label>
              <CrystalGlobeIcon className="inline h-4 w-4 align-middle" /> {t("globeBigScale")}
            </Label>
            <Scale multipliers={GROS_GLOBE_MULTIPLIERS} rank={rank} />
            <Label>
              <span className="inline-flex items-center gap-1 align-middle">
                <YoungBib /> 🏳️
              </span>{" "}
              {t("globeSmallScale")}
            </Label>
            <Scale multipliers={PETIT_GLOBE_MULTIPLIERS} rank={rank} cols="grid-cols-3" />
          </RuleCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <RuleCard emoji="❄️" title={t("pepiteTitle")} body={t("pepiteBody")}>
              <span className="self-start rounded-full bg-gold-soft px-2.5 py-1 font-display text-[12px] font-bold text-gold">
                {t("pepiteOdds")}
              </span>
            </RuleCard>
            <RuleCard emoji="🃏" title={t("jokersTitle")} body={t("jokersBody")}>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-ice-soft py-2">
                  <div className="font-display text-xl font-extrabold text-ice">3</div>
                  <div className="text-[11px] text-text-dim">{t("jokersIndividual")}</div>
                </div>
                <div className="rounded-xl bg-ice-soft py-2">
                  <div className="font-display text-xl font-extrabold text-ice">2</div>
                  <div className="text-[11px] text-text-dim">{t("jokersRelay")}</div>
                </div>
              </div>
              <p className="text-[12px] text-text-dim">👀 {t("jokersPreview")}</p>
            </RuleCard>
          </div>
        </ChapterBlock>

        {/* ───────────── 5. Le classement ───────────── */}
        <ChapterBlock id="standings" title={t("ch_standings_title")} teaser={t("ch_standings_teaser")} tag={t("ch_standings_tag")}>
          <div className="grid gap-3 sm:grid-cols-3">
            <StandingCard icon={<LeaderBib className="h-9 w-9" />} title={t("generalTitle")} body={t("generalBody")} />
            <StandingCard icon={<StageLeaderBib className="h-9 w-9" />} title={t("stageTitle")} body={t("stageBody")} />
            <StandingCard icon={<span className="text-3xl leading-none">👥</span>} title={t("leaguesTitle")} body={t("leaguesBody")} />
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <Label>{tBadges("helpTitle")}</Label>
            <ul className="flex flex-col gap-1.5 text-[12px] leading-snug text-text-dim">
              <li className="flex gap-2">
                <span className="w-5 text-center text-[14px]">⚡</span>
                {tBadges("helpX2")}
              </li>
              <li className="flex gap-2">
                <span className="w-5 text-center text-[14px]">🍾</span>
                {tBadges("helpWins")}
              </li>
              <li className="flex gap-2">
                <span className="w-5 text-center text-[14px]">⭐</span>
                {tBadges("helpPerfect")}
              </li>
              <li className="flex gap-2">
                <span className="w-5 text-center text-[14px]">❄️</span>
                {tBadges("helpPepite")}
              </li>
            </ul>
          </div>
        </ChapterBlock>

        <ChapterBlock id="lexique" title={tGlossary("title")} teaser={tGlossary("teaser")} tag={tGlossary("tag")}>
          <dl className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
            {GLOSSARY_TERMS.map((term) => (
              <div key={term} className="flex flex-col gap-0.5 px-4 py-2.5">
                <dt className="font-display text-[13px] font-extrabold">{tGlossary(`${term}_t`)}</dt>
                <dd className="text-[12px] leading-relaxed text-text-dim">{tGlossary(`${term}_d`)}</dd>
              </div>
            ))}
          </dl>
        </ChapterBlock>
        </section>

        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <h2 className="font-display text-2xl font-extrabold">{t("finalTitle")}</h2>
          <p className="max-w-sm text-[13px] text-text-dim">{t("finalBody")}</p>
        </div>
      </div>
    </div>
  );
}

/** Chapitre replié de « Pour aller plus loin » : titre, phrase d'accroche et moment où il entre en jeu. */
function ChapterBlock({
  id,
  title,
  teaser,
  tag,
  children,
}: {
  id: Chapter;
  title: string;
  teaser: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} className="group scroll-mt-4 rounded-2xl border border-border bg-card/60">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-xl">{CHAPTER_EMOJI[id]}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-[16px] font-extrabold leading-tight">{title}</span>
          <span className="text-[12px] leading-snug text-text-dim">{teaser}</span>
          <span className="mt-0.5 self-start rounded-full bg-gold-soft px-2 py-0.5 font-display text-[10px] font-bold text-gold">{tag}</span>
        </span>
        <span aria-hidden className="text-text-dim transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-4 px-3 pb-4 sm:px-4">{children}</div>
    </details>
  );
}

/** Une étape de « L'essentiel » : numéro, titre, phrase courte et visuel éventuel. */
function EssentialStep({
  n,
  emoji,
  title,
  body,
  children,
}: {
  n: number;
  emoji: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue to-teal font-display text-sm font-extrabold text-white">
          {n}
        </span>
        <h3 className="font-display text-base font-extrabold leading-tight">
          {emoji} {title}
        </h3>
      </div>
      <p className="text-[13px] leading-relaxed text-text-dim">{body}</p>
      {children}
    </li>
  );
}

function RuleCard({ emoji, title, body, children }: { emoji: string; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ice-soft text-lg">{emoji}</span>
        <h3 className="font-display text-base font-extrabold leading-tight">{title}</h3>
      </div>
      <p className="text-[13px] leading-relaxed text-text-dim">{body}</p>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-display text-[11px] font-bold uppercase tracking-wider text-ice">{children}</div>;
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ice/50 bg-ice-soft px-3 py-2 font-display text-[12px] font-semibold text-ice">
      💡 {children}
    </div>
  );
}

function Scale({
  multipliers,
  rank,
  cols = "grid-cols-5",
}: {
  multipliers: Record<number, number>;
  rank: (n: number) => string;
  cols?: string;
}) {
  return (
    <div className={`grid gap-1.5 text-center ${cols}`}>
      {Object.entries(multipliers).map(([r, m]) => (
        <div key={r} className="rounded-xl bg-ice-soft py-1.5">
          <div className="text-[10px] text-text-dim">{rank(Number(r))}</div>
          <div className="font-display text-sm font-extrabold text-ice">×{m}</div>
        </div>
      ))}
    </div>
  );
}

function SpecialCard({
  emoji,
  name,
  value,
  body,
  positive = false,
  children,
}: {
  emoji: string;
  name: string;
  value?: string;
  body: string;
  positive?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-2xl border p-4 ${positive ? "border-gold/50 bg-gold-soft" : "border-red/40 bg-red/10"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-display text-[13px] font-extrabold uppercase tracking-wide ${positive ? "text-gold" : "text-red"}`}>
          {emoji} {name}
        </span>
        {value && (
          <span className={`font-display text-lg font-extrabold ${positive ? "text-gold" : "text-red"}`}>{value}</span>
        )}
      </div>
      <p className="text-[12px] leading-relaxed text-text-dim">{body}</p>
      {children}
    </div>
  );
}

function StandingCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center">
      {icon}
      <h3 className="font-display text-[14px] font-extrabold leading-tight">{title}</h3>
      <p className="text-[12px] leading-relaxed text-text-dim">{body}</p>
    </div>
  );
}
