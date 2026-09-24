# City Comparison interactive

This folder is a self-contained, static version of the housing-duration
interactive. It has no external JavaScript or CSS dependencies and does not
require a backend.

## Live version

<https://maharajamilan.github.io/housing-duration-interactive/>

Served from the `main` branch by GitHub Pages. Pushing to `main` republishes
the site within about a minute.

## Review locally

Open `index.html` in a current browser. The prediction data are bundled in
`data/current_predictions.js`, so the interactive also works when opened
directly from the downloaded folder.

## Publish

Upload this entire folder without changing its internal structure. The entry
page is `index.html`. A newsroom can host it at any static URL or place that URL
in an iframe, for example:

```html
<iframe
  src="https://example.com/city-comparison/index.html"
  title="Housing project duration comparison"
  loading="lazy"
  style="width: 100%; height: 900px; border: 0"
></iframe>
```

The embedded data file is about 36 MB before transfer compression. Production
hosting should enable gzip or Brotli compression, which is standard on most
newsroom content platforms and static hosts.

## Files

- `index.html`: page structure and metadata
- `styles.css`: responsive layout and visual styling
- `app.js`: controls, rankings, filtering, and time-series charts
- `data/current_predictions.js`: all public scenario and time-series results
- `exports/`: flattened city-level CSVs for table tools such as Datawrapper

## Editorial and statistical notes

- Across-city estimates use city-specific PPML models for projects submitted
  from 2015 through 2019. Confidence intervals are from Stata `margins`.
- Over-time estimates use pooled lognormal AFT models for submission years
  2000 through 2025.
- Rankings run from the longest to the shortest predicted total duration.
- A city is omitted when either displayed estimate has a confidence interval
  wider than 0.5 years and wider than the estimate itself.
- The over-time models include project-setting main effects and year fixed
  effects, but no setting-by-year interactions. Settings therefore change the
  predicted level, while the historical shape is shared within housing type.
- Confidence intervals describe predicted durations, not uncertainty in rank.

## Integration checks

Preserve the accessible labels and keyboard-operable controls if the component
is restyled or incorporated into a larger article. Test the iframe height at
the newsroom's desktop and mobile breakpoints; the ranking can be considerably
taller than the initial viewport.
