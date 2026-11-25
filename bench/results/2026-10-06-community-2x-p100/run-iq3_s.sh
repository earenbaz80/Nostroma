#!/bin/sh
cd "/home/lech/Nostroma"
exec "/home/lech/Nostroma/.venv/bin/python" "/home/lech/Nostroma/serve/server.py" "--engine" "nostroma" "--config" "/home/lech/Nostroma/nostroma-iq3_s.json" "--port" "8080" "--open"
