#!/usr/bin/env bash

# Initialize db
sqlite3 database.db < db/install.sql;

# Initialize .env.json
if [[ ! -e .env.json ]]; then
    cp .env.json.template .env.json;
fi

# Initialize stickers.json
if [[ ! -e .env.json ]]; then
    cp stickers.json.template stickers.json;
fi
