-- Grain: one order line. Distance is straight-line kilometres between the
-- seller zip centroid and the customer zip centroid. Delivery timestamps stay
-- on the order, not on the line.
with lines as (
    select
        i.order_id,
        i.order_item_id,
        i.product_id,
        i.seller_id,
        i.shipping_limit_timestamp,
        cast(i.shipping_limit_timestamp as date) as shipping_limit_date,
        i.price,
        i.freight_value,
        p.product_category_name,
        t.category_name_english,
        p.product_weight_g,
        p.product_length_cm,
        p.product_height_cm,
        p.product_width_cm,
        s.seller_zip_code_prefix,
        s.seller_city,
        s.seller_state,
        c.customer_zip_code_prefix,
        c.customer_city,
        c.customer_state,
        o.order_purchase_timestamp,
        cast(o.order_purchase_timestamp as date) as order_date
    from {{ ref('stg_order_items') }} as i
    left join {{ ref('stg_orders') }} as o
        on i.order_id = o.order_id
    left join {{ ref('stg_customers') }} as c
        on o.customer_id = c.customer_id
    left join {{ ref('stg_sellers') }} as s
        on i.seller_id = s.seller_id
    left join {{ ref('stg_products') }} as p
        on i.product_id = p.product_id
    left join {{ ref('stg_category_translation') }} as t
        on p.product_category_name = t.product_category_name
),
located as (
    select
        lines.*,
        {{ haversine_km('gs.latitude', 'gs.longitude', 'gc.latitude', 'gc.longitude') }} as raw_distance_km
    from lines
    left join {{ ref('int_geo_centroids') }} as gs
        on lines.seller_zip_code_prefix = gs.zip_code_prefix
    left join {{ ref('int_geo_centroids') }} as gc
        on lines.customer_zip_code_prefix = gc.zip_code_prefix
)

select
    order_id || '-' || cast(order_item_id as varchar) as order_line_key,
    order_id,
    order_item_id,
    product_id,
    seller_id,
    {{ geo_key('customer_state', 'customer_city') }} as customer_geo_key,
    {{ category_key('category_name_english', 'product_category_name') }} as category_key,
    {{ lane_key('seller_state', 'customer_state') }} as lane_key,
    order_date,
    order_date >= date '2017-01-01' and order_date < date '2018-09-01' as in_scope,
    price,
    freight_value,
    product_weight_g,
    product_length_cm,
    product_height_cm,
    product_width_cm,
    case
        when product_weight_g > 0 then freight_value / (product_weight_g / 1000.0)
    end as freight_per_kg,
    case
        when raw_distance_km between 0 and 4500 then raw_distance_km
    end as distance_km,
    case
        when raw_distance_km > 1 and raw_distance_km <= 4500
            then freight_value / raw_distance_km
    end as freight_per_km,
    shipping_limit_date,
    seller_state,
    {{ region_name('seller_state') }} as seller_region,
    seller_city,
    customer_state,
    {{ region_name('customer_state') }} as customer_region,
    customer_city,
    row_number() over (
        partition by order_id
        order by price desc, freight_value desc, order_item_id
    ) = 1 as is_primary_item
from located
