with cohort as (
    select * from {{ ref('fct_deliveries') }} where in_scope
),
tagged as (
    select 'black_friday_week' as slice_name, 7 as slice_days, * from cohort
    where order_date between date '2017-11-20' and date '2017-11-26'
    union all
    select 'bf_baseline', 28, * from cohort
    where order_date between date '2017-10-23' and date '2017-11-19'
    union all
    select 'feb26_week', 7, * from cohort
    where order_date between date '2018-02-26' and date '2018-03-04'
    union all
    select 'may14_week', 7, * from cohort
    where order_date between date '2018-05-14' and date '2018-05-20'
    union all
    select 'may21_week', 7, * from cohort
    where order_date between date '2018-05-21' and date '2018-05-27'
    union all
    select 'may28_week', 7, * from cohort
    where order_date between date '2018-05-28' and date '2018-06-03'
    union all
    select 'national_holiday', null, * from cohort
    where is_national_holiday
    union all
    select 'not_national_holiday', null, * from cohort
    where not is_national_holiday
    union all
    select 'day_before_holiday', null, * from cohort
    where is_day_before_holiday and not is_national_holiday
    union all
    select 'ordinary_day', null, * from cohort
    where not is_day_before_holiday and not is_national_holiday
)

select
    slice_name,
    cast(any_value(slice_days) as bigint) as slice_days,
    cast(count(*) as bigint) as orders,
    cast(count(*) filter (where delivery_measurable) as bigint) as measurable_orders,
    cast(avg(case when is_on_time then 1.0 else 0.0 end) filter (where delivery_measurable) as double) as on_time_rate,
    cast(avg(delivery_days) filter (where delivery_measurable) as double) as avg_delivery_days,
    cast(quantile_cont(delivery_days, 0.9) filter (where delivery_measurable) as double) as p90_delivery_days,
    cast(avg(promise_days) filter (where delivery_measurable) as double) as avg_promise_days,
    cast(avg(seller_handling_days) filter (where delivery_measurable and seller_handling_days is not null) as double) as avg_handling_days,
    cast(avg(carrier_transit_days) filter (where delivery_measurable and carrier_transit_days is not null) as double) as avg_transit_days,
    cast(count(*) filter (where delivery_measurable and is_on_time = false) as bigint) as late_orders
from tagged
group by 1
