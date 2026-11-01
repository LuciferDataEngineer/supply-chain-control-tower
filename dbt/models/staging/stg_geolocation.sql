select
    lpad(trim(geolocation_zip_code_prefix), 5, '0') as zip_code_prefix,
    try_cast(geolocation_lat as double) as latitude,
    try_cast(geolocation_lng as double) as longitude,
    lower(trim(geolocation_city)) as city,
    upper(trim(geolocation_state)) as state
from {{ source('raw', 'geolocation') }}
