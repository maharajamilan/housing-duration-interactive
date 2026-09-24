const DATA_CANDIDATES = [
  "data/public_predictions.json",
  "data/reference_scenario_predictions.json",
];

const DENSITY_CATEGORIES = [
  { max: 2500, label: "Low-density suburb" },
  { max: 7000, label: "City neighborhood" },
  { max: 17500, label: "Dense city neighborhood" },
  { max: Infinity, label: "Urban core" },
];

function densityLabel(value) {
  const number = Math.round(Number(value));
  const category = DENSITY_CATEGORIES.find(({ max }) => number < max).label;
  const perAcre = number / 640;
  return `${category} · ${number.toLocaleString()}/sq. mi. (${perAcre.toFixed(1)}/acre)`;
}

const DIMENSIONS = [
  {
    key: "units",
    label: "Homes or units",
    control: "range",
    allArchetypes: true,
    showTicks: true,
    format: (value) => Number(value).toLocaleString(),
  },
  {
    key: "sqft_per_unit",
    label: "Floor area per unit",
    control: "range",
    format: (value) => `${Math.round(value).toLocaleString()} sq. ft.`,
  },
  {
    key: "lot_size_acres",
    label: "Lot size",
    only: "new_sfr",
    control: "range",
    format: (value) => `${Number(value).toFixed(2)} acre${Number(value) === 1 ? "" : "s"}`,
  },
  {
    key: "attached",
    label: "Structure",
    only: "new_sfr",
    format: (value) => (Number(value) === 1 ? "Attached" : "Detached"),
  },
  {
    key: "sfr_project_type_id",
    label: "Development setting",
    only: "new_sfr",
    format: (value) =>
      ({ 1: "One-off infill", 2: "Subdivision", 3: "Small cluster" })[Number(value)],
  },
  {
    key: "pop_density",
    label: "Population density",
    control: "range",
    format: densityLabel,
    endFormat: (value) => densityLabel(value).split(" · ")[0],
  },
  {
    key: "median_income",
    label: "Neighborhood income",
    control: "range",
    format: (value) => `$${Math.round(value).toLocaleString()}`,
  },
];

const state = {
  data: null,
  archetype: "new_sfr",
  scenario: null,
  view: "cities",
  showCI: true,
  query: "",
  selections: {},
};

const elements = {
  scenarioControls: document.querySelector("#scenario-controls"),
  rankingTitle: document.querySelector("#ranking-title"),
  citiesView: document.querySelector("#cities-view"),
  viewButtons: [...document.querySelectorAll("[data-view]")],
  showCI: document.querySelector("#show-ci"),
  search: document.querySelector("#city-search"),
  chart: document.querySelector("#ranking-chart"),
  status: document.querySelector("#chart-status"),
  axis: document.querySelector("#duration-axis"),
  timeSeriesSection: document.querySelector("#time-series-section"),
  timeSeriesChart: document.querySelector("#time-series-chart"),
  selectTemplate: document.querySelector("#select-template"),
};

async function loadData() {
  if (window.CURRENT_PREDICTIONS) return normalizeData(window.CURRENT_PREDICTIONS);
  for (const url of DATA_CANDIDATES) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      return normalizeData(await response.json());
    } catch (_) {
      // Try the reference-data fallback.
    }
  }
  throw new Error("Prediction data could not be loaded.");
}

function normalizeData(data) {
  const timeSeries = data.time_series_schema
    ? data.time_series.map((values) =>
        Object.fromEntries(data.time_series_schema.map((key, index) => [key, values[index]])),
      )
    : data.time_series;
  if (!data.row_schema) return { ...data, time_series: timeSeries };
  const schema = data.row_schema;
  return {
    ...data,
    time_series: timeSeries,
    rows: data.rows.map((values) => Object.fromEntries(schema.map((key, index) => [key, values[index]]))),
  };
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => Number(a) - Number(b));
}

function scenariosForArchetype() {
  return state.data.scenarios.filter((scenario) => scenario.archetype === state.archetype);
}

function scenariosForDimension(dimension) {
  return dimension.allArchetypes ? state.data.scenarios : scenariosForArchetype();
}

function activeDimensions() {
  return DIMENSIONS.filter((dimension) => !dimension.only || dimension.only === state.archetype);
}

