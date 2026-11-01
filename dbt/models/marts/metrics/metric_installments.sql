with bucketed as (
    select
        case
            when max_installments is null or max_installments <= 1 then 1
            when max_installments <= 3 then 2
            when max_installments <= 6 then 3
            when max_installments <= 10 then 4
            else 5
        end as bucket_order,
        case
            when max_installments is null or max_installments <= 1 then '1 instalment'
            when max_installments <= 3 then '2–3 instalments'
            when max_installments <= 6 then '4–6 instalments'
            when max_installments <= 10 then '7–10 instalments'
            else '11 or more'
        end as bucket_label,
        merchandise_value,
        review_score,
        is_canceled,
        is_delivered,
        delivery_measurable,
        is_on_time
    from {{ ref('fct_deliveries') }}
    where in_scope
)

select
    cast(bucket_order as bigint) as bucket_order,
    bucket_label,
    cast(count(*) as bigint) as orders,
    cast(avg(merchandise_value) as double) as aov,
    cast(avg(review_score) as double) as avg_review,
    cast(avg(case when is_canceled then 1.0 else 0.0 end) as double) as cancellation_rate,
    cast(avg(case when is_delivered then 1.0 else 0.0 end) as double) as delivered_rate,
    cast(avg(case when is_on_time then 1.0 else 0.0 end) filter (where delivery_measurable) as double) as on_time_rate
from bucketed
group by 1, 2
