select
    product_id,
    lower(trim(product_category_name)) as product_category_name,
    try_cast(product_weight_g as double) as product_weight_g,
    try_cast(product_length_cm as double) as product_length_cm,
    try_cast(product_height_cm as double) as product_height_cm,
    try_cast(product_width_cm as double) as product_width_cm
from {{ source('raw', 'products') }}
