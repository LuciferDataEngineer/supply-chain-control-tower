select
    lane_key,
    seller_state,
    {{ state_name('seller_state') }} as seller_state_name,
    seller_region,
    customer_state,
    {{ state_name('customer_state') }} as customer_state_name,
    customer_region,
    seller_state = customer_state as is_intrastate,
    seller_region = customer_region as is_same_region
from {{ ref('int_order_lines') }}
where lane_key is not null
group by 1, 2, 3, 4, 5, 6, 7, 8, 9