function setDefaultScenario() {
  const scenarios = scenariosForArchetype();
  state.scenario = scenarios.find((scenario) => Number(scenario.is_default) === 1) || scenarios[0];
  state.selections = Object.fromEntries(DIMENSIONS.map(({ key }) => [key, state.scenario[key]]));
}

function selectProjectSize(value) {
  const candidates = state.data.scenarios.filter(
    (scenario) => Number(scenario.units) === Number(value),
  );
  const scenario = candidates.find((candidate) => Number(candidate.is_default) === 1) || candidates[0];
  state.archetype = scenario.archetype;
  state.scenario = scenario;
  state.selections = Object.fromEntries(DIMENSIONS.map(({ key }) => [key, scenario[key]]));
}

function renderScenarioControls() {
  elements.scenarioControls.replaceChildren();

  for (const dimension of activeDimensions()) {
    const dimensionScenarios = scenariosForDimension(dimension);
    const values = unique(dimensionScenarios.map((scenario) => scenario[dimension.key]));
    const selectedIndex = Math.max(
      0,
      values.findIndex((value) => Number(value) === Number(state.selections[dimension.key])),
    );

    if (dimension.control === "range" && values.length > 1) {
      const setting = document.createElement("label");
      setting.className = "setting setting--range";
      const heading = document.createElement("span");
      heading.className = "range-heading";
      const label = document.createElement("span");
      label.className = "setting__label";
      label.textContent = dimension.label;
      const output = document.createElement("output");
      output.className = "range-value";
      output.textContent = dimension.format(values[selectedIndex]);
      heading.append(label, output);

      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = String(values.length - 1);
      input.step = "1";
      input.value = String(selectedIndex);
      input.setAttribute("aria-label", dimension.label);
      input.setAttribute("aria-valuetext", dimension.format(values[selectedIndex]));

      const scaleLabels = document.createElement("span");
      const endFormat = dimension.endFormat || dimension.format;
      if (dimension.showTicks) {
        scaleLabels.className = "range-ticks";
        scaleLabels.style.setProperty("--tick-count", values.length);
        for (const value of values) {
          const tick = document.createElement("span");
          tick.textContent = endFormat(value);
          scaleLabels.append(tick);
        }
      } else {
        scaleLabels.className = "range-ends";
        scaleLabels.innerHTML = `<span>${endFormat(values[0])}</span><span>${endFormat(values.at(-1))}</span>`;
      }

      const updateRange = () => {
        const index = Number(input.value);
        const value = values[index];
        const formatted = dimension.format(value);
        output.textContent = formatted;
        input.setAttribute("aria-valuetext", formatted);
        input.style.setProperty("--range-position", `${(index / (values.length - 1)) * 100}%`);
        if (dimension.allArchetypes) {
          selectProjectSize(value);
          renderResults();
        } else {
          state.selections[dimension.key] = Number(value);
          selectScenarioFromSettings();
          renderResults();
        }
      };
      input.style.setProperty(
        "--range-position",
        `${(selectedIndex / (values.length - 1)) * 100}%`,
      );
      input.addEventListener("input", updateRange);
      if (dimension.allArchetypes) input.addEventListener("change", render);
      setting.append(heading, input, scaleLabels);
      elements.scenarioControls.append(setting);
      continue;
    }

    if (values.length === 1) {
      const setting = document.createElement("div");
      setting.className = "setting setting--fixed";
      setting.innerHTML = `<span class="setting__label">${dimension.label}</span><span class="fixed-value">${dimension.format(values[0])}</span>`;
      elements.scenarioControls.append(setting);
      continue;
    }

    const fragment = elements.selectTemplate.content.cloneNode(true);
    const label = fragment.querySelector(".setting__label");
    const select = fragment.querySelector("select");
    label.textContent = dimension.label;
    select.setAttribute("aria-label", dimension.label);
    for (const value of values) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = dimension.format(value);
      option.selected = Number(value) === Number(state.selections[dimension.key]);
      select.append(option);
    }
    select.addEventListener("change", () => {
      state.selections[dimension.key] = Number(select.value);
      selectScenarioFromSettings();
      renderResults();
    });
    elements.scenarioControls.append(fragment);
  }
}

