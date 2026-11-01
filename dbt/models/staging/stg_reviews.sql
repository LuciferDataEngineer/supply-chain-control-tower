select
    review_id,
    order_id,
    try_cast(review_score as integer) as review_score,
    try_cast(review_creation_date as timestamp) as review_creation_date,
    try_cast(review_answer_timestamp as timestamp) as review_answer_timestamp
from {{ source('raw', 'reviews') }}
