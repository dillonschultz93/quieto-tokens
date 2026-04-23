# Quieto Tokens Demo Plan (~4 minutes)

## 1. The Problem (30 sec)

Set the stage: teams either adopt someone else's design decisions wholesale (Tailwind defaults, Material's palette) or spend weeks hand-building a token system that's inconsistent, inaccessible, or hard to maintain. The tagline nails this: *"Tailwind gives you someone else's design decisions. Quieto gives you your own."*

## 2. Live Demo: Quick-Start Init (60-90 sec)

Run `quieto-tokens init` in an empty directory. Answer the 3-4 prompts live:
- Pick quick-start mode
- Provide a brand hex color
- Choose a spacing base unit
- Select a typography feel

Let the audience see the interactive prompts (clack UI), then show what got generated — open the `tokens/` and `build/` folders. Highlight the three tiers: primitive, semantic, and the generated CSS custom properties.

## 3. Accessibility & Color Ramps (30 sec)

Open one of the color JSON files or the CSS output. Point out the 10-step ramp (50-900). Call out that every step is **WCAG AA compliant by construction** — this isn't validated after the fact, it's enforced by `@quieto/engine` during generation. This is the key differentiator.

## 4. Multi-Platform Output (30 sec)

Briefly show or mention the output formats — if your config includes `"ios"`, `"android"`, or `"figma"`, the same `init` run also produces Swift files, Android XML/Compose, and a Figma Variables JSON. One source of truth, every platform. You could have a pre-generated example ready to flip through quickly rather than re-running init.

## 5. Evolving the System (60 sec)

Show one or two of these (pick whichever flows best live):
- **`quieto-tokens add shadow`** — add a new token category to the existing system
- **`quieto-tokens update`** — change just the spacing scale, show the terminal diff with cascade summary before confirming
- **`quieto-tokens inspect`** — run the health check to show orphan detection, broken references, and WCAG contrast audit

## 6. Wrap-Up (30 sec)

Recap the value prop:
- Generates a complete, accessible token system from a few inputs
- DTCG-aligned, works with the ecosystem
- Multi-platform (CSS, Figma, iOS, Android)
- Re-entrant — update and evolve without starting over
- Open source, published on npm as `@quieto/tokens`

## Tips

- Pre-install globally before the demo so there's no npm wait time
- Have a second terminal tab with a pre-generated output ready as a fallback in case a live run hits a snag
- If time is tight, cut section 4 (multi-platform) to a single sentence and spend the time on the live init + inspect combo, which is the most visually compelling flow
