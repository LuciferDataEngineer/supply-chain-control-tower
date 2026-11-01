select
    {{ geo_key('customer_state', 'customer_city') }} as customer_geo_key,
    customer_state,
    {{ state_name('customer_state') }} as customer_state_name,
    customer_city,
    {{ region_name('customer_state') }} as customer_region
from {{ ref('stg_customers') }}
where customer_state is not null
  and customer_city is not null
group by 1, 2, 3, 4, 5
