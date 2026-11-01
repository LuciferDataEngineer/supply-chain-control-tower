select
    try_cast(holiday_date as date) as holiday_date,
    holiday_name,
    try_cast(_extracted_at as timestamp) as extracted_at
from {{ source('raw', 'holidays') }}
