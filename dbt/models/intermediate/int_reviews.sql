-- One review per order: the latest creation timestamp, then the highest review id.
with ranked as (
    select
        review_id,
        order_id,
        review_score,
        review_creation_date,
        count(*) over (partition by order_id) as review_rows,
        row_number() over (
            partition by order_id
            order by review_creation_date desc nulls last, review_id desc
        ) as rn
    from {{ ref('stg_reviews') }}
)

select
    order_id,
    review_id,
    review_score,
    review_creation_date,
    review_rows
from ranked
where rn = 1
