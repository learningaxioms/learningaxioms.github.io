# AXIOM — math, actually taught

A math-learning app covering Arithmetic, Pre-Algebra, Algebra I and Geometry, built on how people actually learn:

1. **See it** — every concept has an interactive model (number lines, place-value blocks, area models, fraction bars, a balance scale for equations, draggable triangles, sliders for lines and parabolas).
2. **Watch one** — a worked example revealed one step at a time ("what would you do next?").
3. **Do it** — endless generated problems with a 3-rung hint ladder, two tries, and **misconception detection**: wrong answers like "added the denominators", "forgot to carry" or "flipped the wrong fraction" get a specific explanation.
4. **Master it** — a mastery meter that raises difficulty (Foundations → Standard → Challenge). You only master a skill by solving the hardest level unaided.
5. **Keep it** — mastered skills return in an interleaved spaced-review queue after 1, 3, 7, 16, 35 and 75 days.

Plus: adaptive placement tests per unit, a scratch pad, a live math preview of what you type, and progress saved in the browser.

## Run

```bash
npm install
npm run dev        # http://localhost:5200
```

## Check content

```bash
npm run validate   # generates 900 problems per skill and checks each against its own answer key
npm run check      # TypeScript
```

`SINGLE=1 npx vite build` produces a single self-contained `dist/index.html`.

## Layout

- `src/engine/` — types, seeded RNG + helpers, forgiving answer parser (fractions, mixed numbers, expressions compared numerically, pairs, sets, inequalities), mastery/spaced-review store.
- `src/content/` — one file per unit; each skill = learn cards + a problem generator.
- `src/widgets/` — KaTeX rich text, static diagrams, interactive explorers.
- `src/ui/` — pages (home, unit map, skill, review, placement) and the problem player.

## Live site

https://learningaxioms.github.io/

Deploy a new version with `npm run deploy` (builds, then force-pushes `dist/` to the `gh-pages` branch).
