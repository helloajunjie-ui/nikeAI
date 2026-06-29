@echo off
cd /d "%~dp0.."
echo [Niko-Bridge] 启动沙盒模式，工作区: %cd%\.workspace
go run ./bridge/main.go
pause
