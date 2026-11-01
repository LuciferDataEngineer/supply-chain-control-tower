# One-command rebuild of the warehouse and the static control tower.
export PATH := $(HOME)/.local/bin:$(PATH)
export WAREHOUSE_PATH ?= $(CURDIR)/data/warehouse/logistics.duckdb
export RAW_DIR ?= $(CURDIR)/data/raw
export DASHBOARD_DIR ?= $(CURDIR)/site
export DAGSTER_HOME ?= $(CURDIR)/.dagster
export DBT_SEND_ANONYMOUS_USAGE_STATS ?= false
export DO_NOT_TRACK ?= 1
export PYTHONPATH := $(CURDIR)
export PYTHONUNBUFFERED := 1

.PHONY: all extract transform dashboard test ci clean dagster

all: dagster

dagster:
	mkdir -p "$(DAGSTER_HOME)" data/warehouse site/data
	cp orchestration/dagster.yaml "$(DAGSTER_HOME)/dagster.yaml"
	dagster asset materialize -m orchestration.definitions --select "*"

extract:
	python3 -m ingestion.extract

transform:
	mkdir -p data/warehouse
	dbt build --project-dir dbt --profiles-dir dbt

dashboard:
	python3 -m analytics.build_dashboard

test:
	python3 -m pytest -q tests

ci: dagster test

clean:
	rm -rf data/landing data/raw data/warehouse .dagster dbt/target dbt/logs site/data/*.json
