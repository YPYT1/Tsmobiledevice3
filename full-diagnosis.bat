@echo off
REM 完整诊断脚本

echo ========================================
echo   iTunes AMDS 完整诊断
echo ========================================
echo.

echo [1] 检查 AMDS 服务状态
sc query "Apple Mobile Device Service" | findstr STATE
echo.

echo [2] 检查端口监听
netstat -ano | findstr :27015 | findstr LISTENING
echo.

echo [3] 检查设备连接
wmic path Win32_PnPEntity where "Name like '%%Apple%%'" get Name,Status 2>nul | findstr iPhone
echo.

echo [4] 检查配对记录
dir "C:\ProgramData\Apple\Lockdown\*.plist" 2>nul | findstr /v "个文件" | findstr ".plist" | findstr /v ".tmp"
echo.

echo [5] 检查活跃连接数
for /f %%i in ('netstat -ano ^| findstr :27015 ^| findstr ESTABLISHED ^| find /c /v ""') do set CONNCOUNT=%%i
echo 当前活跃连接数: %CONNCOUNT%
echo.

echo [6] 测试 TypeScript 实现
echo 运行: node test-clean.js
cd D:\Project\ts-mobiledevice
node test-clean.js
echo.

echo ========================================
echo   诊断完成
echo ========================================
echo.
echo 如果仍然失败，请尝试:
echo   1. 重启电脑
echo   2. 在 iOS 设备上: 设置 ^> 通用 ^> 重置 ^> 重置位置与隐私
echo   3. 重新信任设备
echo.
pause