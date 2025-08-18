#!/bin/bash

echo "🚀 Setting up Connect Dating App Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version 18+ is required. Current version: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Please copy .env.example to .env and configure your environment variables."
    echo "   cp .env.example .env"
    echo "   Then edit .env with your database URL and API keys."
else
    echo "✅ .env file found"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi

echo "✅ Prisma client generated"

# Create logs directory
mkdir -p logs

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Configure your .env file with database URL and API keys"
echo "2. Set up your PostgreSQL database"
echo "3. Run database migrations: npm run prisma:migrate"
echo "4. Seed the database: npm run seed"
echo "5. Start the development server: npm run dev"
echo ""
echo "For more information, see README.md"