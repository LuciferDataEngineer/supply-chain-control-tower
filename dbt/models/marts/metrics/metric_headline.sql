-- Closed cohort: orders placed from 2017-01-01 through 2018-08-31.
-- On-time uses delivered orders with a promise date and a delivery date that
-- is not before the purchase date. Seller deadline miss is single-seller only,
-- because the carrier timestamp is stored once per order.
with cohort as (
    select * from {{ ref('fct_deliveries') }} where in_scope
),
measurable as (
    select * from cohort where delivery_measurable
),
repeat_customers as (
    select
        count(*) as customers,
        count(*) filter (where n_orders >= 2) as repeat_customers
    from (
        select customer_unique_id, count(*) as n_orders
        from cohort
        where customer_unique_id is not null
        group by 1
    ) as customer_orders
),
repeat_orders as (
    select avg(case when rn > 1 then 1.0 else 0.0 end) as repeat_order_share
    from (
        select row_number() over (
            partition by customer_unique_id
            order by order_date, order_id
        ) as rn
        from cohort
        where customer_unique_id is not null
    ) as ranked
),
reviews as (
    select
        count(*) filter (where review_score is not null) as reviewed_orders,
        avg(review_score) filter (where review_score is not null) as avg_review,
        avg(review_score) filter (where review_score is not null and is_on_time) as avg_review_on_time,
        avg(review_score) filter (where review_score is not null and not is_on_time) as avg_review_late,
        count(*) filter (where review_score is not null and not is_on_time) as late_reviewed_orders
    from measurable
)

select
    cast(count(*) as bigint) as orders,
    cast(count(distinct customer_unique_id) as bigint) as customers,
    cast(sum(merchandise_value) as double) as gmv,
    cast(sum(freight_value) as double) as freight_total,
    cast(avg(merchandise_value) as double) as aov,
    cast((select count(*) from measurable) as bigint) as measurable_orders,
    cast((select avg(case when is_on_time then 1.0 else 0.0 end) from measurable) as double) as on_time_rate,
    cast((select avg(case when not is_on_time then 1.0 else 0.0 end) from measurable) as double) as late_rate,
    cast((select avg(delivery_days) from measurable) as double) as avg_delivery_days,
    cast((select median(delivery_days) from measurable) as double) as median_delivery_days,
    cast((select quantile_cont(delivery_days, 0.9) from measurable) as double) as p90_delivery_days,
    cast((select avg(promise_days) from measurable) as double) as avg_promise_days,
    cast((select avg(promise_padding_days) from measurable) as double) as avg_padding_days,
    cast((select median(promise_padding_days) from measurable) as double) as median_padding_days,
    cast((select avg(case when promise_padding_days > 0 then 1.0 else 0.0 end) from measurable) as double) as share_early,
    cast((select avg(case when promise_padding_days >= 7 then 1.0 else 0.0 end) from measurable) as double) as share_week_early,
    cast((select avg(case when promise_padding_days >= 14 then 1.0 else 0.0 end) from measurable) as double) as share_two_weeks_early,
    cast((select avg(approval_days) from measurable where approval_days is not null) as double) as avg_approval_days,
    cast((select avg(seller_handling_days) from measurable where seller_handling_days is not null) as double) as avg_handling_days,
    cast((select avg(carrier_transit_days) from measurable where carrier_transit_days is not null) as double) as avg_transit_days,
    cast((
        select avg(case when seller_missed_limit then 1.0 else 0.0 end)
        from measurable
        where is_single_seller and seller_missed_limit is not null
    ) as double) as seller_miss_rate,
    cast((
        select count(*)
        from measurable
        where is_single_seller and seller_missed_limit is not null
    ) as bigint) as seller_miss_base,
    cast(sum(freight_value) / nullif(sum(merchandise_value), 0) as double) as freight_share_gmv,
    cast((
        select median(freight_value / merchandise_value)
        from cohort
        where merchandise_value > 0
    ) as double) as median_order_freight_share,
    cast((select avg_review_on_time from reviews) as double) as avg_review_on_time,
    cast((select avg_review_late from reviews) as double) as avg_review_late,
    cast((select avg_review from reviews) as double) as avg_review,
    cast((select reviewed_orders from reviews) as bigint) as reviewed_orders,
    cast((select late_reviewed_orders from reviews) as bigint) as late_reviewed_orders,
    cast((
        select (avg_review_on_time - avg_review_late) * late_reviewed_orders / nullif(reviewed_orders, 0)
        from reviews
    ) as double) as review_lift_if_late_matched,
    cast(avg(case when is_canceled then 1.0 else 0.0 end) as double) as cancellation_rate,
    cast(avg(case when is_unavailable then 1.0 else 0.0 end) as double) as unavailable_rate,
    cast(avg(case when not is_delivered and not is_canceled then 1.0 else 0.0 end) as double) as not_delivered_rate,
    cast(count(*) filter (where is_canceled) as bigint) as canceled_orders,
    cast(count(*) filter (where is_unavailable) as bigint) as unavailable_orders,
    cast(count(*) filter (where not is_delivered and not is_canceled) as bigint) as not_delivered_orders,
    cast((select repeat_customers * 1.0 / nullif(customers, 0) from repeat_customers) as double) as repeat_customer_rate,
    cast((select repeat_customers from repeat_customers) as bigint) as repeat_customers,
    cast((select customers from repeat_customers) as bigint) as repeat_customer_base,
    cast((select repeat_order_share from repeat_orders) as double) as repeat_order_share,
    cast((
        select avg(case when primary_payment_type = 'boleto' then 1.0 else 0.0 end)
        from measurable
    ) as double) as boleto_share,
    cast((
        select avg(approval_days)
        from measurable
        where primary_payment_type = 'boleto' and approval_days is not null
    ) as double) as boleto_approval_days,
    cast((
        select avg(approval_days)
        from measurable
        where primary_payment_type = 'credit_card' and approval_days is not null
    ) as double) as card_approval_days,
    cast(count(*) filter (where coalesce(n_sellers, 0) > 1) as bigint) as multi_seller_orders,
    cast(count(*) filter (where n_items is null) as bigint) as orders_missing_items,
    cast((
        select avg(case when seller_state = 'SP' then 1.0 else 0.0 end)
        from measurable
        where seller_state is not null
    ) as double) as sp_origin_share
from cohort
