# CLAUDE.md

Guidance for Claude Code when working in this Shopify Theme repository.

## Branching & Workflow

- **Feature branches:** Every feature is developed on its own feature branch (e.g. `feature/<short-name>`). Never commit features directly to `main` or `staging`.
- **PR timing:** Only open a PR for a feature branch when the user explicitly confirms the feature is finished. Do not open PRs preemptively.
- **Merge targets:**
  - Feature branches always merge into `staging`.
  - `main` may only be updated by merging from `staging`. No direct feature → `main` merges.
- **PR documentation:** Each PR description must list all changes made on the branch (features, fixes, refactors, files touched at a high level).

## Security

- Before opening any PR, run the `/security-review` skill against the pending changes on the branch.
- Document the security review results in the PR description (summary + any findings).
- **Critical issues must be fixed on the fly**, even if they fall outside the immediate scope of the PR. Note such fixes in the PR description.

## Shopify Theme 2.0 Compliance

- Every PR must be aligned with the Shopify Online Store 2.0 standard (JSON templates, sections everywhere, app blocks, settings schemas, etc.).
- **Translations:** All new components must handle translations per Shopify Theme 2.0 conventions — use `locales/*.json` files and `{{ 'key' | t }}` in Liquid. Never hardcode user-facing strings.
- **Locale coverage:** Always add every new translation key to **every** locale file (both `locales/*.json` and `locales/*.schema.json`) with the English string as the fallback value, so translators can fill in later.
- **German on the fly:** When adding new translation keys, translate them into German immediately and write the proper German wording into `locales/de.json` and `locales/de.schema.json`. All other non-English locales keep the English fallback until a translator handles them.
- Use the Shopify CLI, Shopify-related Skills, and Shopify MCP plugins as the authoritative reference when in doubt (see `shopify-plugin:shopify-liquid`, `shopify-plugin:shopify-dev`, `shopify-developer`).

## Custom Blocks & Sections Naming

- **File prefix:** Every new custom block or section file must start with the `clyps-` prefix (e.g. `blocks/clyps-variant-availability.liquid`, `sections/clyps-hero.liquid`). Stock Shopify theme files stay as they are.
- **Display name:** The block or section display name (the schema `name` and its translation value) must start with `clyps ` followed by the custom name in title case, e.g. `clyps Variant Availability`, `clyps Hero`.
- **Schema type references:** When referencing the new block from other schemas (e.g. `_product-card.liquid`'s `blocks` array), use the `clyps-` prefixed type id.
- **Translation keys:** Mirror the naming in locale files — e.g. `names.clyps_variant_availability`: `"clyps Variant Availability"`.

## Performance, Accessibility, Browser Compat, SEO

Before opening any PR, audit the pending changes on the branch against all four of the following. Fix issues before opening the PR — do not defer them. Document findings and fixes in the PR description.

- **Performance:** Is this the most speed-friendly implementation? Check bundle size, render-blocking resources, LCP/CLS impact, image sizing, JS deferral, and whether code only loads where it is used.
- **Browser compatibility:** Does it have all fallbacks needed to work across evergreen browsers (latest Chrome, Safari, Firefox, Edge) plus the last two Safari iOS versions? Flag any unsupported CSS/JS features and add fallbacks or feature detection.
- **SEO:** Is it SEO friendly? Check semantic HTML, heading hierarchy, metadata, canonical URLs, crawlable markup, no content hidden behind JS that should be indexable, structured data where applicable.
- **Accessibility:** Is it accessible? Check WCAG 2.1 AA: keyboard navigation, focus management, ARIA usage, color contrast, reduced-motion support, screen-reader labels, touch targets.

Once all four pass (or issues are fixed on-branch), **auto-proceed** to the PR: run `/security-review`, then open the PR with all findings documented — no need to re-ask the user for confirmation at this point.

## PR Checklist

Before requesting review, confirm:

- [ ] Feature complete and confirmed by user
- [ ] Branched from and targeted at `staging` (not `main`)
- [ ] PR description lists all changes
- [ ] `/security-review` run and results documented; critical issues fixed
- [ ] Performance, browser compat, SEO, accessibility checks run and documented; issues fixed
- [ ] Shopify Theme 2.0 conventions followed
- [ ] All new user-facing strings are translated via `locales/*.json`
- [ ] New keys added to every locale file with English fallback; German (`de.json`, `de.schema.json`) filled with proper translations
- [ ] New blocks/sections use the `clyps-` file prefix and `clyps ` display-name prefix

## Local Dev Server

- **Store:** Always run the dev server against the clyps development store `cdc70c-2c.myshopify.com`. Do not let the Shopify CLI default to a previously-linked store (e.g. CLYPS) — the local theme files won't match that store's metafields/products and previews will 500.
- **Start command:**

  ```sh
  shopify theme dev --store cdc70c-2c.myshopify.com --port 9292
  ```

  This uploads the working tree as a development theme on the clips store and serves a hot-reloading preview at `http://127.0.0.1:9292`. The CLI also prints a public preview URL (`https://cdc70c-2c.myshopify.com/?preview_theme_id=…`) and a theme-editor URL — the editor URL is the right place to drop new blocks onto a section.
- **Restart on store mismatch:** If the dev server prints a different `*.myshopify.com` host in its banner, kill it (`pkill -f "shopify theme dev"`) and restart with the explicit `--store cdc70c-2c.myshopify.com` flag.
- **First-time auth:** If the CLI prompts for login, complete the OAuth flow in the browser using a Shopify account that has access to the clyps store. The CLI caches the token afterwards.
