select 'cohort' as issue
from {{ ref('metric_quality') }}
where cohort_orders < 90000
   or cohort_start < date '2017-01-01'
   or cohort_start > date '2017-01-15'
   or cohort_end < date '2018-08-15'
   or federal_holidays < 20
   or geo_source_rows < 1000000

union all

select 'headline_rows'
from {{ ref('metric_headline') }}
having count(*) <> 1

union all

select 'headline_bounds'
from {{ ref('metric_headline') }}
where orders < 90000
   or measurable_orders < 90000
   or on_time_rate not between 0.5 and 0.99
   or late_rate not between 0 and 0.5
   or freight_share_gmv not between 0 and 1
   or p90_delivery_days < median_delivery_days
   or avg_review_late >= avg_review_on_time
   or seller_miss_rate not between 0 and 0.5
   or repeat_customer_rate not between 0 and 0.5
   or cancellation_rate not between 0 and 0.05
