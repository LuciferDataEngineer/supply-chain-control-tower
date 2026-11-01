-- One point per zip prefix. The source repeats prefixes with scattered coordinates.
-- Points outside a Brazil bounding box are dropped before the median so a bad
-- coordinate cannot drag a prefix offshore.
with cleaned as (
    select
        zip_code_prefix,
        latitude,
        longitude,
        latitude between -34 and 6
            and longitude between -74 and -34 as in_brazil_bbox
    from {{ ref('stg_geolocation') }}
    where zip_code_prefix is not null
      and zip_code_prefix <> ''
)

select
    zip_code_prefix,
    count(*) as source_rows,
    count(*) > 1 as is_duplicate_prefix,
    count(*) filter (where not in_brazil_bbox) as rows_outside_bbox,
    median(latitude) filter (where in_brazil_bbox) as latitude,
    median(longitude) filter (where in_brazil_bbox) as longitude
from cleaned
group by 1
