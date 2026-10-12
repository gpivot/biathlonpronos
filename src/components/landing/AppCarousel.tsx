"use client";

import { useState } from "react";

interface Slide {
  emoji: string;
  title: string;
  body: string;
}

export function AppCarousel({ slides, previousLabel, nextLabel }: { slides: Slide[]; previousLabel: string; nextLabel: string }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const go = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex w-full items-center justify-center">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label={previousLabel}
          className="absolute left-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-xl text-frost hover:bg-border"
        >
          ‹
        </button>
        <div className="flex aspect-[4/5] w-full max-w-[340px] flex-col items-center justify-center gap-4 rounded-3xl bg-gradient-to-b from-card2 to-card px-6 text-center">
          <div className="text-7xl">{slide.emoji}</div>
          <div className="font-display text-2xl font-extrabold">{slide.title}</div>
          <div className="text-sm text-text-dim">{slide.body}</div>
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label={nextLabel}
          className="absolute right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-xl text-frost hover:bg-border"
        >
          ›
        </button>
      </div>
      <div className="flex gap-2">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={s.title}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-text" : "w-1.5 bg-text-dim/60"}`}
          />
        ))}
      </div>
    </div>
  );
}
