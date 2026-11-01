select
    customer_state as state,
    {{ state_name('customer_state') }} as state_name,
    customer_region as region,
    cast(count(*) as bigint) as orders,
    cast(avg(case when is_on_time then 1.0 else 0.0 end) as double) as on_time_rate,
    cast(avg(delivery_days) as double) as avg_delivery_days,
    cast(quantile_cont(delivery_days, 0.9) as double) as p90_delivery_days,
    cast(avg(promise_days) as double) as avg_promise_days,
    cast(avg(promise_padding_days) as double) as avg_padding_days,
    cast(sum(freight_value) / nullif(sum(merchandise_value), 0) as double) as freight_share,
    cast(avg(distance_km) as double) as avg_distance_km,
    cast(avg(review_score) as double) as avg_review
from {{ ref('fct_deliveries') }}
where in_scope
  and delivery_measurable
  and customer_state is not null
group by 1, 2, 3
