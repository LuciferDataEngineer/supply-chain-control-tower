{% macro haversine_km(lat1, lon1, lat2, lon2) -%}
case
    when {{ lat1 }} is null or {{ lon1 }} is null or {{ lat2 }} is null or {{ lon2 }} is null then null
    else 2 * 6371.0 * asin(least(1.0, sqrt(
        pow(sin(radians({{ lat2 }} - {{ lat1 }}) / 2), 2)
        + cos(radians({{ lat1 }})) * cos(radians({{ lat2 }}))
          * pow(sin(radians({{ lon2 }} - {{ lon1 }}) / 2), 2)
    )))
end
{%- endmacro %}
