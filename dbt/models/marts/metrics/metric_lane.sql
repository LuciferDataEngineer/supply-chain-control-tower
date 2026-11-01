select
    f.lane_key,
    any_value(l.seller_state) as seller_state,
    any_value(l.seller_state_name) as seller_state_name,
    any_value(l.customer_state) as customer_state,
    any_value(l.customer_state_name) as customer_state_name,
    any_value(l.seller_region) as seller_region,
    any_value(l.customer_region) as customer_region,
    cast(count(*) as bigint) as orders,
    cast(avg(case when f.is_on_time then 1.0 else 0.0 end) as double) as on_time_rate,
    cast(avg(f.delivery_days) as double) as avg_delivery_days,
    cast(quantile_cont(f.delivery_days, 0.9) as double) as p90_delivery_days,
    cast(avg(f.promise_days) as double) as avg_promise_days,
    cast(avg(f.promise_padding_days) as double) as avg_padding_days,
    cast(sum(f.freight_value) / nullif(sum(f.merchandise_value), 0) as double) as freight_share,
    cast(avg(f.distance_km) as double) as avg_distance_km
from {{ ref('fct_deliveries') }} as f
inner join {{ ref('dim_lane') }} as l
    on f.lane_key = l.lane_key
where f.in_scope
  and f.delivery_measurable
group by f.lane_key
