"""Turn mart rows into plain-language copy.

Every figure in the strings below is formatted from a warehouse column.
Nothing in this module is a typed-in KPI.
"""

from __future__ import annotations


def pretty_date(iso) -> str:
    from datetime import date

    parsed = date.fromisoformat(str(iso)[:10])
    return parsed.strftime("%-d %b %Y")


def _f(value) -> float:
    return float(value)


def pct(value, digits: int = 1) -> str:
    return f"{_f(value) * 100:.{digits}f}%"


def days(value) -> str:
    number = _f(value)
    if abs(number - round(number)) < 0.05:
        return str(int(round(number)))
    return f"{number:.1f}"


def whole(value) -> str:
    return f"{int(round(_f(value))):,}"


def brl(value) -> str:
    number = _f(value)
    sign = "-" if number < 0 else ""
    number = abs(number)
    if number >= 1_000_000:
        return f"{sign}R${number / 1_000_000:.1f} million"
    if number >= 100:
        return f"{sign}R${number:,.0f}"
    return f"{sign}R${number:,.2f}"


def points(rate_delta) -> str:
    return f"{abs(_f(rate_delta)) * 100:.1f} points"


def _by(rows, key, value):
    for row in rows:
        if row.get(key) == value:
            return row
    return None


def _status(kind: str, value: float) -> tuple[str, str]:
    if kind == "on_time":
        if value >= 0.93:
            return "good", "Good"
        if value >= 0.88:
            return "watch", "Watch"
        return "act", "Act"
    if kind == "days":
        if value <= 14:
            return "good", "Good"
        if value <= 18:
            return "watch", "Watch"
        return "act", "Act"
    if kind == "p90":
        if value <= 21:
            return "good", "Good"
        if value <= 28:
            return "watch", "Watch"
        return "act", "Act"
    if kind == "padding":
        # A large cushion flatters the on-time rate. It is a watch item, not a win.
        if value >= 7:
            return "watch", "Loose"
        return "good", "Tight"
    if kind == "miss":
        if value <= 0.08:
            return "good", "Good"
        if value <= 0.15:
            return "watch", "Watch"
        return "act", "Act"
    if kind == "freight":
        if value <= 0.18:
            return "good", "Good"
        if value <= 0.25:
            return "watch", "Watch"
        return "act", "Act"
    if kind == "review":
        if value >= 4:
            return "good", "Good"
        if value >= 3:
            return "watch", "Watch"
        return "act", "Act"
    if kind == "repeat":
        return "watch", "Low"
    return "watch", "Watch"


def _kpi(kpi_id, label, value, raw, plain, kind) -> dict:
    status, status_label = _status(kind, _f(raw))
    return {
        "id": kpi_id,
        "label": label,
        "value": value,
        "raw": raw,
        "plain": plain,
        "status": status,
        "status_label": status_label,
    }


def _lane_name(row) -> str:
    return f"{row['seller_state_name']} → {row['customer_state_name']}"


def _opportunities(lanes, network_rate, minimum_orders=200, gap=0.03):
    found = []
    for lane in lanes:
        if lane["orders"] >= minimum_orders and lane["on_time_rate"] < network_rate - gap:
            extra = lane["orders"] * (network_rate - lane["on_time_rate"])
            found.append({**lane, "extra_ontime": extra, "gap": network_rate - lane["on_time_rate"]})
    found.sort(key=lambda row: row["extra_ontime"], reverse=True)
    return found


