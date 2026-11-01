-- One row per order. Voucher plus card is common, so the primary type is the
-- leg with the largest value and installments are the maximum across legs.
select
    order_id,
    count(*) as payment_rows,
    count(distinct payment_type) as payment_type_count,
    sum(payment_value) as payment_value,
    max(payment_installments) as max_installments,
    arg_max(payment_type, payment_value) as primary_payment_type
from {{ ref('stg_payments') }}
group by 1
