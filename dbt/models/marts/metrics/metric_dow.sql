select
    d.iso_day_of_week,
    any_value(d.day_name) as day_name,
    cast(count(*) as bigint) as orders,
    cast(avg(case when f.is_on_time then 1.0 else 0.0 end) as double) as on_time_rate,
    cast(avg(f.delivery_days) as double) as avg_delivery_days,
    cast(avg(f.seller_handling_days) as double) as avg_handling_days
from {{ ref('fct_deliveries') }} as f
inner join {{ ref('dim_date') }} as d
    on f.order_date = d.date_day
where f.in_scope
  and f.delivery_measurable
group by 1
