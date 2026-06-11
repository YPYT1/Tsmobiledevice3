@echo off
REM iTunes AMDS 服务重启脚本
REM 必须以管理员身份运行

echo ========================================
echo   iTunes AMDS 服务重启工具
echo ========================================
echo.

echo [1/3] 停止 Apple Mobile Device Service...
net stop "Apple Mobile Device Service"
if errorlevel 1 (
    echo 警告: 停止服务失败，可能需要管理员权限
    echo 请右键点击此脚本，选择"以管理员身份运行"
    pause
    exit /b 1
)

echo.
echo [2/3] 等待 5 秒...
timeout /t 5 /nobreak

echo.
echo [3/3] 启动 Apple Mobile Device Service...
net start "Apple Mobile Device Service"
if errorlevel 1 (
    echo 错误: 启动服务失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   服务重启完成！
echo ========================================
echo.
echo 现在可以运行测试脚本了:
echo   cd D:\Project\ts-mobiledevice
echo   node test-clean.js
echo.
pause
