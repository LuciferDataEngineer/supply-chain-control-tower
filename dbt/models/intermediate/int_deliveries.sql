-- Grain: one order. The delivery clock in the source is order-level, so a
-- multi-seller order shares one carrier timestamp. Seller-deadline metrics
-- later restrict themselves to single-seller orders.
with rollup as (
    select
        order_id,
        count(*) as n_items,
        count(distinct seller_id) as n_sellers,
        sum(price) as merchandise_value,
        sum(freight_value) as freight_value,
        sum(product_weight_g) as total_weight_g,
        min(shipping_limit_date) as earliest_ship_limit_date,
        count(*) filter (where product_weight_g is null or product_weight_g <= 0) as items_missing_weight
    from {{ ref('int_order_lines') }}
    group by 1
),
primary_item as (
    select
        order_id,
        seller_id as primary_seller_id,
        seller_state,
        seller_region,
        lane_key,
        category_key,
        distance_km
    from {{ ref('int_order_lines') }}
    where is_primary_item
),
base as (
    select
        o.order_id,
        c.customer_unique_id,
        {{ geo_key('c.customer_state', 'c.customer_city') }} as customer_geo_key,
        c.customer_state,
        {{ region_name('c.customer_state') }} as customer_region,
        c.customer_city,
        p.primary_seller_id,
        p.seller_state,
        p.seller_region,
        p.lane_key,
        p.category_key,
        p.distance_km,
        o.order_status,
        o.order_purchase_timestamp,
        o.order_approved_at,
        o.order_delivered_carrier_date,
        o.order_delivered_customer_date,
        o.order_estimated_delivery_date,
        cast(o.order_purchase_timestamp as date) as order_date,
        cast(o.order_approved_at as date) as approved_date,
        cast(o.order_delivered_carrier_date as date) as carrier_date,
        cast(o.order_delivered_customer_date as date) as delivered_date,
        cast(o.order_estimated_delivery_date as date) as estimated_date,
        r.n_items,
        r.n_sellers,
        r.merchandise_value,
        r.freight_value,
        r.total_weight_g,
        r.earliest_ship_limit_date,
        r.items_missing_weight,
        pay.payment_value,
        pay.max_installments,
        pay.primary_payment_type,
        rev.review_score,
        rev.review_rows
    from {{ ref('stg_orders') }} as o
    left join {{ ref('stg_customers') }} as c
        on o.customer_id = c.customer_id
    left join rollup as r
        on o.order_id = r.order_id
    left join primary_item as p
        on o.order_id = p.order_id
    left join {{ ref('int_payments') }} as pay
        on o.order_id = pay.order_id
    left join {{ ref('int_reviews') }} as rev
        on o.order_id = rev.order_id
),
dated as (
    select
        base.*,
        order_date >= date '2017-01-01' and order_date < date '2018-09-01' as in_scope,
        order_status = 'delivered' as is_delivered,
        order_status = 'canceled' as is_canceled,
        order_status = 'unavailable' as is_unavailable,
        coalesce(n_sellers, 0) = 1 as is_single_seller,
        order_delivered_carrier_date is not null
            and order_purchase_timestamp is not null
            and order_delivered_carrier_date < order_purchase_timestamp
            as anomaly_carrier_before_purchase,
        delivered_date is not null
            and carrier_date is not null
            and delivered_date < carrier_date
            as anomaly_transit_negative,
        carrier_date is not null
            and approved_date is not null
            and carrier_date < approved_date
            as anomaly_handling_negative,
        carrier_date is not null
            and approved_date is not null
            and date_diff('day', approved_date, carrier_date) = -1
            as handling_clock_skew,
        is_delivered
            and delivered_date is null
            as missing_delivery_timestamp,
        case
            when approved_date is null or order_date is null then null
            when approved_date < order_date then null
            else date_diff('day', order_date, approved_date)
        end as approval_days,
        case
            when carrier_date is null or approved_date is null then null
            when order_delivered_carrier_date < order_purchase_timestamp then null
            when carrier_date < approved_date then null
            else date_diff('day', approved_date, carrier_date)
        end as seller_handling_days,
        case
            when delivered_date is null or carrier_date is null then null
            when delivered_date < carrier_date then null
            else date_diff('day', carrier_date, delivered_date)
        end as carrier_transit_days,
        case
            when delivered_date is null or order_date is null then null
            when delivered_date < order_date then null
            else date_diff('day', order_date, delivered_date)
        end as delivery_days,
        case
            when estimated_date is null or order_date is null then null
            else date_diff('day', order_date, estimated_date)
        end as promise_days,
        case
            when delivered_date is null or estimated_date is null then null
            when delivered_date < order_date then null
            else date_diff('day', delivered_date, estimated_date)
        end as promise_padding_days,
        case
            when delivered_date is null or estimated_date is null then null
            when delivered_date < order_date then null
            else date_diff('day', estimated_date, delivered_date)
        end as days_vs_promise,
        case
            when carrier_date is null or earliest_ship_limit_date is null then null
            when order_delivered_carrier_date < order_purchase_timestamp then null
            else date_diff('day', earliest_ship_limit_date, carrier_date)
        end as dispatch_vs_limit_days
    from base
)

select
    dated.*,
    is_delivered
        and delivered_date is not null
        and estimated_date is not null
        and delivered_date >= order_date
        as delivery_measurable,
    case
        when is_delivered
            and delivered_date is not null
            and estimated_date is not null
            and delivered_date >= order_date
            then delivered_date <= estimated_date
    end as is_on_time,
    case
        when dispatch_vs_limit_days is null then null
        else dispatch_vs_limit_days > 0
    end as seller_missed_limit,
    case
        when merchandise_value > 0 then freight_value / merchandise_value
    end as freight_share,
    case
        when total_weight_g > 0 then freight_value / (total_weight_g / 1000.0)
    end as freight_per_kg,
    case
        when distance_km > 1 then freight_value / distance_km
    end as freight_per_km,
    h.holiday_date is not null as is_national_holiday,
    h.holiday_name,
    eve.holiday_date is not null as is_day_before_holiday,
    order_date between date '2017-11-20' and date '2017-11-26' as is_black_friday_week
from dated
left join {{ ref('stg_holidays') }} as h
    on dated.order_date = h.holiday_date
left join {{ ref('stg_holidays') }} as eve
    on dated.order_date = eve.holiday_date - 1
