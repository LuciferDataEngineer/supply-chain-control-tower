select
    case
        when seller_missed_limit is null then 'Deadline unknown'
        when seller_missed_limit and coalesce(carrier_transit_days, 0) >= 10 then 'Seller missed the handoff, and transit ran long'
        when seller_missed_limit then 'Seller missed the handoff'
        when coalesce(carrier_transit_days, 0) >= 10 then 'Seller met the deadline, transit ran 10 days or more'
        else 'Seller met the deadline, transit under 10 days'
    end as cause,
    cast(count(*) as bigint) as orders
from {{ ref('fct_deliveries') }}
where in_scope
  and delivery_measurable
  and is_on_time = false
  and is_single_seller
group by 1
