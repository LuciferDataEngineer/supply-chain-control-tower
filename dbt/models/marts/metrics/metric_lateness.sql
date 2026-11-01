with banded as (
    select
        case
            when days_vs_promise <= -15 then 1
            when days_vs_promise between -14 and -8 then 2
            when days_vs_promise between -7 and -1 then 3
            when days_vs_promise = 0 then 4
            when days_vs_promise between 1 and 3 then 5
            when days_vs_promise between 4 and 7 then 6
            when days_vs_promise between 8 and 14 then 7
            else 8
        end as band_order,
        case
            when days_vs_promise <= -15 then '15+ days early'
            when days_vs_promise between -14 and -8 then '8–14 days early'
            when days_vs_promise between -7 and -1 then '1–7 days early'
            when days_vs_promise = 0 then 'On the promised day'
            when days_vs_promise between 1 and 3 then '1–3 days late'
            when days_vs_promise between 4 and 7 then '4–7 days late'
            when days_vs_promise between 8 and 14 then '8–14 days late'
            else '15+ days late'
        end as band_label,
        review_score
    from {{ ref('fct_deliveries') }}
    where in_scope
      and delivery_measurable
)

select
    cast(band_order as bigint) as band_order,
    band_label,
    cast(count(*) as bigint) as orders,
    cast(count(*) filter (where review_score is not null) as bigint) as reviewed_orders,
    cast(avg(review_score) filter (where review_score is not null) as double) as avg_review,
    cast(avg(case when review_score <= 2 then 1.0 else 0.0 end) filter (where review_score is not null) as double) as share_low_score,
    cast(avg(case when review_score = 5 then 1.0 else 0.0 end) filter (where review_score is not null) as double) as share_five_star
from banded
group by 1, 2
