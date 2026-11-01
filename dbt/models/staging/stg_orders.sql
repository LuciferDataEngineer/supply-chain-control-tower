select
    order_id,
    customer_id,
    lower(trim(order_status)) as order_status,
    try_cast(order_purchase_timestamp as timestamp) as order_purchase_timestamp,
    try_cast(order_approved_at as timestamp) as order_approved_at,
    try_cast(order_delivered_carrier_date as timestamp) as order_delivered_carrier_date,
    try_cast(order_delivered_customer_date as timestamp) as order_delivered_customer_date,
    try_cast(order_estimated_delivery_date as timestamp) as order_estimated_delivery_date,
    try_cast(_extracted_at as timestamp) as extracted_at
from {{ source('raw', 'orders') }}
