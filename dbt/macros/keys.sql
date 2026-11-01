{% macro geo_key(state_col, city_col) -%}
case
    when {{ state_col }} is null or {{ city_col }} is null then null
    else {{ state_col }} || '|' || {{ city_col }}
end
{%- endmacro %}

{% macro lane_key(seller_state, customer_state) -%}
case
    when {{ seller_state }} is null or {{ customer_state }} is null then null
    else {{ seller_state }} || '>' || {{ customer_state }}
end
{%- endmacro %}

{% macro category_key(english_col, portuguese_col) -%}
coalesce(
    nullif(trim({{ english_col }}), ''),
    nullif(trim({{ portuguese_col }}), ''),
    'unknown'
)
{%- endmacro %}