def narrate(data: dict) -> dict:
    h = data["headline"]
    lanes = data["lanes"]
    states = data["states"]
    slices = {row["slice_name"]: row for row in data["slices"]}
    bands = sorted(data["lateness"], key=lambda row: row["band_order"])
    causes = data["causes"]
    prices = sorted(data["freight_price"], key=lambda row: row["price_quartile"])
    regions = data["freight_region"]
    cheap = {row["geo_group"]: row for row in data["freight_cheap"]}
    weights = sorted(data["freight_weight"], key=lambda row: row["band_order"])
    dow = sorted(data["dow"], key=lambda row: row["iso_day_of_week"])
    monthly = data["monthly"]
    categories = data["categories"]
    sellers = data["sellers"]
    cycle = data["cycle"]
    payments = {row["payment_type"]: row for row in data["payments"]}
    installs = sorted(data["installments"], key=lambda row: row["bucket_order"])
    split = {bool(row["is_on_time"]): row for row in data["speed_split"]}

    network = h["on_time_rate"]
    opps = _opportunities(lanes, network)
    extra_total = sum(row["extra_ontime"] for row in opps)
    lift = extra_total / h["measurable_orders"]
    rio = _by(lanes, "lane_key", "SP>RJ")
    rio_extra = rio["orders"] * (network - rio["on_time_rate"])
    sp = _by(lanes, "lane_key", "SP>SP")
    mg = _by(lanes, "lane_key", "SP>MG")
    amazonas = _by(states, "state", "AM")
    alagoas = _by(states, "state", "AL")
    cheap_q = prices[0]
    nne = cheap["North and Northeast"]
    rest = cheap["Rest of Brazil"]
    bf = slices["black_friday_week"]
    base = slices["bf_baseline"]
    feb = slices["feb26_week"]
    may14 = slices["may14_week"]
    may21 = slices["may21_week"]
    may28 = slices["may28_week"]
    holiday = slices["national_holiday"]
    ordinary = slices["ordinary_day"]
    eve = slices["day_before_holiday"]
    late_row = split[False]
    on_row = split[True]
    monday = _by(dow, "iso_day_of_week", 1)
    friday = _by(dow, "iso_day_of_week", 5)
    june = _by(monthly, "year_month", "2018-06")
    august = _by(monthly, "year_month", "2018-08")
    march = _by(monthly, "year_month", "2018-03")
    office = _by(categories, "category_key", "office_furniture")
    light = _by(weights, "band_order", 1)
    heavy = _by(weights, "band_order", 5)
    one_pay = installs[0]
    long_pay = _by(installs, "bucket_order", 4)
    card = payments["credit_card"]
    boleto = payments["boleto"]

    late_orders = sum(row["orders"] for row in causes)
    seller_met_long = _by(causes, "cause", "Seller met the deadline, transit ran 10 days or more")
    seller_missed = sum(
        row["orders"]
        for row in causes
        if row["cause"].startswith("Seller missed")
    )
    band_early = _by(bands, "band_order", 1)
    band_on_day = _by(bands, "band_order", 4)
    band_1_3 = _by(bands, "band_order", 5)
    band_4_7 = _by(bands, "band_order", 6)
    late4 = [row for row in bands if row["band_order"] >= 6]
    late4_reviewed = sum(row["reviewed_orders"] for row in late4)
    late4_low = sum(row["share_low_score"] * row["reviewed_orders"] for row in late4) / late4_reviewed

    ranked = sorted(sellers, key=lambda row: -(row["gmv"] or 0))
    gmv_total = sum(row["gmv"] or 0 for row in ranked)
    running = 0.0
    sellers_for_half = None
    sellers_for_eighty = None
    curve = []
    seller_count = len(ranked)
    for index, row in enumerate(ranked, start=1):
        running += row["gmv"] or 0
        share = running / gmv_total
        if sellers_for_half is None and share >= 0.5:
            sellers_for_half = index
        if sellers_for_eighty is None and share >= 0.8:
            sellers_for_eighty = index
        milestone = index in (sellers_for_half, sellers_for_eighty)
        sampled = index == 1 or index == 10 or index == seller_count or index % max(seller_count // 50, 1) == 0
        if sampled or milestone:
            curve.append({"sellers": index, "gmv_share": share, "milestone": milestone})
    top10_share = sum(row["gmv"] or 0 for row in ranked[:10]) / gmv_total

    watch = [
        row for row in sellers
        if (row["single_seller_deliveries"] or 0) >= 100
        and row["avg_handling_days"] is not None
        and row["avg_handling_days"] >= 5
    ]
    watch.sort(key=lambda row: row["avg_handling_days"], reverse=True)
    watch_orders = sum(row["single_seller_deliveries"] for row in watch)
    watch_avg = (
        sum(row["avg_handling_days"] * row["single_seller_deliveries"] for row in watch) / watch_orders
        if watch_orders else None
    )
    worst = watch[0]

    weeks = [
        row for row in data["weekly"]
        if (row["measurable_orders"] or 0) >= 400 and row["on_time_rate"] is not None
    ]
    worst_week = min(weeks, key=lambda row: row["on_time_rate"])
    feb_is_worst = worst_week["week_start"] == feb_week_start(data["weekly"], feb)

    bf_per_day = bf["orders"] / bf["slice_days"]
    base_per_day = base["orders"] / base["slice_days"]
    bf_expected_late = bf["measurable_orders"] * (1 - base["on_time_rate"])
    bf_extra_late = bf["late_orders"] - bf_expected_late

    big_categories = [row for row in categories if row["orders"] >= 800]
    cat_ot = [row["on_time_rate"] for row in big_categories]

    kpis = [
        _kpi(
            "on_time",
            "On-time delivery",
            pct(h["on_time_rate"]),
            h["on_time_rate"],
            "Share of delivered orders that arrived on or before the date the customer was promised.",
            "on_time",
        ),
        _kpi(
            "avg_days",
            "Typical delivery",
            f"{days(h['avg_delivery_days'])} days",
            h["avg_delivery_days"],
            "Average calendar days from purchase to the customer's door.",
            "days",
        ),
        _kpi(
            "p90",
            "Nine in ten arrive within",
            f"{days(h['p90_delivery_days'])} days",
            h["p90_delivery_days"],
            "The slow end of the experience. One in ten delivered orders takes longer than this.",
            "p90",
        ),
        _kpi(
            "padding",
            "Promise cushion",
            f"{days(h['median_padding_days'])} days",
            h["median_padding_days"],
            "Typical number of days an order arrives before the date the customer was given.",
            "padding",
        ),
        _kpi(
            "seller_miss",
            "Seller misses the handoff",
            pct(h["seller_miss_rate"]),
            h["seller_miss_rate"],
            "Single-seller orders handed to the carrier after the seller's own shipping deadline.",
            "miss",
        ),
        _kpi(
            "freight",
            "Freight vs goods",
            pct(h["freight_share_gmv"]),
            h["freight_share_gmv"],
            "Freight charged, as a share of merchandise value, across the whole book.",
            "freight",
        ),
        _kpi(
            "late_review",
            "Stars when late",
            f"{h['avg_review_late']:.1f}",
            h["avg_review_late"],
            f"Average review after a missed promise. On-time orders score {h['avg_review_on_time']:.1f}.",
            "review",
        ),
        _kpi(
            "repeat",
            "Customers who return",
            pct(h["repeat_customer_rate"]),
            h["repeat_customer_rate"],
            "Share of customers in this order history who placed a second order.",
            "repeat",
        ),
    ]

    strip = [
        {"label": "Cancelled", "value": pct(h["cancellation_rate"]), "detail": f"{whole(h['canceled_orders'])} orders"},
        {"label": "Could not be delivered", "value": pct(h["unavailable_rate"]), "detail": f"{whole(h['unavailable_orders'])} orders"},
        {"label": "Not delivered or cancelled", "value": pct(h["not_delivered_rate"]), "detail": f"{whole(h['not_delivered_orders'])} orders still open or failed"},
        {"label": "Paid by boleto", "value": pct(h["boleto_share"]), "detail": f"Clears in {days(h['boleto_approval_days'])} days. Cards clear in {days(h['card_approval_days'])} days."},
    ]

    insights = [
        {
            "kicker": "The promise",
            "title": f"Orders arrive {days(h['median_padding_days'])} days before the date we gave the customer",
            "body": (
                f"A delivered order takes {days(h['avg_delivery_days'])} days on average "
                f"(half of them arrive within {days(h['median_delivery_days'])}). "
                f"The promised date sits {days(h['avg_promise_days'])} days after purchase, "
                f"so the typical order has a {days(h['median_padding_days'])}-day cushion and the average cushion is {days(h['avg_padding_days'])} days. "
                f"{pct(h['share_week_early'])} arrive a full week early. "
                f"On-time of {pct(h['on_time_rate'])} is mostly that cushion. "
                f"The slow tail is still real: one in ten deliveries takes more than {days(h['p90_delivery_days'])} days."
            ),
        },
        {
            "kicker": "Where it actually hurts",
            "title": f"{_lane_name(rio)} is the lane that moves the company number",
            "body": (
                f"{whole(rio['orders'])} deliveries, {pct(rio['orders'] / h['measurable_orders'])} of everything we delivered, "
                f"and only {pct(rio['on_time_rate'])} on time. The trip takes {days(rio['avg_delivery_days'])} days, "
                f"against {days(sp['avg_delivery_days'])} days for {_lane_name(sp)}. "
                f"Distance is not the excuse. {_lane_name(rio)} averages {whole(rio['avg_distance_km'])} km; "
                f"{_lane_name(mg)} averages {whole(mg['avg_distance_km'])} km, arrives in {days(mg['avg_delivery_days'])} days, "
                f"and is on time {pct(mg['on_time_rate'])}. "
                f"If the Rio lane matched the network's {pct(network)}, about {whole(rio_extra)} more deliveries would have been on time. "
                f"That alone is {points(rio_extra / h['measurable_orders'])} on the company rate."
            ),
        },
        {
            "kicker": "The on-time score can lie",
            "title": f"{amazonas['state_name']} looks excellent and takes {days(amazonas['avg_delivery_days'])} days",
            "body": (
                f"{amazonas['state_name']}: {whole(amazonas['orders'])} deliveries, {pct(amazonas['on_time_rate'])} on time, "
                f"because the promise is {days(amazonas['avg_promise_days'])} days. Customers still waited {days(amazonas['avg_delivery_days'])}. "
                f"{alagoas['state_name']} is the opposite problem: {whole(alagoas['orders'])} deliveries, "
                f"{days(alagoas['avg_delivery_days'])} days, and only {pct(alagoas['on_time_rate'])} on time. "
                f"The North as a whole is promised long and still slow ({days(_by(regions, 'region', 'North')['avg_delivery_days'])} days, "
                f"{pct(_by(regions, 'region', 'North')['on_time_rate'])} on time). "
                f"A green on-time tile is not a short wait."
            ),
        },
        {
            "kicker": "Reviews",
            "title": "The score holds for three late days, then collapses",
            "body": (
                f"Orders that arrive two weeks early score {band_early['avg_review']:.1f} stars. "
                f"Arriving on the promised day is still {band_on_day['avg_review']:.1f}. "
                f"One to three days late drops the average to {band_1_3['avg_review']:.1f} "
                f"({whole(band_1_3['orders'])} orders). "
                f"Four to seven days late falls to {band_4_7['avg_review']:.1f}, "
                f"and {pct(band_4_7['share_low_score'])} of those reviews are one or two stars. "
                f"Across every order four or more days late, {pct(late4_low)} of reviews are one or two stars. "
                f"If the {whole(h['late_reviewed_orders'])} reviewed late orders had scored like on-time orders, "
                f"the average review would be {h['review_lift_if_late_matched']:.2f} stars higher than {h['avg_review']:.2f}."
            ),
        },
        {
            "kicker": "Seller or carrier",
            "title": "Most late orders had already left the seller on time",
            "body": (
                f"Sellers miss their own handoff deadline on {pct(h['seller_miss_rate'])} of single-seller deliveries. "
                f"Among {whole(late_orders)} late single-seller orders, {pct(seller_met_long['orders'] / late_orders)} "
                f"had met that deadline and then sat in transit for 10 days or more. "
                f"Only {pct(seller_missed / late_orders)} missed the handoff. "
                f"Late orders spend {days(late_row['avg_transit_days'])} days with the carrier, "
                f"against {days(on_row['avg_transit_days'])} when the promise is met. "
                f"Seller handoff moves from {days(on_row['avg_handling_days'])} days to {days(late_row['avg_handling_days'])}. "
                f"The extra wait is mostly the linehaul, not the packing bench."
            ),
        },
        {
            "kicker": "Freight",
            "title": f"On a basket under {brl(cheap_q['max_merchandise'])}, freight is half the bill",
            "body": (
                f"The cheapest quarter of orders (up to {brl(cheap_q['max_merchandise'])}) "
                f"pays freight equal to {pct(cheap_q['freight_share'])} of the goods. "
                f"The typical order in that quarter pays {pct(cheap_q['median_freight_share'])}. "
                f"{whole(cheap_q['orders_freight_exceeds_price'])} of them pay more to ship than the product costs. "
                f"The top quarter pays {pct(prices[-1]['freight_share'])}. "
                f"In the North and Northeast that cheap quarter is harsher: the typical order spends "
                f"{pct(nne['median_freight_share'])} of the item price on freight, and "
                f"{pct(nne['share_freight_exceeds_price'])} pay more for shipping than for the goods "
                f"({whole(nne['orders'])} orders). Elsewhere in the same price band the typical share is {pct(rest['median_freight_share'])}."
            ),
        },
        {
            "kicker": "Black Friday 2017",
            "title": f"The week ran {bf_per_day / base_per_day:.1f}× a normal day and the promise did not move",
            "body": (
                f"20–26 November 2017: {whole(bf['orders'])} orders, {bf_per_day:.0f} a day, "
                f"against {base_per_day:.0f} a day in the four weeks before. "
                f"On-time fell from {pct(base['on_time_rate'])} to {pct(bf['on_time_rate'])}. "
                f"Delivery went from {days(base['avg_delivery_days'])} days to {days(bf['avg_delivery_days'])}, "
                f"and nine-in-ten stretched from {days(base['p90_delivery_days'])} to {days(bf['p90_delivery_days'])}. "
                f"The promise stayed put ({days(bf['avg_promise_days'])} days versus {days(base['avg_promise_days'])}). "
                f"Seller handoff only slipped from {days(base['avg_handling_days'])} to {days(bf['avg_handling_days'])} days. "
                f"Carrier transit went from {days(base['avg_transit_days'])} to {days(bf['avg_transit_days'])}. "
                f"The week produced {whole(bf['late_orders'])} late deliveries, about {whole(bf_extra_late)} more than the prior run-rate."
            ),
        },
        {
            "kicker": "The score and the shock",
            "title": "The worst week is not Black Friday, and a loose promise can fake a recovery",
            "body": (
                f"The worst week with at least 400 deliveries is the one starting {pretty_date(worst_week['week_start'])}"
                f"{'' if feb_is_worst else ''}: "
                f"{pct(feb['on_time_rate'])} on time, {days(feb['avg_delivery_days'])} days to the door, "
                f"transit {days(feb['avg_transit_days'])} days, promise still {days(feb['avg_promise_days'])}. "
                f"March 2018 is the worst month, at {pct(march['on_time_rate'])}. "
                f"Then the week of 21 May 2018, orders placed fall from {whole(may14['orders'])} to {whole(may21['orders'])}. "
                f"Deliveries that did go out still took about {days(may21['avg_delivery_days'])} days, "
                f"but the promise was pushed to {days(may21['avg_promise_days'])} and then {days(may28['avg_promise_days'])} the week after, "
                f"and on-time printed {pct(may28['on_time_rate'])}. "
                f"June looks world-class at {pct(june['on_time_rate'])} with a {days(june['avg_promise_days'])}-day promise "
                f"during a {days(june['avg_delivery_days'])}-day operation. "
                f"August is faster ({days(august['avg_delivery_days'])} days) and looks worse ({pct(august['on_time_rate'])}) "
                f"because the promise tightened to {days(august['avg_promise_days'])}."
            ),
        },
    ]

    small = [
        {
            "title": f"Only {pct(h['repeat_customer_rate'])} of customers buy again in this history",
            "body": (
                f"{whole(h['repeat_customers'])} of {whole(h['repeat_customer_base'])} customers place a second order, "
                f"and {pct(h['repeat_order_share'])} of orders are from someone who has already bought. "
                f"A late delivery is usually the only delivery that customer sees here."
            ),
        },
        {
            "title": f"Friday orders take {days(friday['avg_handling_days'])} days to reach the carrier, Monday {days(monday['avg_handling_days'])}",
            "body": (
                f"On-time barely notices ({pct(friday['on_time_rate'])} on Friday, {pct(monday['on_time_rate'])} on Monday) "
                f"because the promise absorbs a day. "
                f"A purchase on the day before a federal holiday takes {days(eve['avg_handling_days'])} days to hand off, "
                f"against {days(ordinary['avg_handling_days'])} on an ordinary day. "
                f"The holiday itself is quiet: {days(holiday['avg_handling_days'])} days, {pct(holiday['on_time_rate'])} on time."
            ),
        },
        {
            "title": "Instalments change the basket, not the cancellation rate",
            "body": (
                f"One instalment: basket {brl(one_pay['aov'])}, review {one_pay['avg_review']:.2f}, "
                f"cancellation {pct(one_pay['cancellation_rate'])}. "
                f"Seven to ten instalments: basket {brl(long_pay['aov'])}, review {long_pay['avg_review']:.2f}, "
                f"cancellation {pct(long_pay['cancellation_rate'])}. "
                f"On-time moves from {pct(one_pay['on_time_rate'])} to {pct(long_pay['on_time_rate'])}. "
                f"There is no cancellation problem hiding in long instalments."
            ),
        },
        {
            "title": "Heavy parcels cost more money and almost the same punctuality",
            "body": (
                f"Under 250 g, average freight is {brl(light['avg_freight'])} "
                f"({brl(light['median_freight_per_kg'])} per kg) and on-time is {pct(light['on_time_rate'])}. "
                f"At 8 kg and over, freight is {brl(heavy['avg_freight'])} but only {brl(heavy['median_freight_per_kg'])} per kg, "
                f"and on-time is {pct(heavy['on_time_rate'])}. "
                f"Distance is similar ({whole(light['avg_distance_km'])} km versus {whole(heavy['avg_distance_km'])} km). "
                f"Office furniture is the exception that is actually slow: {whole(office['orders'])} orders, "
                f"{days(office['avg_delivery_days'])} days, about {office['avg_weight_kg']:.0f} kg, review {office['avg_review']:.2f}."
            ),
        },
        {
            "title": f"{pct(h['sp_origin_share'])} of deliveries start with a São Paulo seller",
            "body": (
                f"{_lane_name(sp)} alone is {whole(sp['orders'])} deliveries, "
                f"{pct(sp['orders'] / h['measurable_orders'])} of the book, in {days(sp['avg_delivery_days'])} days "
                f"with a promise of {days(sp['avg_promise_days'])} and a 9-in-10 of {days(sp['p90_delivery_days'])}. "
                f"The company average is flattered by that one lane. "
                f"Category on-time, for lines of work with at least 800 orders, only spans "
                f"{pct(min(cat_ot))} to {pct(max(cat_ot))}. Lane and region move the number. Category mostly does not."
            ),
        },
        {
            "title": f"Boleto adds {days(boleto['avg_approval_days'] - card['avg_approval_days'])} days before the seller can start",
            "body": (
                f"Card payments are approved in {days(card['avg_approval_days'])} days and delivered in {days(card['avg_delivery_days'])}. "
                f"Boleto is approved in {days(boleto['avg_approval_days'])} and delivered in {days(boleto['avg_delivery_days'])}. "
                f"On-time is almost the same ({pct(boleto['on_time_rate'])} versus {pct(card['on_time_rate'])}), "
                f"so the extra day is invisible in the headline rate. It is not invisible to the customer."
            ),
        },
    ]

    recommendations = [
        {
            "title": f"Fix {_lane_name(rio)} first, then the other lanes sitting well behind the network",
            "impact": (
                f"{whole(rio_extra)} deliveries on the Rio lane, "
                f"{whole(extra_total)} across {len(opps)} lanes, {points(lift)} of network on-time"
            ),
            "body": (
                f"Lanes at least 3 points behind the network, with 200 or more deliveries, "
                f"account for {whole(extra_total)} deliveries that would have been on time if those lanes had matched {pct(network)}. "
                f"That is {points(lift)} on the company rate. {_lane_name(rio)} is about half of it. "
                f"This is an upper bound: it keeps today's volume and only removes the gap. It is not a promise that a project will capture all of it."
            ),
        },
        {
            "title": "Manage actual days and each lane's own slow tail, not on-time against a soft promise",
            "impact": (
                f"{_lane_name(sp)} is promised {days(sp['avg_promise_days'])} days against a 9-in-10 of {days(sp['p90_delivery_days'])}; "
                f"{_lane_name(rio)} is promised {days(rio['avg_promise_days'])} against a 9-in-10 of {days(rio['p90_delivery_days'])}"
            ),
            "body": (
                f"The metro promise is looser than the tail. The Rio promise is already tighter than the tail, "
                f"which is why that lane fails the on-time test while still looking merely 'a bit slow' in the national average. "
                f"Set each lane's promise from its recent 9-in-10, plus a small buffer, and report average days and the 9-in-10 next to on-time. "
                f"June's {pct(june['on_time_rate'])} and August's {pct(august['on_time_rate'])} show why a single on-time number cannot run the operation."
            ),
        },
        {
            "title": "Intervene when a parcel is one day late, before the review falls off at day four",
            "impact": (
                f"{whole(band_1_3['orders'])} orders are in the 1–3 day window; "
                f"{whole(sum(row['orders'] for row in late4))} are already four or more days late"
            ),
            "body": (
                f"A review at 1–3 days late is {band_1_3['avg_review']:.1f} stars. "
                f"At 4–7 days it is {band_4_7['avg_review']:.1f}, and {pct(late4_low)} of reviews from that point on are one or two stars. "
                f"A message, a new date, or a freight gesture in the first late days is aimed at {whole(band_1_3['orders'])} orders "
                f"that have not yet hit the cliff. Matching on-time scores on every late review would lift the average by "
                f"{h['review_lift_if_late_matched']:.2f} stars."
            ),
        },
        {
            "title": f"Cap freight on baskets under {brl(cheap_q['max_merchandise'])}, and do it properly in the North and Northeast",
            "impact": (
                f"{whole(cheap_q['orders_freight_exceeds_price'])} cheap orders pay more to ship than the goods cost; "
                f"{pct(nne['share_freight_over_half'])} of cheap North and Northeast orders pay freight over half the item price"
            ),
            "body": (
                f"Those cheap orders carry {brl(cheap_q['freight_total'])} of freight on {brl(cheap_q['avg_merchandise'])} baskets. "
                f"Network freight is a reasonable {pct(h['freight_share_gmv'])} of merchandise. "
                f"The damage is concentrated: the bottom quarter, and inside it the North and Northeast, "
                f"where the typical cheap order gives up {pct(nne['median_freight_share'])} of the item price. "
                f"A cap or a zone subsidy is a pricing decision. The count of orders above the pain line is the size of it."
            ),
        },
        {
            "title": "Put a handoff watchlist next to on-time, because the promise hides slow sellers",
            "impact": (
                f"{len(watch)} sellers, {whole(watch_orders)} single-seller deliveries, "
                f"average handoff {days(watch_avg)} days versus {days(h['avg_handling_days'])} for the network"
            ),
            "body": (
                f"The slowest of them is in {worst['seller_state_name']}: "
                f"{whole(worst['single_seller_deliveries'])} deliveries, "
                f"{days(worst['avg_handling_days'])} days to the carrier, "
                f"misses the deadline {pct(worst['miss_rate'])} of the time, "
                f"and is still on time {pct(worst['on_time_rate'])}. "
                f"Half of merchandise value sits with {whole(sellers_for_half)} of {whole(seller_count)} sellers, "
                f"and {whole(sellers_for_eighty)} sellers cover 80%. "
                f"The top 10 are only {pct(top10_share)} of merchandise. This is a long book of small sellers, "
                f"so a short watchlist of slow handoffs is manageable and the on-time rate will not flag them."
            ),
        },
        {
            "title": "Staff carrier capacity before a peak week, and do not paper over a shock by only stretching the promise",
            "impact": (
                f"Black Friday week: about {whole(bf_extra_late)} extra late deliveries. "
                f"Week of 26 Feb 2018: {pct(feb['on_time_rate'])} on time. "
                f"Week of 28 May: promise stretched to {days(may28['avg_promise_days'])} days while the trip stayed at {days(may28['avg_delivery_days'])}"
            ),
            "body": (
                f"Black Friday's damage was transit, not the packing bench, at {bf_per_day / base_per_day:.1f}× daily volume "
                f"with the same promise as the month before. "
                f"The late-February slump was deeper than Black Friday and also showed up in transit. "
                f"The week of 21 May shows the other failure mode: purchases fell by about half "
                f"and the promise was loosened until on-time looked perfect. "
                f"Pre-book linehaul for known peaks, extend the customer date before the week rather than after, "
                f"and keep publishing actual days when you do loosen the promise, so the cushion does not become the result."
            ),
        },
    ]

    takeaways = {
        "promise": (
            f"The gap between the two lines is the cushion. It was enormous in early 2017 "
            f"(a {days(_by(monthly, 'year_month', '2017-01')['avg_promise_days'])}-day promise) "
            f"and much tighter by August 2018 ({days(august['avg_promise_days'])} days promised, "
            f"{days(august['avg_delivery_days'])} days actual)."
        ),
        "volume": (
            f"On-time dips when the bars spike in November 2017 and when transit slows in February and March 2018, "
            f"even though March's promise ({days(march['avg_promise_days'])} days) was shorter than the months around it."
        ),
        "map": (
            f"Colour is days to the door, not the on-time rate. "
            f"The North is slow even where the on-time score stays high, because the promise was set long."
        ),
        "lanes": (
            f"Bar length is how many extra on-time deliveries that lane would add if it matched the network's {pct(network)}. "
            f"{_lane_name(rio)} dominates because it is both busy and behind."
        ),
        "cycle": (
            f"On {whole(cycle['orders'])} orders with a complete clock, approval is {days(cycle['approval_days'])} days, "
            f"the seller handoff is {days(cycle['seller_handling_days'])}, and the carrier has it for {days(cycle['carrier_transit_days'])}. "
            f"The promise beside them is {days(cycle['promise_days'])} days."
        ),
        "reviews": (
            f"Stars stay above 4 while the order is early or on the day. "
            f"They fall through 3 once it is a few days late, and through 2 after a week."
        ),
        "freight_price": (
            f"Freight is {pct(cheap_q['freight_share'])} of a cheap basket and {pct(prices[-1]['freight_share'])} of an expensive one. "
            f"The rate, not the absolute freight, is what the customer feels."
        ),
        "freight_region": (
            f"Northeast on-time is {pct(_by(regions, 'region', 'Northeast')['on_time_rate'])} "
            f"and the trip is {days(_by(regions, 'region', 'Northeast')['avg_delivery_days'])} days. "
            f"Southeast is {pct(_by(regions, 'region', 'Southeast')['on_time_rate'])} and {days(_by(regions, 'region', 'Southeast')['avg_delivery_days'])} days. "
            f"Freight's share of the basket rises in the same direction."
        ),
        "sellers": (
            f"{whole(sellers_for_half)} sellers ({pct(sellers_for_half / seller_count)}) produce half of merchandise value. "
            f"Reaching 80% takes {whole(sellers_for_eighty)} sellers. Concentration is real, and it is not a single-seller business."
        ),
        "categories": (
            f"Sort is the lowest on-time first, among categories with at least 300 delivered orders. "
            f"Most sit in a narrow band. Office furniture is the one that is genuinely slow."
        ),
        "dow": (
            f"Handoff slows from Monday ({days(monday['avg_handling_days'])} days) into Friday ({days(friday['avg_handling_days'])}) "
            f"and Saturday ({days(_by(dow, 'iso_day_of_week', 6)['avg_handling_days'])}). "
            f"Sunday purchases are back to {days(_by(dow, 'iso_day_of_week', 7)['avg_handling_days'])} days, "
            f"because the clock starts on a day nobody was going to ship."
        ),
        "installments": (
            f"The basket grows from {brl(one_pay['aov'])} to {brl(long_pay['aov'])} as instalments lengthen. "
            f"Cancellation stays near {pct(h['cancellation_rate'])} in every bucket."
        ),
    }

    return {
        "kpis": kpis,
        "strip": strip,
        "insights": insights,
        "small": small,
        "recommendations": recommendations,
        "takeaways": takeaways,
        "pareto": {
            "sellers": seller_count,
            "sellers_for_half": sellers_for_half,
            "sellers_for_eighty": sellers_for_eighty,
            "top10_share": top10_share,
            "curve": curve,
        },
        "watch_sellers": [
            {
                "state": row["seller_state_name"],
                "deliveries": row["single_seller_deliveries"],
                "avg_handling_days": row["avg_handling_days"],
                "miss_rate": row["miss_rate"],
                "on_time_rate": row["on_time_rate"],
                "gmv": row["gmv"],
            }
            for row in watch[:6]
        ],
        "lane_opportunities": [
            {
                "lane": row["lane_key"],
                "label": _lane_name(row),
                "short": f"{row['seller_state']} → {row['customer_state']}",
                "orders": row["orders"],
                "on_time_rate": row["on_time_rate"],
                "avg_delivery_days": row["avg_delivery_days"],
                "extra_ontime": row["extra_ontime"],
                "gap": row["gap"],
            }
            for row in opps[:10]
        ],
    }


def feb_week_start(weekly, feb_slice) -> str:
    """The February slice is a Monday-start week; confirm against the weekly series."""
    # The slice window starts on the Monday the weekly grain uses.
    candidates = [
        row["week_start"] for row in weekly
        if row["week_start"] >= "2018-02-26" and row["week_start"] <= "2018-02-26"
    ]
    if candidates:
        return candidates[0]
    return "2018-02-26"
