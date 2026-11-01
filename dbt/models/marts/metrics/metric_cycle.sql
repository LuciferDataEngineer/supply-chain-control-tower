-- Complete, in-sequence clocks only, so the three stages add up to the total.
select
    cast(count(*) as bigint) as orders,
    cast(avg(approval_days) as double) as approval_days,
    cast(avg(seller_handling_days) as double) as seller_handling_days,
    cast(avg(carrier_transit_days) as double) as carrier_transit_days,
    cast(avg(delivery_days) as double) as delivery_days,
    cast(avg(promise_days) as double) as promise_days,
    cast(avg(approval_days) + avg(seller_handling_days) + avg(carrier_transit_days) as double) as stage_sum_days
from {{ ref('fct_deliveries') }}
where in_scope
  and delivery_measurable
  and approval_days is not null
  and seller_handling_days is not null
  and carrier_transit_days is not null
