select
    coalesce(primary_payment_type, 'unknown') as payment_type,
    cast(count(*) as bigint) as orders,
    cast(avg(approval_days) as double) as avg_approval_days,
    cast(avg(delivery_days) as double) as avg_delivery_days,
    cast(avg(case when is_on_time then 1.0 else 0.0 end) as double) as on_time_rate,
    cast(avg(review_score) as double) as avg_review,
    cast(avg(merchandise_value) as double) as aov,
    cast(avg(max_installments) as double) as avg_installments
from {{ ref('fct_deliveries') }}
where in_scope
  and delivery_measurable
group by 1
