with keyed as (
    select
        {{ category_key('t.category_name_english', 'p.product_category_name') }} as category_key,
        p.product_category_name as category_name_pt,
        t.category_name_english as category_name_en
    from {{ ref('stg_products') }} as p
    left join {{ ref('stg_category_translation') }} as t
        on p.product_category_name = t.product_category_name

    union all

    select
        'unknown' as category_key,
        null as category_name_pt,
        null as category_name_en
)

select
    category_key,
    any_value(category_name_pt) as category_name_pt,
    any_value(category_name_en) as category_name_en,
    case
        when category_key = 'unknown' then 'Unknown'
        else replace(category_key, '_', ' ')
    end as category_label
from keyed
group by 1
