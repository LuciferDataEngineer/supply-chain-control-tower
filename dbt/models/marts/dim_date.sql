with spine as (
    select cast(d as date) as date_day
    from generate_series(date '2016-01-01', date '2018-12-31', interval 1 day) as t(d)
)

select
    spine.date_day,
    cast(year(spine.date_day) as bigint) as calendar_year,
    cast(quarter(spine.date_day) as bigint) as calendar_quarter,
    cast(month(spine.date_day) as bigint) as calendar_month,
    strftime(spine.date_day, '%B') as month_name,
    cast(date_trunc('week', spine.date_day) as date) as week_start,
    cast(isodow(spine.date_day) as bigint) as iso_day_of_week,
    dayname(spine.date_day) as day_name,
    isodow(spine.date_day) >= 6 as is_weekend,
    h.holiday_date is not null as is_national_holiday,
    h.holiday_name,
    spine.date_day between date '2017-11-20' and date '2017-11-26' as is_black_friday_week
from spine
left join {{ ref('stg_holidays') }} as h
    on spine.date_day = h.holiday_date
