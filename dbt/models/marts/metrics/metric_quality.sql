select
    cast((select count(*) from {{ ref('stg_orders') }}) as bigint) as raw_orders,
    cast((select count(*) from {{ ref('stg_order_items') }}) as bigint) as raw_order_lines,
    cast((select count(*) from {{ ref('stg_geolocation') }}) as bigint) as geo_source_rows,
    cast((select count(*) from {{ ref('int_geo_centroids') }}) as bigint) as geo_zip_prefixes,
    cast((select count(*) from {{ ref('int_geo_centroids') }} where is_duplicate_prefix) as bigint) as geo_prefixes_with_duplicates,
    cast((select coalesce(sum(rows_outside_bbox), 0) from {{ ref('int_geo_centroids') }}) as bigint) as geo_points_outside_bbox,
    cast((select count(*) from {{ ref('int_geo_centroids') }} where latitude is null) as bigint) as geo_prefixes_without_centroid,
    cast((select count(*) from {{ ref('fct_deliveries') }}) as bigint) as fact_orders,
    cast((select count(*) from {{ ref('fct_deliveries') }} where in_scope) as bigint) as cohort_orders,
    cast((select count(*) from {{ ref('fct_deliveries') }} where not in_scope) as bigint) as orders_outside_cohort,
    cast((select min(order_date) from {{ ref('fct_deliveries') }} where in_scope) as date) as cohort_start,
    cast((select max(order_date) from {{ ref('fct_deliveries') }} where in_scope) as date) as cohort_end,
    cast((select count(*) from {{ ref('fct_deliveries') }} where anomaly_carrier_before_purchase) as bigint) as carrier_before_purchase,
    cast((select count(*) from {{ ref('fct_deliveries') }} where anomaly_handling_negative) as bigint) as handling_negative,
    cast((select count(*) from {{ ref('fct_deliveries') }} where handling_clock_skew) as bigint) as handling_clock_skew,
    cast((select count(*) from {{ ref('fct_deliveries') }} where anomaly_transit_negative) as bigint) as transit_negative,
    cast((select count(*) from {{ ref('fct_deliveries') }} where missing_delivery_timestamp) as bigint) as delivered_status_missing_timestamp,
    cast((select count(*) from {{ ref('fct_deliveries') }} where in_scope and n_items is null) as bigint) as cohort_orders_without_items,
    cast((select count(*) from {{ ref('int_reviews') }} where review_rows > 1) as bigint) as orders_with_multiple_reviews,
    cast((select count(*) from {{ ref('stg_products') }} where product_category_name is null) as bigint) as products_missing_category,
    cast((
        select count(*)
        from {{ ref('stg_products') }} as p
        left join {{ ref('stg_category_translation') }} as t
            on p.product_category_name = t.product_category_name
        where p.product_category_name is not null
          and t.product_category_name is null
    ) as bigint) as products_untranslated_category,
    cast((
        select avg(case when distance_km is not null then 1.0 else 0.0 end)
        from {{ ref('fct_deliveries') }}
        where in_scope
    ) as double) as cohort_distance_match_rate,
    cast((select count(*) from {{ ref('stg_holidays') }}) as bigint) as federal_holidays
