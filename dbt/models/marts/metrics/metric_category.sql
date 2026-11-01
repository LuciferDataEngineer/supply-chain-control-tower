select
    f.category_key,
    any_value(c.category_label) as category_label,
    cast(count(*) as bigint) as orders,
    cast(sum(f.merchandise_value) as double) as gmv,
    cast(avg(case when f.is_on_time then 1.0 else 0.0 end) as double) as on_time_rate,
    cast(avg(f.delivery_days) as double) as avg_delivery_days,
    cast(quantile_cont(f.delivery_days, 0.9) as double) as p90_delivery_days,
    cast(avg(f.promise_days) as double) as avg_promise_days,
    cast(sum(f.freight_value) / nullif(sum(f.merchandise_value), 0) as double) as freight_share,
    cast(avg(f.total_weight_g) / 1000.0 as double) as avg_weight_kg,
    cast(avg(f.review_score) as double) as avg_review
from {{ ref('fct_deliveries') }} as f
left join {{ ref('dim_product_category') }} as c
    on f.category_key = c.category_key
where f.in_scope
  and f.delivery_measurable
  and f.category_key is not null
group by 1
