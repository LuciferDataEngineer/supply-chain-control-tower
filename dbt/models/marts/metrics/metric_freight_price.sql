with priced as (
    select
        merchandise_value,
        freight_value,
        ntile(4) over (order by merchandise_value) as price_quartile
    from {{ ref('fct_deliveries') }}
    where in_scope
      and merchandise_value > 0
)

select
    cast(price_quartile as bigint) as price_quartile,
    cast(count(*) as bigint) as orders,
    cast(min(merchandise_value) as double) as min_merchandise,
    cast(max(merchandise_value) as double) as max_merchandise,
    cast(avg(merchandise_value) as double) as avg_merchandise,
    cast(sum(freight_value) / nullif(sum(merchandise_value), 0) as double) as freight_share,
    cast(median(freight_value / merchandise_value) as double) as median_freight_share,
    cast(avg(case when freight_value > merchandise_value then 1.0 else 0.0 end) as double) as share_freight_exceeds_price,
    cast(count(*) filter (where freight_value > merchandise_value) as bigint) as orders_freight_exceeds_price,
    cast(avg(freight_value) as double) as avg_freight,
    cast(sum(freight_value) as double) as freight_total
from priced
group by 1
