/* Shared charts for the multi-page control tower.
   Every figure is read from data/dashboard.json. */
(function () {
  const INK = "#1c1915";
  const MUTED = "#6b645b";
  const TEAL = "#0f5f66";
  const GOOD = "#1c7c4a";
  const WATCH = "#c4922a";
  const ACT = "#a61b12";
  const SAND = "#e7d3a8";
  const charts = [];

  const pct = (n) => (Number(n) * 100).toFixed(1) + "%";
  const num = (n) => Math.round(Number(n)).toLocaleString("en-GB");
  const days = (n) => {
    const v = Number(n);
    return Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1);
  };
  const money = (n) => {
    const v = Number(n);
    return v >= 100 ? "R$" + Math.round(v).toLocaleString("en-GB") : "R$" + Math.round(v);
  };

  function tip() {
    return {
      backgroundColor: "#fffdf8",
      borderColor: "#e3d9c8",
      borderWidth: 1,
      textStyle: { color: INK, fontSize: 13, fontFamily: "Inter, sans-serif" },
      extraCssText: "box-shadow: none; max-width: 280px; white-space: normal;",
    };
  }

  function mount(id) {
    const node = document.getElementById(id);
    if (!node) return null;
    const chart = echarts.init(node, null, { renderer: "canvas" });
    charts.push(chart);
    return chart;
  }

  function by(rows, key, value) {
    return rows.find((row) => row[key] === value);
  }

  function sentence(text) {
    const match = String(text).match(/^[\s\S]*?[.!?](?=\s+[A-Z]|$)/);
    return match ? match[0] : text;
  }

  function sortedWeekly(data) {
    return data.weekly.slice().sort((a, b) => a.week_start.localeCompare(b.week_start));
  }

  function spark(values, color) {
    const nums = values.filter((v) => v != null && !Number.isNaN(v));
    if (nums.length < 2) return "";
    const w = 86;
    const h = 28;
    const min = Math.min.apply(null, nums);
    const max = Math.max.apply(null, nums);
    const span = max - min || 1;
    const pts = nums.map((v, i) => {
      const x = (i / (nums.length - 1)) * (w - 2) + 1;
      const y = (1 - (v - min) / span) * (h - 4) + 2;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><polyline fill="none" stroke="' + color + '" stroke-width="1.6" points="' + pts + '"/></svg>';
  }

  function windowTrend(weekly, pick) {
    const rows = weekly.filter((row) => (row.measurable_orders || 0) >= 200 && pick(row) != null);
    if (rows.length < 16) return null;
    const avg = (slice) => slice.reduce((sum, row) => sum + pick(row), 0) / slice.length;
    const recent = avg(rows.slice(-8));
    const prior = avg(rows.slice(-16, -8));
    return { recent, prior, delta: recent - prior };
  }

  function trendLine(delta, kind) {
    if (delta == null || Math.abs(delta) < (kind === "rate" ? 0.002 : 0.05)) {
      return '<p class="trend">Flat versus the prior 8 weeks</p>';
    }
    const up = delta > 0;
    const good = kind === "rate" ? up : !up;
    const cls = (up ? "up" : "down") + (good ? "-good" : "-bad");
    const arrow = up ? "Up" : "Down";
    const amount = kind === "rate"
      ? Math.abs(delta * 100).toFixed(1) + " points"
      : days(Math.abs(delta)) + " days";
    return '<p class="trend ' + cls + '">' + arrow + " " + amount + " versus the prior 8 weeks</p>";
  }

  const KPI_LINKS = {
    on_time: "delivery.html",
    avg_days: "delivery.html",
    p90: "delivery.html",
    padding: "delivery.html",
    seller_miss: "sellers.html",
    freight: "freight.html",
    late_review: "customers.html",
    repeat: "actions.html",
  };

  function renderKpis(data, target) {
    const weekly = sortedWeekly(data);
    const series = {
      on_time: windowTrend(weekly, (row) => row.on_time_rate),
      avg_days: windowTrend(weekly, (row) => row.avg_delivery_days),
      p90: windowTrend(weekly, (row) => row.p90_delivery_days),
    };
    const sparks = {
      on_time: weekly.map((row) => row.on_time_rate),
      avg_days: weekly.map((row) => row.avg_delivery_days),
      p90: weekly.map((row) => row.p90_delivery_days),
    };
    const root = document.getElementById(target);
    data.kpis.forEach((kpi) => {
      const link = document.createElement("a");
      link.className = "kpi kpi-" + kpi.status;
      link.href = KPI_LINKS[kpi.id] || "index.html";
      const head = document.createElement("header");
      const title = document.createElement("h2");
      title.textContent = kpi.label;
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = kpi.status_label;
      head.append(title, badge);
      const row = document.createElement("div");
      row.className = "kpi-row";
      const value = document.createElement("p");
      value.className = "kpi-value";
      value.textContent = kpi.value;
      row.append(value);
      if (sparks[kpi.id]) {
        const color = kpi.status === "act" ? ACT : kpi.status === "watch" ? WATCH : TEAL;
        const holder = document.createElement("div");
        holder.innerHTML = spark(sparks[kpi.id], color);
        row.append(holder.firstChild);
      }
      const plain = document.createElement("p");
      plain.className = "kpi-plain";
      plain.textContent = kpi.plain;
      link.append(head, row);
      if (series[kpi.id]) {
        const kind = kpi.id === "on_time" ? "rate" : "days";
        const holder = document.createElement("div");
        holder.innerHTML = trendLine(series[kpi.id].delta, kind);
        link.append(holder.firstChild);
      }
      link.append(plain);
      root.append(link);
    });
  }

  function renderNotes(items, target, hrefFor) {
    const root = document.getElementById(target);
    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "note";
      const kick = document.createElement("p");
      kick.className = "kicker";
      kick.textContent = item.kicker || "";
      const title = document.createElement("h2");
      title.textContent = item.title;
      const body = document.createElement("p");
      body.textContent = sentence(item.body);
      card.append(kick, title, body);
      const href = hrefFor ? hrefFor(item, index) : null;
      if (href) {
        const more = document.createElement("a");
        more.className = "more";
        more.href = href;
        more.textContent = "Open the detail";
        card.append(more);
      }
      root.append(card);
    });
  }

  function weekMarks(weeks) {
    return [
      { week: "2017-11-20", name: "Black Friday" },
      { week: "2018-02-26", name: "Worst week" },
    ].filter((mark) => weeks.indexOf(mark.week) >= 0).map((mark) => ({
      xAxis: mark.week,
      name: mark.name,
      label: { formatter: mark.name, color: "#8a5a00", fontSize: 11, position: "insideEndTop" },
      lineStyle: { color: WATCH, type: "dashed", width: 1.4 },
    }));
  }

  function axisWeeks(weeks) {
    return {
      type: "category",
      data: weeks,
      axisLabel: {
        color: MUTED,
        hideOverlap: true,
        formatter: (value, index) => (index % 10 === 0 ? value.slice(0, 7) : ""),
      },
      axisLine: { lineStyle: { color: "#e3d9c8" } },
    };
  }

  function renderDelivery(data) {
    const weekly = sortedWeekly(data);
    const weeks = weekly.map((row) => row.week_start);
    const marks = weekMarks(weeks);
    document.getElementById("page-title").textContent = data.insights[0].title;
    document.getElementById("page-deck").textContent = data.takeaways.promise;

    mount("chart-promise").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = weekly[items[0].dataIndex];
          return row.week_start + "<br>Actual " + days(row.avg_delivery_days) + " days<br>Promised " + days(row.avg_promise_days) + " days";
        },
      }),
      grid: { left: 8, right: 78, top: 28, bottom: 8, containLabel: true },
      xAxis: axisWeeks(weeks),
      yAxis: { type: "value", axisLabel: { color: MUTED, formatter: (v) => v + "d" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      series: [
        {
          name: "Actual",
          type: "line",
          showSymbol: false,
          data: weekly.map((row) => row.avg_delivery_days),
          lineStyle: { width: 2.4, color: TEAL },
          itemStyle: { color: TEAL },
          endLabel: { show: true, formatter: "Actual", color: TEAL, fontSize: 12 },
          markLine: { symbol: "none", data: marks },
        },
        {
          name: "Promised",
          type: "line",
          showSymbol: false,
          data: weekly.map((row) => row.avg_promise_days),
          lineStyle: { width: 2.2, color: WATCH, type: "dashed" },
          itemStyle: { color: WATCH },
          endLabel: { show: true, formatter: "Promised", color: "#8a5a00", fontSize: 12 },
        },
      ],
    });
    document.getElementById("means-promise").textContent = "Solid line: days it actually took. Dashed line: the date the customer was given.";

    const rate = data.meta.on_time_rate * 100;
    mount("chart-ontime").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = weekly[items[0].dataIndex];
          return row.week_start + "<br>" + pct(row.on_time_rate) + " on time<br>" + num(row.orders) + " orders placed";
        },
      }),
      grid: { left: 8, right: 64, top: 28, bottom: 8, containLabel: true },
      xAxis: axisWeeks(weeks),
      yAxis: { type: "value", min: 70, max: 100, axisLabel: { color: MUTED, formatter: (v) => v + "%" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      series: [{
        type: "line",
        showSymbol: false,
        data: weekly.map((row) => row.on_time_rate == null ? null : +(row.on_time_rate * 100).toFixed(2)),
        lineStyle: { width: 2.4, color: TEAL },
        itemStyle: { color: TEAL },
        endLabel: { show: true, formatter: "On time", color: TEAL, fontSize: 12 },
        markLine: {
          symbol: "none",
          data: marks.concat([{
            yAxis: +rate.toFixed(2),
            label: { formatter: "Period " + pct(data.meta.on_time_rate), position: "insideStartTop", color: MUTED, fontSize: 11 },
            lineStyle: { color: "#9a8f7a", type: "dotted" },
          }]),
        },
      }],
    });

    const cycle = data.cycle;
    const parts = [
      { name: "Approval", value: cycle.approval_days, color: "#7daba8" },
      { name: "Seller handoff", value: cycle.seller_handling_days, color: TEAL },
      { name: "With the carrier", value: cycle.carrier_transit_days, color: "#12383c" },
      { name: "Date we promised", value: cycle.promise_days, color: WATCH },
    ];
    mount("chart-cycle").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (items) => items[0].name + "<br>" + days(items[0].value) + " days",
      }),
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { color: MUTED }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      yAxis: { type: "category", data: parts.map((part) => part.name).reverse(), axisLabel: { color: INK } },
      series: [{
        type: "bar",
        data: parts.slice().reverse().map((part) => ({
          value: part.value,
          itemStyle: { color: part.color, borderRadius: [0, 4, 4, 0] },
        })),
        label: { show: true, position: "right", formatter: (p) => days(p.value) + "d", color: INK, fontSize: 12 },
        barMaxWidth: 22,
      }],
    });
    document.getElementById("means-cycle").textContent = data.takeaways.cycle;
  }

  function renderRoutes(data) {
    document.getElementById("page-title").textContent = data.insights[1].title;
    document.getElementById("page-deck").textContent = data.takeaways.map;
    const daysValues = data.states.map((state) => state.avg_delivery_days);
    mount("chart-map").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "item",
        formatter: (p) => {
          const row = p.data;
          if (!row || row.value == null) return p.name;
          return "<strong>" + row.full + "</strong><br>" + days(row.value) + " days<br>" + pct(row.on_time_rate) + " on time<br>" + num(row.orders) + " deliveries";
        },
      }),
      visualMap: {
        min: Math.floor(Math.min.apply(null, daysValues)),
        max: Math.ceil(Math.max.apply(null, daysValues)),
        text: ["Slower", "Faster"],
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 12,
        itemHeight: 72,
        textStyle: { color: MUTED, fontSize: 11 },
        inRange: { color: [GOOD, "#e6c36a", ACT] },
      },
      series: [{
        type: "map",
        map: "brazil",
        roam: false,
        selectedMode: false,
        label: { show: false },
        emphasis: { label: { show: false } },
        itemStyle: { borderColor: "#fffdf8", borderWidth: 0.6 },
        data: data.states.map((state) => ({
          name: state.state,
          value: state.avg_delivery_days,
          full: state.state_name,
          on_time_rate: state.on_time_rate,
          orders: state.orders,
        })),
      }],
    });

    const lanes = data.lanes.slice(0, 8).reverse();
    mount("chart-lanes").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (items) => {
          const row = lanes[items[0].dataIndex];
          return row.label + "<br>" + num(row.orders) + " deliveries<br>" + pct(row.on_time_rate) + " on time<br>" + Math.round(row.extra_ontime).toLocaleString("en-GB") + " extra on-time deliveries if it matched the network";
        },
      }),
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { color: MUTED }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      yAxis: { type: "category", data: lanes.map((row) => row.short), axisLabel: { color: INK, fontSize: 12 } },
      series: [{
        type: "bar",
        data: lanes.map((row) => ({
          value: Math.round(row.extra_ontime),
          itemStyle: { color: row.on_time_rate < 0.88 ? ACT : TEAL, borderRadius: [0, 4, 4, 0] },
        })),
        label: { show: true, position: "right", color: INK, fontSize: 11 },
        barMaxWidth: 16,
      }],
    });
    document.getElementById("means-lanes").textContent = data.takeaways.lanes;

    const regions = data.freight_region.slice().sort((a, b) => b.avg_delivery_days - a.avg_delivery_days);
    mount("chart-regions").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = regions[items[0].dataIndex];
          return row.region + "<br>" + days(row.avg_delivery_days) + " days<br>" + pct(row.on_time_rate) + " on time";
        },
      }),
      grid: { left: 8, right: 36, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: regions.map((row) => row.region), axisLabel: { color: INK, interval: 0, fontSize: 12 } },
      yAxis: { type: "value", axisLabel: { color: MUTED, formatter: (v) => v + "d" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      series: [{
        type: "bar",
        data: regions.map((row) => ({
          value: row.avg_delivery_days,
          itemStyle: {
            color: row.avg_delivery_days > 18 ? ACT : row.avg_delivery_days > 14 ? WATCH : GOOD,
            borderRadius: [4, 4, 0, 0],
          },
          label: { show: true, position: "top", formatter: days(row.avg_delivery_days) + "d", color: INK, fontSize: 12 },
        })),
        barMaxWidth: 42,
      }],
    });
  }

  function bandName(row) {
    if (row.band_order === 4) return "On the\nday";
    const early = row.band_label.indexOf("early") >= 0;
    return row.band_label.split(" ")[0] + "\n" + (early ? "early" : "late");
  }

  function renderCustomers(data) {
    const bands = data.lateness.slice().sort((a, b) => a.band_order - b.band_order);
    document.getElementById("page-title").textContent = data.insights[3].title;
    document.getElementById("page-deck").textContent = data.takeaways.reviews;
    const cliffIndex = bands.findIndex((row) => row.band_order === 6);
    mount("chart-stars").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = bands[items[0].dataIndex];
          const star = items.find((item) => item.seriesName === "Stars");
          return row.band_label + "<br>" + Number(star.value).toFixed(2) + " stars<br>" + num(row.orders) + " orders";
        },
      }),
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: bands.map(bandName),
        axisLabel: { color: INK, fontSize: 11, interval: 0, lineHeight: 14 },
      },
      yAxis: { type: "value", min: 1, max: 5, axisLabel: { color: MUTED }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      series: [{
        name: "Stars",
        type: "line",
        data: bands.map((row) => row.avg_review),
        symbolSize: 8,
        lineStyle: { width: 2.6, color: ACT },
        itemStyle: { color: ACT },
        label: { show: true, formatter: (p) => Number(p.value).toFixed(1), color: INK, fontSize: 11 },
        markArea: cliffIndex >= 0 ? {
          itemStyle: { color: "rgba(166, 27, 18, 0.08)" },
          label: { show: true, color: ACT, fontSize: 11, formatter: "After 3 days late" },
          data: [[{ xAxis: cliffIndex }, { xAxis: bands.length - 1 }]],
        } : undefined,
      }],
    });

    mount("chart-mix").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (items) => {
          const row = bands[items[0].dataIndex];
          return row.band_label + "<br>" + items.map((item) => item.seriesName + " " + item.value.toFixed(0) + "%").join("<br>");
        },
      }),
      legend: { top: 0, textStyle: { color: MUTED, fontSize: 12 } },
      grid: { left: 8, right: 12, top: 28, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: bands.map(bandName),
        axisLabel: { color: INK, fontSize: 11, interval: 0, lineHeight: 14 },
      },
      yAxis: { type: "value", max: 100, axisLabel: { color: MUTED, formatter: (v) => v + "%" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      series: [
        { name: "1–2 stars", type: "bar", stack: "mix", data: bands.map((row) => row.share_low_score * 100), itemStyle: { color: ACT }, barMaxWidth: 28 },
        { name: "3–4 stars", type: "bar", stack: "mix", data: bands.map((row) => Math.max(0, (1 - row.share_low_score - row.share_five_star) * 100)), itemStyle: { color: SAND }, barMaxWidth: 28 },
        { name: "5 stars", type: "bar", stack: "mix", data: bands.map((row) => row.share_five_star * 100), itemStyle: { color: GOOD, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 28 },
      ],
    });
    const mixLine = data.insights[3].body.split(/(?<=\.)\s+/).find((part) => part.indexOf("one or two") >= 0);
    document.getElementById("means-mix").textContent = mixLine || sentence(data.insights[3].body);
  }

  function renderFreight(data) {
    document.getElementById("page-title").textContent = data.insights[5].title;
    document.getElementById("page-deck").textContent = sentence(data.insights[5].body);
    const prices = data.freight_price.slice().sort((a, b) => a.price_quartile - b.price_quartile);
    const labels = prices.map((row, index) => {
      if (index === 0) return "Up to " + money(row.max_merchandise);
      if (index === prices.length - 1) return money(row.min_merchandise) + "+";
      return money(row.min_merchandise) + "–" + money(row.max_merchandise);
    });
    mount("chart-price").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = prices[items[0].dataIndex];
          return labels[items[0].dataIndex] + "<br>" + pct(row.freight_share) + " of the basket<br>" + num(row.orders_freight_exceeds_price) + " orders cost more to ship than the goods";
        },
      }),
      grid: { left: 8, right: 8, top: 22, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: labels, axisLabel: { color: INK, interval: 0, fontSize: 11 } },
      yAxis: { type: "value", axisLabel: { color: MUTED, formatter: (v) => Math.round(v * 100) + "%" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      series: [{
        type: "bar",
        data: prices.map((row, index) => ({
          value: row.freight_share,
          itemStyle: { color: index === 0 ? ACT : TEAL, borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: "top", formatter: pct(row.freight_share), color: INK, fontSize: 12 },
        })),
        barMaxWidth: 46,
      }],
    });
    document.getElementById("means-price").textContent = data.takeaways.freight_price;

    const regions = data.freight_region.slice().sort((a, b) => b.median_freight_share - a.median_freight_share);
    mount("chart-region").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = regions[items[0].dataIndex];
          return row.region + "<br>Typical order " + pct(row.median_freight_share) + "<br>All freight " + pct(row.freight_share) + " of merchandise";
        },
      }),
      grid: { left: 8, right: 8, top: 22, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: regions.map((row) => row.region === "Central-West" ? "C-West" : row.region), axisLabel: { color: INK, interval: 0, fontSize: 12 } },
      yAxis: { type: "value", axisLabel: { color: MUTED, formatter: (v) => Math.round(v * 100) + "%" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      series: [{
        type: "bar",
        data: regions.map((row) => ({
          value: row.median_freight_share,
          itemStyle: { color: row.region === "North" || row.region === "Northeast" ? ACT : TEAL, borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: "top", formatter: pct(row.median_freight_share), color: INK, fontSize: 12 },
        })),
        barMaxWidth: 46,
      }],
    });
    document.getElementById("means-region").textContent = data.takeaways.freight_region;
  }

  function renderSellers(data) {
    const half = data.pareto.sellers_for_half;
    const point = data.pareto.curve.reduce((best, row) => {
      return Math.abs(row.sellers - half) < Math.abs(best.sellers - half) ? row : best;
    });
    document.getElementById("page-title").textContent = half + " sellers produce half the merchandise";
    document.getElementById("page-deck").textContent = data.takeaways.sellers;
    mount("chart-pareto").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => num(items[0].value[0]) + " sellers<br>" + pct(items[0].value[1]) + " of merchandise",
      }),
      grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: "value", name: "Sellers, largest first", nameLocation: "middle", nameGap: 26, axisLabel: { color: MUTED }, splitLine: { show: false } },
      yAxis: { type: "value", max: 1, axisLabel: { color: MUTED, formatter: (v) => Math.round(v * 100) + "%" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      series: [{
        type: "line",
        showSymbol: false,
        data: data.pareto.curve.map((row) => [row.sellers, row.gmv_share]),
        lineStyle: { width: 2.4, color: TEAL },
        itemStyle: { color: TEAL },
        markPoint: {
          symbol: "circle",
          symbolSize: 12,
          itemStyle: { color: ACT },
          label: {
          formatter: half + " sellers = half of sales",
          position: "right",
            distance: 8,
            color: INK,
            fontSize: 12,
            backgroundColor: "#fffdf8",
            borderColor: "#e3d9c8",
            borderWidth: 1,
            borderRadius: 6,
            padding: [4, 6],
          },
          data: [{ coord: [point.sellers, point.gmv_share] }],
        },
      }],
    });

    const slow = data.watch_sellers.slice().reverse();
    mount("chart-slow").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = slow[items[0].dataIndex];
          return row.state + " seller<br>" + days(row.avg_handling_days) + " days to the carrier<br>" + num(row.deliveries) + " deliveries<br>" + pct(row.on_time_rate) + " on time";
        },
      }),
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { color: MUTED, formatter: (v) => v + "d" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      yAxis: {
        type: "category",
        data: slow.map((row) => row.state + " · " + num(row.deliveries)),
        axisLabel: { color: INK, fontSize: 11 },
      },
      series: [{
        type: "bar",
        data: slow.map((row) => ({
          value: row.avg_handling_days,
          itemStyle: { color: ACT, borderRadius: [0, 4, 4, 0] },
        })),
        label: { show: true, position: "right", formatter: (p) => days(p.value) + "d", color: INK },
        barMaxWidth: 16,
      }],
    });

    const cats = data.categories.slice().sort((a, b) => b.avg_delivery_days - a.avg_delivery_days).slice(0, 8).reverse();
    mount("chart-cats").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = cats[items[0].dataIndex];
          return row.category_label + "<br>" + days(row.avg_delivery_days) + " days<br>" + pct(row.on_time_rate) + " on time<br>" + num(row.orders) + " deliveries";
        },
      }),
      grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { color: MUTED, formatter: (v) => v + "d" }, splitLine: { lineStyle: { color: "#f0e8da" } } },
      yAxis: {
        type: "category",
        data: cats.map((row) => row.category_label.replace(/\b\w/g, (ch) => ch.toUpperCase())),
        axisLabel: { color: INK, fontSize: 11, width: 140, overflow: "truncate" },
      },
      series: [{
        type: "bar",
        data: cats.map((row) => ({
          value: row.avg_delivery_days,
          itemStyle: { color: row.avg_delivery_days > 16 ? ACT : TEAL, borderRadius: [0, 4, 4, 0] },
        })),
        label: { show: true, position: "right", formatter: (p) => days(p.value) + "d", color: INK },
        barMaxWidth: 16,
      }],
    });
    const office = data.categories.find((row) => row.category_key === "office_furniture");
    document.getElementById("means-cats").textContent = office
      ? "Sorted by days to the door. Office furniture is the slow one: " + days(office.avg_delivery_days) + " days across " + num(office.orders) + " deliveries."
      : data.takeaways.categories;
  }

  function renderActions(data) {
    document.getElementById("page-title").textContent = "What to change, and how many orders it touches";
    document.getElementById("page-deck").textContent = "Each figure is the size of the pool in this order history. Lane maths keeps today’s volume and only closes the gap.";
    const small = document.getElementById("small-grid");
    data.small.forEach((item) => {
      const card = document.createElement("article");
      card.className = "small";
      const title = document.createElement("h2");
      title.textContent = item.title;
      const body = document.createElement("p");
      body.textContent = item.body;
      card.append(title, body);
      small.append(card);
    });
    const recs = document.getElementById("rec-grid");
    data.recommendations.forEach((item) => {
      const card = document.createElement("article");
      card.className = "rec";
      const impact = document.createElement("p");
      impact.className = "impact";
      impact.textContent = item.impact;
      const title = document.createElement("h2");
      title.textContent = item.title;
      const body = document.createElement("p");
      body.textContent = item.body;
      card.append(impact, title, body);
      recs.append(card);
    });
  }

  function renderOverview(data) {
    const meta = data.meta;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pretty = (iso) => {
      const parts = iso.split("-").map(Number);
      return parts[2] + " " + months[parts[1] - 1] + " " + parts[0];
    };
    document.getElementById("page-title").textContent = "The promise is carrying the on-time rate";
    document.getElementById("page-deck").textContent =
      num(meta.orders) + " orders placed from " + pretty(meta.cohort_start) + " to " + pretty(meta.cohort_end) +
      ". " + data.insights[0].title + ".";
    renderKpis(data, "kpis");
    const jumps = ["delivery.html", "routes.html", "routes.html", "customers.html"];
    renderNotes(data.insights.slice(0, 4), "insight-grid", (item, index) => jumps[index]);
  }

  const pages = {
    overview: renderOverview,
    delivery: renderDelivery,
    routes: renderRoutes,
    customers: renderCustomers,
    freight: renderFreight,
    sellers: renderSellers,
    actions: renderActions,
  };

  async function boot(page) {
    const response = await fetch("data/dashboard.json");
    if (!response.ok) throw new Error("dashboard data " + response.status);
    const data = await response.json();
    if (page === "routes") {
      const geo = await fetch("assets/brazil-states.geojson").then((res) => res.json());
      echarts.registerMap("brazil", geo);
    }
    pages[page](data);
    document.getElementById("footer-note").textContent =
      "Orders placed " + data.meta.cohort_start + " to " + data.meta.cohort_end +
      ". On-time means the delivery date is on or before the promised date. Method and sources are in the project README.";
    requestAnimationFrame(() => {
      charts.forEach((chart) => chart.resize());
      document.body.dataset.ready = "true";
    });
  }

  window.addEventListener("resize", () => charts.forEach((chart) => chart.resize()));
  window.Tower = { boot };
})();
