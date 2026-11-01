-- On a complete in-sequence clock, approval + handoff + transit equals door-to-door.
select orders, delivery_days, stage_sum_days
from {{ ref('metric_cycle') }}
where orders < 80000
   or abs(delivery_days - stage_sum_days) > 0.05
   or promise_days < delivery_days
