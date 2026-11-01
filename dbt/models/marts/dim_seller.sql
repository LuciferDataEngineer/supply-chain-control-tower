select
    seller_id,
    seller_city,
    seller_state,
    {{ state_name('seller_state') }} as seller_state_name,
    {{ region_name('seller_state') }} as seller_region,
    seller_zip_code_prefix
from {{ ref('stg_sellers') }}
