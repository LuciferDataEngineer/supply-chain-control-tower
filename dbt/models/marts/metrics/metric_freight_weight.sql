with banded as (
    select
        case
            when total_weight_g is null or total_weight_g <= 0 then 0
            when total_weight_g < 250 then 1
            when total_weight_g < 1000 then 2
            when total_weight_g < 3000 then 3
            when total_weight_g < 8000 then 4
            else 5
        end as band_order,
        case
            when total_weight_g is null or total_weight_g <= 0 then 'Weight missing'
            when total_weight_g < 250 then 'Under 250 g'
            when total_weight_g < 1000 then '250 g – 1 kg'
            when total_weight_g < 3000 then '1 – 3 kg'
            when total_weight_g < 8000 then '3 – 8 kg'
            else '8 kg and over'
        end as band_label,
        freight_value,
        total_weight_g,
        is_on_time,
        delivery_days,
        distance_km
    from {{ ref('fct_deliveries') }}
    where in_scope
      and delivery_measurable
)

select
    cast(band_order as bigint) as band_order,
    band_label,
    cast(count(*) as bigint) as orders,
    cast(avg(total_weight_g) as double) as avg_weight_g,
    cast(avg(freight_value) as double) as avg_freight,
    cast(median(freight_value / (total_weight_g / 1000.0)) filter (where total_weight_g > 0) as double) as median_freight_per_kg,
    cast(avg(case when is_on_time then 1.0 else 0.0 end) as double) as on_time_rate,
    cast(avg(delivery_days) as double) as avg_delivery_days,
    cast(avg(distance_km) as double) as avg_distance_km
from banded
group by 1, 2
