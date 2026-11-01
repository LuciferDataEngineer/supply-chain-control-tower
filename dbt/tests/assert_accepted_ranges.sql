-- Accepted ranges. A returned row is a failure.
select order_id as entity_id, 'delivery_days' as issue
from {{ ref('fct_deliveries') }}
where delivery_days is not null
  and (delivery_days < 0 or delivery_days > 400)

union all

select order_id, 'review_score'
from {{ ref('fct_deliveries') }}
where review_score is not null
  and review_score not in (1, 2, 3, 4, 5)

union all

select order_id, 'negative_money'
from {{ ref('fct_deliveries') }}
where merchandise_value < 0
   or freight_value < 0

union all

select order_line_key, 'line_money'
from {{ ref('fct_order_lines') }}
where price is null
   or freight_value is null
   or price < 0
   or freight_value < 0

union all

select order_id, 'distance_range'
from {{ ref('fct_deliveries') }}
where distance_km is not null
  and (distance_km < 0 or distance_km > 4500)

union all

select order_id, 'on_time_without_population'
from {{ ref('fct_deliveries') }}
where is_on_time is not null
  and not delivery_measurable
