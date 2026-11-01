select
    cast(date_trunc('week', order_date) as date) as week_start,
    cast(count(*) as bigint) as orders,
    cast(count(*) filter (where delivery_measurable) as bigint) as measurable_orders,
    cast(avg(case when is_on_time then 1.0 else 0.0 end) filter (where delivery_measurable) as double) as on_time_rate,
    cast(avg(delivery_days) filter (where delivery_measurable) as double) as avg_delivery_days,
    cast(quantile_cont(delivery_days, 0.9) filter (where delivery_measurable) as double) as p90_delivery_days,
    cast(avg(promise_days) filter (where delivery_measurable) as double) as avg_promise_days,
    cast(avg(seller_handling_days) filter (where delivery_measurable and seller_handling_days is not null) as double) as avg_handling_days,
    cast(avg(carrier_transit_days) filter (where delivery_measurable and carrier_transit_days is not null) as double) as avg_transit_days
from {{ ref('fct_deliveries') }}
where in_scope
group by 1
