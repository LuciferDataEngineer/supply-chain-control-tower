select
    primary_seller_id as seller_id,
    any_value(seller_state) as seller_state,
    any_value({{ state_name('seller_state') }}) as seller_state_name,
    cast(count(*) as bigint) as orders,
    cast(sum(merchandise_value) as double) as gmv,
    cast(count(*) filter (
        where delivery_measurable and is_single_seller
    ) as bigint) as single_seller_deliveries,
    cast(avg(seller_handling_days) filter (
        where delivery_measurable and is_single_seller and seller_handling_days is not null
    ) as double) as avg_handling_days,
    cast(avg(case when seller_missed_limit then 1.0 else 0.0 end) filter (
        where delivery_measurable and is_single_seller and seller_missed_limit is not null
    ) as double) as miss_rate,
    cast(avg(case when is_on_time then 1.0 else 0.0 end) filter (
        where delivery_measurable and is_single_seller
    ) as double) as on_time_rate
from {{ ref('fct_deliveries') }}
where in_scope
  and primary_seller_id is not null
group by 1
