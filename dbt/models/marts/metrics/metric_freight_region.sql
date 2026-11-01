select
    customer_region as region,
    cast(count(*) as bigint) as orders,
    cast(sum(freight_value) / nullif(sum(merchandise_value), 0) as double) as freight_share,
    cast(median(freight_value / merchandise_value) as double) as median_freight_share,
    cast(avg(case when freight_value > merchandise_value then 1.0 else 0.0 end) as double) as share_freight_exceeds_price,
    cast(avg(case when freight_value > 0.5 * merchandise_value then 1.0 else 0.0 end) as double) as share_freight_over_half,
    cast(avg(delivery_days) filter (where delivery_measurable) as double) as avg_delivery_days,
    cast(avg(case when is_on_time then 1.0 else 0.0 end) filter (where delivery_measurable) as double) as on_time_rate,
    cast(avg(distance_km) filter (where delivery_measurable) as double) as avg_distance_km
from {{ ref('fct_deliveries') }}
where in_scope
  and merchandise_value > 0
  and customer_region is not null
  and customer_region <> 'Unknown'
group by 1
