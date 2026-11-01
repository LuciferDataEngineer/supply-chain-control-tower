with priced as (
    select
        merchandise_value,
        freight_value,
        case
            when customer_region in ('North', 'Northeast') then 'North and Northeast'
            else 'Rest of Brazil'
        end as geo_group,
        ntile(4) over (order by merchandise_value) as price_quartile
    from {{ ref('fct_deliveries') }}
    where in_scope
      and merchandise_value > 0
      and customer_region is not null
)

select
    geo_group,
    cast(count(*) as bigint) as orders,
    cast(median(freight_value / merchandise_value) as double) as median_freight_share,
    cast(sum(freight_value) / nullif(sum(merchandise_value), 0) as double) as freight_share,
    cast(avg(case when freight_value > merchandise_value then 1.0 else 0.0 end) as double) as share_freight_exceeds_price,
    cast(avg(case when freight_value > 0.5 * merchandise_value then 1.0 else 0.0 end) as double) as share_freight_over_half
from priced
where price_quartile = 1
group by 1
