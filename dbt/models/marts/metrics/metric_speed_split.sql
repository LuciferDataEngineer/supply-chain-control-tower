-- Single-seller delivered orders, split by whether they met the promise.
-- Used to see whether lateness sits in seller handoff or carrier transit.
select
    is_on_time,
    cast(count(*) as bigint) as orders,
    cast(avg(delivery_days) as double) as avg_delivery_days,
    cast(avg(seller_handling_days) filter (where seller_handling_days is not null) as double) as avg_handling_days,
    cast(avg(carrier_transit_days) filter (where carrier_transit_days is not null) as double) as avg_transit_days,
    cast(avg(promise_days) as double) as avg_promise_days,
    cast(avg(distance_km) as double) as avg_distance_km
from {{ ref('fct_deliveries') }}
where in_scope
  and delivery_measurable
  and is_single_seller
group by 1
