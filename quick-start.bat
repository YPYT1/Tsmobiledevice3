@echo off
REM ts-mobiledevice 快速测试脚本 (Windows)
REM 用途：安装依赖、构建项目、运行 Layer 1 测试

echo ==========================================
echo   ts-mobiledevice 快速开始脚本
echo ==========================================
echo.

REM 检查 Node.js
echo 📦 检查 Node.js 版本...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Node.js
    echo    请访问 https://nodejs.org/ 安装
    pause
    exit /b 1
)

for /f "tokens=2 delims=v" %%a in ('node -v') do set NODE_VERSION=%%a
echo ✅ Node.js 版本: %NODE_VERSION%
echo.

REM 检查 npm
echo 📦 检查 npm 版本...
npm -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 npm
    pause
    exit /b 1
)

for /f %%a in ('npm -v') do set NPM_VERSION=%%a
echo ✅ npm 版本: %NPM_VERSION%
echo.

REM 检查 Windows 环境
echo 🖥️  检测操作系统...
echo ✅ Windows 系统
echo    请确保已安装 iTunes 或 Apple Mobile Device Support
echo.

echo 🔍 检查 AMDS 服务...
netstat -ano | findstr ":27015" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  AMDS 服务未运行
    echo    请安装 iTunes: https://apps.microsoft.com/detail/9pb2mz1zmb1s
) else (
    echo ✅ AMDS 服务正在运行 (127.0.0.1:27015)
)
echo.

REM 安装依赖
echo ==========================================
echo 📦 第 1 步: 安装依赖
echo ==========================================
echo.

if exist "node_modules" (
    echo ✅ 依赖已安装，跳过
) else (
    echo 正在安装依赖（可能需要 5-10 分钟）...
    call npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
)
echo.

REM 构建项目
echo ==========================================
echo 🔨 第 2 步: 构建项目
echo ==========================================
echo.

echo 正在构建 TypeScript 项目...
call npm run build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)
echo ✅ 构建完成
echo.

REM 运行测试
echo ==========================================
echo 🧪 第 3 步: 运行 Layer 1 测试
echo ==========================================
echo.

echo ⚠️  请确保:
echo    1. iOS 设备已通过 USB 连接
echo    2. 设备已信任此电脑
echo    3. iTunes AMDS 正在运行
echo.

pause

echo.
echo 正在运行测试...
echo.

cd packages\core
call npm run test:layer1

echo.
echo ==========================================
echo ✅ 测试完成！
echo ==========================================
echo.
echo 如果所有测试通过，说明 Layer 1 工作正常
echo.
echo 下一步:
echo   - 测试 CLI: npm run dev -- usbmux list
echo   - 开始 Layer 2 实现
echo.

pause
