/* Stakeholder view. All numbers arrive in data/dashboard.json. */
(function () {
  const INK = "#1c1915";
  const MUTED = "#6b645b";
  const TEAL = "#0f5f66";
  const GOOD = "#1c7c4a";
  const WATCH = "#c4922a";
  const ACT = "#a61b12";
  const SAND = "#e7d3a8";
  const charts = [];

  const pct = (n) => (n * 100).toFixed(1) + "%";
  const num = (n) => Math.round(n).toLocaleString("en-GB");
  const days = (n) => {
    const v = Number(n);
    return Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1);
  };
  const brl = (n) => {
    const v = Number(n);
    if (Math.abs(v) >= 100) return "R$" + Math.round(v).toLocaleString("en-GB");
    return "R$" + v.toFixed(2);
  };
  const pretty = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return d + " " + months[m - 1] + " " + y;
  };
  const titleCase = (s) => s.replace(/\b\w/g, (ch) => ch.toUpperCase());

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(id) {
    const node = document.getElementById(id);
    const chart = echarts.init(node, null, { renderer: "canvas" });
    charts.push(chart);
    return chart;
  }

  function tip() {
    return {
      backgroundColor: "#fffdf8",
      borderColor: "#e3d9c8",
      borderWidth: 1,
      textStyle: { color: INK, fontSize: 13, fontFamily: "Inter, sans-serif" },
      extraCssText: "box-shadow: none; max-width: 260px; white-space: normal;",
    };
  }

  function render(data) {
    data.weekly.sort((a, b) => a.week_start.localeCompare(b.week_start));
    data.lateness.sort((a, b) => a.band_order - b.band_order);
    data.freight_price.sort((a, b) => a.price_quartile - b.price_quartile);
    data.dow.sort((a, b) => a.iso_day_of_week - b.iso_day_of_week);
    data.installments.sort((a, b) => a.bucket_order - b.bucket_order);
    const meta = data.meta;
    document.getElementById("lede").textContent =
      num(meta.orders) + " orders placed from " + pretty(meta.cohort_start) +
      " to " + pretty(meta.cohort_end) +
      ". Delivered orders are scored against the date the customer was promised. Every figure on this page is calculated from those orders.";

    const kpis = document.getElementById("kpis");
    data.kpis.forEach((kpi) => {
      const card = el("article", "kpi kpi-" + kpi.status);
      const head = el("header");
      head.append(el("h2", null, kpi.label), el("span", "badge", kpi.status_label));
      card.append(head, el("p", "kpi-value", kpi.value), el("p", "kpi-plain", kpi.plain));
      kpis.append(card);
    });

    const strip = document.getElementById("strip");
    data.strip.forEach((item) => {
      const card = el("article");
      card.append(el("span", null, item.label), el("strong", null, item.value), el("em", null, item.detail));
      strip.append(card);
    });

    const insights = document.getElementById("insight-grid");
    data.insights.forEach((item) => {
      const card = el("article", "insight");
      card.append(el("p", "kicker", item.kicker), el("h3", null, item.title), el("p", null, item.body));
      insights.append(card);
    });

    Object.entries(data.takeaways).forEach(([key, text]) => {
      const node = document.getElementById("take-" + key.replace(/_/g, "-"));
      if (node) node.textContent = text;
    });

    drawPromise(data);
    drawVolume(data);
    drawMap(data);
    drawLanes(data);
    drawHeat(data);
    drawCycle(data);
    drawReviews(data);
    drawFreightPrice(data);
    drawFreightRegion(data);
    drawPareto(data);
    drawSellers(data);
    drawCategories(data);
    drawDow(data);
    drawInstallments(data);

    const small = document.getElementById("small-grid");
    data.small.forEach((item) => {
      const card = el("article", "small");
      card.append(el("h3", null, item.title), el("p", null, item.body));
      small.append(card);
    });

    const recs = document.getElementById("rec-grid");
    data.recommendations.forEach((item) => {
      const card = el("article", "rec");
      card.append(el("p", "impact", item.impact), el("h3", null, item.title), el("p", null, item.body));
      recs.append(card);
    });

    document.getElementById("footer-note").append(
      el("p", null,
        "Orders placed " + pretty(meta.cohort_start) + " to " + pretty(meta.cohort_end) +
        ". On-time means the delivery date is on or before the promised date. " +
        "Distance is a straight line between the centres of the seller and customer postcodes. " +
        "The method, the data-quality notes and the source licence are in the project README."
      )
    );
  }

  function weekLabel(iso, index) {
    return index % 8 === 0 ? iso.slice(0, 7) : "";
  }

  function drawPromise(data) {
    const rows = data.weekly;
    mount("chart-promise").setOption({
      animation: false,
      tooltip: Object.assign(tip(), { trigger: "axis" }),
      legend: { data: ["Days actually taken", "Days we promised"], top: 0, textStyle: { color: MUTED } },
      grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map((r) => r.week_start),
        axisLabel: { formatter: weekLabel, color: MUTED, hideOverlap: true },
        axisLine: { lineStyle: { color: "#e3d9c8" } },
      },
      yAxis: {
        type: "value",
        name: "Days",
        nameTextStyle: { color: MUTED },
        axisLabel: { color: MUTED },
        splitLine: { lineStyle: { color: "#f0e8da" } },
      },
      series: [
        {
          name: "Days actually taken",
          type: "line",
          showSymbol: false,
          data: rows.map((r) => r.avg_delivery_days),
          lineStyle: { width: 2.4, color: TEAL },
          itemStyle: { color: TEAL },
        },
        {
          name: "Days we promised",
          type: "line",
          showSymbol: false,
          data: rows.map((r) => r.avg_promise_days),
          lineStyle: { width: 2.2, color: WATCH, type: "dashed" },
          itemStyle: { color: WATCH },
        },
      ],
    });
  }

  function drawVolume(data) {
    const rows = data.weekly;
    mount("chart-volume").setOption({
      animation: false,
      tooltip: Object.assign(tip(), { trigger: "axis" }),
      legend: { data: ["Orders placed", "On time"], top: 0, textStyle: { color: MUTED } },
      grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map((r) => r.week_start),
        axisLabel: { formatter: weekLabel, color: MUTED, hideOverlap: true },
        axisLine: { lineStyle: { color: "#e3d9c8" } },
      },
      yAxis: [
        {
          type: "value",
          name: "Orders",
          axisLabel: { color: MUTED },
          splitLine: { lineStyle: { color: "#f0e8da" } },
        },
        {
          type: "value",
          name: "On time",
          min: 60,
          max: 100,
          axisLabel: { formatter: (v) => v + "%", color: MUTED },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Orders placed",
          type: "bar",
          data: rows.map((r) => r.orders),
          itemStyle: { color: SAND },
          barMaxWidth: 14,
        },
        {
          name: "On time",
          type: "line",
          yAxisIndex: 1,
          showSymbol: false,
          data: rows.map((r) => (r.on_time_rate == null ? null : +(r.on_time_rate * 100).toFixed(1))),
          lineStyle: { width: 2.2, color: TEAL },
          itemStyle: { color: TEAL },
        },
      ],
    });
  }

  function drawMap(data) {
    const daysValues = data.states.map((s) => s.avg_delivery_days);
    mount("chart-map").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "item",
        formatter: (p) => {
          const row = p.data;
          if (!row || row.value == null) return p.name;
          return [
            "<strong>" + row.full + "</strong>",
            days(row.value) + " days to the door",
            pct(row.on_time_rate) + " on time",
            "Promise " + days(row.promise) + " days",
            num(row.orders) + " deliveries",
          ].join("<br>");
        },
      }),
      visualMap: {
        min: Math.floor(Math.min.apply(null, daysValues)),
        max: Math.ceil(Math.max.apply(null, daysValues)),
        text: ["Slower", "Faster"],
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 12,
        itemHeight: 80,
        textStyle: { color: MUTED, fontSize: 11 },
        inRange: { color: [GOOD, "#e6c36a", ACT] },
      },
      series: [{
        type: "map",
        map: "brazil",
        roam: false,
        selectedMode: false,
        nameProperty: "name",
        label: { show: false },
        emphasis: { label: { show: false }, itemStyle: { areaColor: "#12383c" } },
        itemStyle: { borderColor: "#fffdf8", borderWidth: 0.6 },
        data: data.states.map((s) => ({
          name: s.state,
          value: s.avg_delivery_days,
          full: s.state_name,
          on_time_rate: s.on_time_rate,
          promise: s.avg_promise_days,
          orders: s.orders,
        })),
      }],
    });
  }

  function drawLanes(data) {
    const rows = data.lanes.slice().reverse();
    mount("chart-lanes").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (items) => {
          const row = rows[items[0].dataIndex];
          return row.label + "<br>" + num(row.orders) + " deliveries · " +
            pct(row.on_time_rate) + " on time<br>" +
            Math.round(row.extra_ontime).toLocaleString("en-GB") + " extra on-time if it matched the network";
        },
      }),
      grid: { left: 8, right: 18, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        name: "Extra on-time deliveries",
        nameLocation: "middle",
        nameGap: 28,
        axisLabel: { color: MUTED },
        splitLine: { lineStyle: { color: "#f0e8da" } },
      },
      yAxis: {
        type: "category",
        data: rows.map((r) => r.short),
        axisLabel: { color: INK, fontSize: 12 },
      },
      series: [{
        type: "bar",
        data: rows.map((r) => Math.round(r.extra_ontime)),
        itemStyle: { color: TEAL, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18,
      }],
    });
  }

  function drawHeat(data) {
    if (window.innerWidth < 720) return;
    const heat = data.heatmap;
    const cells = heat.cells.map((c) => [
      heat.sellers.indexOf(c.seller),
      heat.customers.indexOf(c.customer),
      +(c.on_time_rate * 100).toFixed(1),
      c.orders,
      c.avg_delivery_days,
    ]);
    mount("chart-heat").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        formatter: (p) => {
          const seller = heat.sellers[p.value[0]];
          const customer = heat.customers[p.value[1]];
          return seller + " → " + customer + "<br>" +
            p.value[2].toFixed(1) + "% on time<br>" +
            days(p.value[4]) + " days · " + num(p.value[3]) + " deliveries";
        },
      }),
      grid: { left: 44, right: 12, top: 12, bottom: 72 },
      xAxis: {
        type: "category",
        data: heat.sellers,
        name: "Seller state",
        nameLocation: "middle",
        nameGap: 28,
        axisLabel: { color: INK },
      },
      yAxis: {
        type: "category",
        data: heat.customers,
        name: "Customer",
        nameLocation: "end",
        axisLabel: { color: INK },
      },
      visualMap: {
        min: 75,
        max: 98,
        dimension: 2,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 12,
        itemHeight: 90,
        text: ["Higher on-time", "Lower"],
        textStyle: { color: MUTED, fontSize: 11 },
        inRange: { color: [ACT, "#e6c36a", GOOD] },
      },
      series: [{
        type: "heatmap",
        data: cells,
        label: { show: false },
        itemStyle: { borderColor: "#fffdf8", borderWidth: 2 },
      }],
    });
  }

  function drawCycle(data) {
    const c = data.cycle;
    const stages = [
      { name: "Payment approval", value: c.approval_days },
      { name: "Seller hands to carrier", value: c.seller_handling_days },
      { name: "Carrier to customer", value: c.carrier_transit_days },
    ];
    let cursor = 0;
    const helper = [];
    const visible = [];
    stages.forEach((stage) => {
      helper.push(cursor);
      visible.push(stage.value);
      cursor += stage.value;
    });
    helper.push(0, 0);
    visible.push(c.delivery_days, c.promise_days);
    const labels = ["Approval", "Handoff", "In transit", "Total", "Promise"];
    mount("chart-cycle").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (items) => {
          const bar = items.find((item) => item.seriesName === "Days");
          return bar.name + "<br>" + days(bar.value) + " days";
        },
      }),
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: INK, interval: 0, fontSize: 12 },
      },
      yAxis: {
        type: "value",
        name: "Days",
        axisLabel: { color: MUTED },
        splitLine: { lineStyle: { color: "#f0e8da" } },
      },
      series: [
        { name: "Base", type: "bar", stack: "cycle", data: helper, itemStyle: { color: "transparent" }, emphasis: { disabled: true } },
        {
          name: "Days",
          type: "bar",
          stack: "cycle",
          data: visible.map((value, i) => ({
            value,
            itemStyle: { color: i === 4 ? WATCH : i === 3 ? "#12383c" : TEAL, borderRadius: [4, 4, 0, 0] },
          })),
          barMaxWidth: 48,
        },
      ],
    });
  }

  function drawReviews(data) {
    const rows = data.lateness;
    mount("chart-reviews").setOption({
      animation: false,
      tooltip: Object.assign(tip(), { trigger: "axis" }),
      legend: { data: ["Orders", "Average stars"], top: 0, textStyle: { color: MUTED } },
      grid: { left: 8, right: 12, top: 36, bottom: window.innerWidth < 720 ? 24 : 8, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map((r) => {
          if (r.band_order === 4) return "On\nthe day";
          const when = r.band_label.indexOf("early") >= 0 ? "early" : "late";
          const span = r.band_label.split(" ")[0];
          return span + "\n" + when;
        }),
        axisLabel: {
          color: INK,
          fontSize: 10,
          interval: 0,
          lineHeight: 13,
          width: 42,
          overflow: "break",
        },
      },
      yAxis: [
        { type: "value", axisLabel: { color: MUTED }, splitLine: { lineStyle: { color: "#f0e8da" } } },
        { type: "value", min: 1, max: 5, axisLabel: { color: MUTED }, splitLine: { show: false } },
      ],
      series: [
        {
          name: "Orders",
          type: "bar",
          data: rows.map((r) => r.orders),
          itemStyle: { color: SAND },
          barMaxWidth: 36,
        },
        {
          name: "Average stars",
          type: "line",
          yAxisIndex: 1,
          data: rows.map((r) => r.avg_review),
          symbolSize: 8,
          lineStyle: { width: 2.4, color: ACT },
          itemStyle: { color: ACT },
        },
      ],
    });
  }

  function money(n) {
    const v = Number(n);
    if (v >= 100) return "R$" + Math.round(v).toLocaleString("en-GB");
    return "R$" + Math.round(v);
  }
  function priceLabel(row, index) {
    if (index === 0) return "Up to " + money(row.max_merchandise);
    if (index === 3) return money(row.min_merchandise) + "+";
    return money(row.min_merchandise) + "–" + money(row.max_merchandise);
  }

  function drawFreightPrice(data) {
    const rows = data.freight_price;
    mount("chart-freight-price").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = rows[items[0].dataIndex];
          return priceLabel(row) + "<br>" +
            pct(row.freight_share) + " of the basket<br>" +
            pct(row.share_freight_exceeds_price) + " pay more to ship than the goods cost<br>" +
            num(row.orders) + " orders";
        },
      }),
      grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map(priceLabel),
        axisLabel: { color: INK, fontSize: 11, interval: 0, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        axisLabel: { formatter: (v) => Math.round(v * 100) + "%", color: MUTED },
        splitLine: { lineStyle: { color: "#f0e8da" } },
      },
      series: [{
        type: "bar",
        data: rows.map((r, i) => ({
          value: r.freight_share,
          itemStyle: { color: i === 0 ? ACT : TEAL, borderRadius: [4, 4, 0, 0] },
        })),
        barMaxWidth: 42,
      }],
    });
  }

  function drawFreightRegion(data) {
    const order = ["North", "Northeast", "Central-West", "Southeast", "South"];
    const rows = order.map((name) => data.freight_region.find((r) => r.region === name)).filter(Boolean);
    mount("chart-freight-region").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = rows[items[0].dataIndex];
          return row.region + "<br>" +
            pct(row.freight_share) + " of merchandise is freight<br>" +
            "Typical order " + pct(row.median_freight_share) + "<br>" +
            days(row.avg_delivery_days) + " days · " + pct(row.on_time_rate) + " on time";
        },
      }),
      grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map((r) => ({ North: "North", Northeast: "Northeast", "Central-West": "C-West", Southeast: "Southeast", South: "South" }[r.region] || r.region)),
        axisLabel: { color: INK, fontSize: 11, interval: 0 },
      },
      yAxis: {
        type: "value",
        axisLabel: { formatter: (v) => Math.round(v * 100) + "%", color: MUTED },
        splitLine: { lineStyle: { color: "#f0e8da" } },
      },
      series: [{
        type: "bar",
        data: rows.map((r) => ({
          value: r.median_freight_share,
          itemStyle: {
            color: r.region === "North" || r.region === "Northeast" ? ACT : TEAL,
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 42,
      }],
    });
  }

  function drawPareto(data) {
    const curve = data.pareto.curve;
    mount("chart-pareto").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = curve[items[0].dataIndex];
          return num(row.sellers) + " sellers<br>" + pct(row.gmv_share) + " of merchandise value";
        },
      }),
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: curve.map((r) => r.sellers),
        name: "Sellers, largest first",
        nameLocation: "middle",
        nameGap: 28,
        axisLabel: { color: MUTED, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        max: 1,
        axisLabel: { formatter: (v) => Math.round(v * 100) + "%", color: MUTED },
        splitLine: { lineStyle: { color: "#f0e8da" } },
      },
      series: [{
        type: "line",
        showSymbol: false,
        data: curve.map((r) => r.gmv_share),
        lineStyle: { width: 2.4, color: TEAL },
        areaStyle: { color: "rgba(15, 95, 102, 0.08)" },
        markLine: {
          symbol: "none",
          label: { show: false },
          lineStyle: { color: WATCH, type: "dashed" },
          data: [{ yAxis: 0.5 }, { yAxis: 0.8 }],
        },
      }],
    });
  }

  function drawSellers(data) {
    const wrap = document.getElementById("seller-table");
    const table = document.createElement("table");
    table.className = "fit";
    table.innerHTML = "<thead><tr><th>Seller</th><th class='num'>Orders</th><th class='num'>Handoff days</th><th class='num'>Misses deadline</th><th class='num'>On time</th></tr></thead>";
    const body = document.createElement("tbody");
    data.watch_sellers.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + row.state + "</td>" +
        "<td class='num'>" + num(row.deliveries) + "</td>" +
        "<td class='num'>" + days(row.avg_handling_days) + "</td>" +
        "<td class='num'>" + pct(row.miss_rate) + "</td>" +
        "<td class='num'>" + pct(row.on_time_rate) + "</td>";
      body.append(tr);
    });
    table.append(body);
    wrap.append(table);
  }

  function drawCategories(data) {
    const wrap = document.getElementById("category-table");
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Category</th><th class='num'>Deliveries</th><th class='num'>On time</th><th class='num'>Days</th><th class='num'>9 in 10</th><th class='num'>Freight share</th><th class='num'>Stars</th></tr></thead>";
    const body = document.createElement("tbody");
    data.categories.slice(0, 18).forEach((row) => {
      const tr = document.createElement("tr");
      const tone = row.on_time_rate < 0.90 ? "late" : row.on_time_rate >= 0.95 ? "ok" : "";
      tr.innerHTML =
        "<td>" + titleCase(row.category_label) + "</td>" +
        "<td class='num'>" + num(row.orders) + "</td>" +
        "<td class='num " + tone + "'>" + pct(row.on_time_rate) + "</td>" +
        "<td class='num'>" + days(row.avg_delivery_days) + "</td>" +
        "<td class='num'>" + days(row.p90_delivery_days) + "</td>" +
        "<td class='num'>" + pct(row.freight_share) + "</td>" +
        "<td class='num'>" + (row.avg_review == null ? "—" : row.avg_review.toFixed(2)) + "</td>";
      body.append(tr);
    });
    table.append(body);
    wrap.append(table);
  }

  function drawDow(data) {
    const rows = data.dow;
    mount("chart-dow").setOption({
      animation: false,
      tooltip: Object.assign(tip(), { trigger: "axis" }),
      legend: { data: ["Days to the carrier", "Orders"], top: 0, textStyle: { color: MUTED } },
      grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map((r) => r.day_name.slice(0, 3)),
        axisLabel: { color: INK },
      },
      yAxis: [
        { type: "value", name: "Days", axisLabel: { color: MUTED }, splitLine: { lineStyle: { color: "#f0e8da" } } },
        { type: "value", name: "Orders", axisLabel: { color: MUTED }, splitLine: { show: false } },
      ],
      series: [
        {
          name: "Days to the carrier",
          type: "bar",
          data: rows.map((r) => ({
            value: r.avg_handling_days,
            itemStyle: { color: r.iso_day_of_week >= 5 && r.iso_day_of_week <= 6 ? ACT : TEAL, borderRadius: [4, 4, 0, 0] },
          })),
          barMaxWidth: 28,
        },
        {
          name: "Orders",
          type: "line",
          yAxisIndex: 1,
          showSymbol: false,
          data: rows.map((r) => r.orders),
          lineStyle: { width: 2, color: WATCH },
          itemStyle: { color: WATCH },
        },
      ],
    });
  }

  function drawInstallments(data) {
    const rows = data.installments;
    mount("chart-installments").setOption({
      animation: false,
      tooltip: Object.assign(tip(), {
        trigger: "axis",
        formatter: (items) => {
          const row = rows[items[0].dataIndex];
          return row.bucket_label + "<br>Basket " + brl(row.aov) +
            "<br>Cancellation " + pct(row.cancellation_rate) +
            "<br>On time " + pct(row.on_time_rate) +
            "<br>" + num(row.orders) + " orders";
        },
      }),
      legend: { data: ["Basket size", "Cancellation"], top: 0, textStyle: { color: MUTED } },
      grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map((r) => r.bucket_label.replace(" instalments", "").replace(" instalment", "")),
        axisLabel: { color: INK, fontSize: 11, interval: 0, hideOverlap: true },
      },
      yAxis: [
        { type: "value", name: "R$", axisLabel: { color: MUTED }, splitLine: { lineStyle: { color: "#f0e8da" } } },
        {
          type: "value",
          name: "Cancel",
          min: 0,
          max: 0.02,
          axisLabel: { formatter: (v) => (v * 100).toFixed(1) + "%", color: MUTED },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Basket size",
          type: "bar",
          data: rows.map((r) => Math.round(r.aov)),
          itemStyle: { color: TEAL, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 32,
        },
        {
          name: "Cancellation",
          type: "line",
          yAxisIndex: 1,
          data: rows.map((r) => r.cancellation_rate),
          symbolSize: 8,
          lineStyle: { width: 2.2, color: ACT },
          itemStyle: { color: ACT },
        },
      ],
    });
  }

  async function main() {
    const [data, geo] = await Promise.all([
      fetch("data/dashboard.json").then((res) => {
        if (!res.ok) throw new Error("dashboard.json " + res.status);
        return res.json();
      }),
      fetch("assets/brazil-states.geojson").then((res) => res.json()),
    ]);
    echarts.registerMap("brazil", geo);
    render(data);
    document.body.dataset.ready = "true";
    window.addEventListener("resize", () => charts.forEach((chart) => chart.resize()));
  }

  main().catch((err) => {
    document.getElementById("lede").textContent = "The dashboard data did not load. " + err.message;
  });
})();