function selectScenarioFromSettings() {
  state.scenario = scenariosForArchetype().find((scenario) =>
    activeDimensions().every(
      (dimension) => Number(scenario[dimension.key]) === Number(state.selections[dimension.key]),
    ),
  );
}

function formatYears(value) {
  const rounded = Number(value).toFixed(value < 1 ? 2 : 1);
  return `${rounded} ${Number(rounded) === 1 ? "year" : "years"}`;
}

function formatAxisValue(value) {
  if (value === 0) return "0";
  return String(Number(value.toFixed(2)));
}

function niceScaleMaximum(value) {
  const roughStep = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const step = [1, 1.25, 1.5, 2, 2.5, 5, 10].find((candidate) => candidate >= normalized);
  return step * magnitude * 4;
}

function percentile(values, probability) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
}

function hasWideInterval(row) {
  const span = Number(row.pred_ul) - Number(row.pred_ll);
  return span > 0.5 && span / Math.max(Number(row.pred), 0.05) > 1;
}

function renderAxis(maximum) {
  elements.axis.replaceChildren();
  for (let index = 0; index <= 4; index += 1) {
    const tick = document.createElement("span");
    tick.textContent = formatAxisValue((maximum * index) / 4);
    tick.style.left = `${index * 25}%`;
    elements.axis.append(tick);
  }
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function seriesPath(points, x, y) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.cohort_year)},${y(point.pred)}`)
    .join(" ");
}

function intervalPath(points, x, y) {
  const upper = points.map((point) => `${x(point.cohort_year)},${y(point.pred_ul)}`);
  const lower = [...points]
    .reverse()
    .map((point) => `${x(point.cohort_year)},${y(Math.max(0, point.pred_ll))}`);
  return `M${upper.join(" L")} L${lower.join(" L")} Z`;
}

function renderTimeChart(definition, points) {
  const panel = document.createElement("section");
  panel.className = `time-chart-panel time-chart-panel--${definition.kind}`;
  const heading = document.createElement("h4");
  heading.textContent = definition.label;
  panel.append(heading);

  const containerWidth = Math.max(360, Math.round(elements.timeSeriesChart.clientWidth || 760));
  const width = containerWidth >= 720 ? Math.round((containerWidth - 28) / 2) : containerWidth;
  const height = width < 560 ? 360 : 400;
  const margin = { top: 16, right: 20, bottom: 48, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const years = points.map((row) => Number(row.cohort_year));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const maxDuration = niceScaleMaximum(Math.max(...points.map((row) => Number(row.pred_ul))) * 1.02);
  const x = (year) => margin.left + ((Number(year) - minYear) / (maxYear - minYear)) * plotWidth;
  const y = (value) => margin.top + plotHeight - (Number(value) / maxDuration) * plotHeight;

  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-labelledby": `time-series-${definition.kind}-title time-series-${definition.kind}-desc`,
  });
  const title = svgElement("title", { id: `time-series-${definition.kind}-title` });
  title.textContent = `${state.scenario.housing_type} ${definition.label.toLowerCase()} by submission year`;
  const description = svgElement("desc", { id: `time-series-${definition.kind}-desc` });
  description.textContent = "Lognormal AFT estimates with 95% confidence intervals.";
  svg.append(title, description);

  for (let index = 0; index <= 4; index += 1) {
    const value = (maxDuration * index) / 4;
    const yPosition = y(value);
    svg.append(
      svgElement("line", {
        class: "time-grid",
        x1: margin.left,
        x2: margin.left + plotWidth,
        y1: yPosition,
        y2: yPosition,
      }),
    );
    const label = svgElement("text", {
      class: "time-axis-label",
      x: margin.left - 10,
      y: yPosition + 4,
      "text-anchor": "end",
    });
    label.textContent = formatAxisValue(value);
    svg.append(label);
  }

  const yearTicks = [2000, 2005, 2010, 2015, 2020, 2025].filter(
    (year) => year >= minYear && year <= maxYear,
  );
  for (const year of yearTicks) {
    const xPosition = x(year);
    svg.append(
      svgElement("line", {
        class: "time-grid time-grid--vertical",
        x1: xPosition,
        x2: xPosition,
        y1: margin.top,
        y2: margin.top + plotHeight,
      }),
    );
    const label = svgElement("text", {
      class: "time-axis-label",
      x: xPosition,
      y: margin.top + plotHeight + 22,
      "text-anchor": "middle",
    });
    label.textContent = year;
    svg.append(label);
  }

  svg.append(
    svgElement("path", {
      class: `time-band time-band--${definition.kind}`,
      d: intervalPath(points, x, y),
    }),
    svgElement("path", {
      class: `time-line time-line--${definition.kind}`,
      d: seriesPath(points, x, y),
    }),
  );

  for (const point of points) {
    const marker = svgElement("circle", {
      class: `time-point time-point--${definition.kind}`,
      cx: x(point.cohort_year),
      cy: y(point.pred),
      r: 3,
    });
    const markerTitle = svgElement("title");
    markerTitle.textContent = `${point.cohort_year}: ${definition.label.toLowerCase()} ${formatYears(point.pred)}`;
    marker.append(markerTitle);
    svg.append(marker);
  }

  svg.append(
    svgElement("line", {
      class: "time-axis",
      x1: margin.left,
      x2: margin.left + plotWidth,
      y1: margin.top + plotHeight,
      y2: margin.top + plotHeight,
    }),
  );
  const xTitle = svgElement("text", {
    class: "time-axis-title",
    x: margin.left + plotWidth / 2,
    y: height - 8,
    "text-anchor": "middle",
  });
  xTitle.textContent = "Submission year";
  const yTitle = svgElement("text", {
    class: "time-axis-title",
    x: 15,
    y: margin.top + plotHeight / 2,
    transform: `rotate(-90 15 ${margin.top + plotHeight / 2})`,
    "text-anchor": "middle",
  });
  yTitle.textContent = "Predicted duration (years)";
  svg.append(xTitle, yTitle);
  panel.append(svg);
  return panel;
}

function renderTimeSeries() {
  if (!state.scenario || state.view !== "time") {
    elements.timeSeriesSection.hidden = true;
    return;
  }
  const rows = (state.data.time_series || []).filter((row) =>
    row.scenario_id
      ? row.scenario_id === state.scenario.scenario_id
      : row.archetype === state.archetype,
  );
  if (!rows.length) {
    elements.timeSeriesSection.hidden = true;
    elements.timeSeriesChart.replaceChildren();
    return;
  }

  elements.timeSeriesSection.hidden = false;
  const definitions = [
    { outcome: "time_to_build", label: "Total project duration", kind: "total" },
    { outcome: "time_to_issue", label: "Permitting duration", kind: "permit" },
  ];
  const panels = definitions.map((definition) => {
    const points = rows
      .filter((row) => row.outcome === definition.outcome)
      .sort((a, b) => Number(a.cohort_year) - Number(b.cohort_year));
    return renderTimeChart(definition, points);
  });
  elements.timeSeriesChart.replaceChildren(...panels);
}

function pairCityRows(rows) {
  const cities = new Map();
  for (const row of rows) {
    const current = cities.get(row.city_state) || { city: row.city, state: row.state };
    current[row.outcome] = row;
    cities.set(row.city_state, current);
  }
  return [...cities.entries()]
    .filter(([, pair]) => pair.time_to_issue && pair.time_to_build)
    .map(([cityState, pair]) => ({ cityState, ...pair }))
    .filter(
      ({ time_to_issue: issue, time_to_build: total }) =>
        !hasWideInterval(issue) && !hasWideInterval(total),
    )
    .sort((a, b) => b.time_to_build.pred - a.time_to_build.pred)
    .map((pair, index) => ({ ...pair, displayRank: index + 1 }));
}

function intervalMarkup(row, kind, maxUpper) {
  const ll = Math.min(maxUpper, Math.max(0, Number(row.pred_ll)));
  const ul = Number(row.pred_ul);
  const visibleUl = Math.min(ul, maxUpper);
  const clippedClass = ul > maxUpper ? " ci--clipped" : "";
  const width = Math.max(0, visibleUl - ll);
  return `<span class="ci ci--${kind}${clippedClass}" style="left:${(ll / maxUpper) * 100}%;width:${(width / maxUpper) * 100}%"></span>`;
}

function renderViewState() {
  const acrossCities = state.view === "cities";
  elements.rankingTitle.textContent = acrossCities ? "City rankings" : "Duration over time";
  elements.citiesView.hidden = !acrossCities;
  elements.timeSeriesSection.hidden = acrossCities;
  for (const button of elements.viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  }
}

function renderResults() {
  renderViewState();
  if (!state.scenario) {
    elements.chart.replaceChildren();
    elements.status.textContent = "This combination is not available.";
    elements.timeSeriesSection.hidden = true;
    return;
  }

  if (state.view === "time") {
    renderTimeSeries();
    return;
  }

  const scenarioRows = state.data.rows.filter((row) => row.scenario_id === state.scenario.scenario_id);
  const allRows = pairCityRows(scenarioRows);
  const upperBounds = allRows.flatMap(({ time_to_issue: issue, time_to_build: total }) => [
    Number(issue.pred_ul),
    Number(total.pred_ul),
  ]);
  const pointEstimates = allRows.flatMap(({ time_to_issue: issue, time_to_build: total }) => [
    Number(issue.pred),
    Number(total.pred),
  ]);
  const maxUpper = niceScaleMaximum(
    Math.max(percentile(upperBounds, 0.975) * 1.02, percentile(pointEstimates, 0.975) * 1.08),
  );
  const visible = allRows.filter(({ cityState }) =>
    cityState.toLowerCase().includes(state.query.toLowerCase()),
  );
  elements.status.textContent = `${visible.length} of ${allRows.length} cities shown.`;
  renderAxis(maxUpper);
  elements.chart.replaceChildren();

  for (const pair of allRows) {
    const { time_to_issue: issue, time_to_build: total } = pair;
    const item = document.createElement("li");
    item.className = "city-row";
    item.hidden = !visible.includes(pair);
    const totalClipped = Number(total.pred) > maxUpper;
    const issueClipped = Number(issue.pred) > maxUpper;
    const totalWidth = (Math.min(Number(total.pred), maxUpper) / maxUpper) * 100;
    const issueWidth = (Math.min(Number(issue.pred), maxUpper) / maxUpper) * 100;
    item.innerHTML = `
      <span class="rank">${pair.displayRank}</span>
      <span class="city-name">${pair.city}<br><span>${pair.state}</span></span>
      <span class="plot" aria-hidden="true">
        <span class="duration-bar duration-bar--total${totalClipped ? " duration-bar--clipped" : ""}" style="width:${totalWidth}%"></span>
        <span class="duration-bar duration-bar--permit${issueClipped ? " duration-bar--clipped" : ""}" style="width:${issueWidth}%"></span>
        ${intervalMarkup(total, "total", maxUpper)}
        ${intervalMarkup(issue, "permit", maxUpper)}
      </span>
      <span class="value">
        <span class="value__total">${formatYears(total.pred)}</span>
        <span class="value__permit">${formatYears(issue.pred)}</span>
      </span>
    `;
    item.setAttribute(
      "aria-label",
      `Rank ${pair.displayRank}, ${pair.cityState}. Total project duration ${formatYears(total.pred)}, 95% confidence interval ${formatYears(total.pred_ll)} to ${formatYears(total.pred_ul)}. Permitting duration ${formatYears(issue.pred)}, 95% confidence interval ${formatYears(issue.pred_ll)} to ${formatYears(issue.pred_ul)}.`,
    );
    for (const interval of item.querySelectorAll(".ci")) interval.hidden = !state.showCI;
    elements.chart.append(item);
  }

  if (visible.length === 0) {
    elements.status.textContent = `No city matches “${state.query}”.`;
  }
}

function render() {
  renderScenarioControls();
  renderResults();
}

elements.showCI.addEventListener("change", () => {
  state.showCI = elements.showCI.checked;
  renderResults();
});

elements.search.addEventListener("input", () => {
  state.query = elements.search.value.trim();
  renderResults();
});

for (const button of elements.viewButtons) {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    renderResults();
  });
}

window.addEventListener("resize", () => {
  if (state.data && state.view === "time") renderTimeSeries();
});

loadData()
  .then((data) => {
    state.data = data;
    if (!data.scenarios.some((scenario) => scenario.archetype === state.archetype)) {
      state.archetype = data.scenarios[0].archetype;
    }
    setDefaultScenario();
    render();
  })
  .catch((error) => {
    elements.status.textContent = error.message;
    elements.chart.replaceChildren();
  });
