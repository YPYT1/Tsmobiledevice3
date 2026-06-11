#!/bin/bash

# ts-mobiledevice 快速测试脚本
# 用途：安装依赖、构建项目、运行 Layer 1 测试

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  ts-mobiledevice 快速开始脚本"
echo "=========================================="
echo ""

# 检查 Node.js 版本
echo "📦 检查 Node.js 版本..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 错误: 需要 Node.js 18.0.0 或更高版本"
    echo "   当前版本: $(node -v)"
    echo "   请访问 https://nodejs.org/ 安装最新版本"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo ""

# 检查 npm 版本
echo "📦 检查 npm 版本..."
NPM_VERSION=$(npm -v | cut -d'.' -f1)

if [ "$NPM_VERSION" -lt 9 ]; then
    echo "❌ 错误: 需要 npm 9.0.0 或更高版本"
    echo "   当前版本: $(npm -v)"
    echo "   请运行: npm install -g npm@latest"
    exit 1
fi

echo "✅ npm 版本: $(npm -v)"
echo ""

# 检查操作系统
echo "🖥️  检测操作系统..."
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "✅ Windows 系统"
    echo "   请确保已安装 iTunes 或 Apple Mobile Device Support"

    # 检查 iTunes AMDS 端口
    echo ""
    echo "🔍 检查 AMDS 服务..."
    if netstat -ano | findstr ":27015" | findstr "LISTENING" > /dev/null 2>&1; then
        echo "✅ AMDS 服务正在运行 (127.0.0.1:27015)"
    else
        echo "⚠️  AMDS 服务未运行"
        echo "   请安装 iTunes: https://apps.microsoft.com/detail/9pb2mz1zmb1s"
    fi

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "✅ Linux 系统"
    echo "   请确保已安装 usbmuxd: sudo apt-get install usbmuxd"

elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "✅ macOS 系统"
    echo "   原生支持，无需额外安装"

else
    echo "⚠️  未知操作系统: $OSTYPE"
fi

echo ""

# 安装依赖
echo "=========================================="
echo "📦 第 1 步: 安装依赖"
echo "=========================================="
echo ""

if [ -d "node_modules" ]; then
    echo "✅ 依赖已安装，跳过"
else
    echo "正在安装依赖（可能需要 5-10 分钟）..."
    npm install
    echo "✅ 依赖安装完成"
fi

echo ""

# 构建项目
echo "=========================================="
echo "🔨 第 2 步: 构建项目"
echo "=========================================="
echo ""

echo "正在构建 TypeScript 项目..."
npm run build || {
    echo "❌ 构建失败"
    exit 1
}

echo "✅ 构建完成"
echo ""

# 运行测试
echo "=========================================="
echo "🧪 第 3 步: 运行 Layer 1 测试"
echo "=========================================="
echo ""

echo "⚠️  请确保:"
echo "   1. iOS 设备已通过 USB 连接"
echo "   2. 设备已信任此电脑"
echo "   3. iTunes AMDS 正在运行 (Windows)"
echo ""

read -p "按 Enter 键继续测试，或按 Ctrl+C 取消..." -r

echo ""
echo "正在运行测试..."
echo ""

cd packages/core
npm run test:layer1

echo ""
echo "=========================================="
echo "✅ 测试完成！"
echo "=========================================="
echo ""
echo "如果所有测试通过，说明 Layer 1 工作正常"
echo ""
echo "下一步:"
echo "  - 测试 CLI: npm run dev -- usbmux list"
echo "  - 开始 Layer 2 实现"
echo ""
