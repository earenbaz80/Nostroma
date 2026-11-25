@echo off
title Nostroma IQ2_XS (NOSTROMA_PF_FUSED=1)
cd /d "D:\AI\Nostroma\Nostroma-main\Nostroma-main"
set NOSTROMA_PF_FUSED=1
echo Starting Nostroma with NOSTROMA_PF_FUSED=1
"D:\AI\Nostroma\Nostroma-main\Nostroma-main\.venv\Scripts\python.exe" "D:\AI\Nostroma\Nostroma-main\Nostroma-main\serve\server.py" "--engine" "nostroma" "--config" "D:\AI\Nostroma\Nostroma-main\Nostroma-main\nostroma-iq2_xs.json" "--port" "8080" "--open"
if errorlevel 1 pause
