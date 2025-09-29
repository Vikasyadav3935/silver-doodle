#!/bin/bash

echo "🚀 Setting up Personality Questionnaire System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm found"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create .env file with DATABASE_URL and other required variables."
    echo "Example:"
    echo "DATABASE_URL=\"postgresql://username:password@localhost:5432/your_database\""
    echo "JWT_SECRET=\"your_jwt_secret\""
    echo "PORT=3000"
    exit 1
fi

echo "✅ Environment file found"

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
    echo "❌ Database migrations failed. Please check your DATABASE_URL and database connection."
    exit 1
fi

echo "✅ Database migrations completed"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Prisma client generation failed."
    exit 1
fi

echo "✅ Prisma client generated"

# Seed personality questions
echo "🌱 Seeding personality questions..."
npx tsx scripts/seed-personality-questions.ts

if [ $? -ne 0 ]; then
    echo "❌ Failed to seed personality questions."
    exit 1
fi

echo "✅ Personality questions seeded successfully"

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed."
    exit 1
fi

echo "✅ Project built successfully"

echo ""
echo "🎉 Personality Questionnaire System setup complete!"
echo ""
echo "📋 What was set up:"
echo "   ✅ Database schema with personality tables"
echo "   ✅ 22 comprehensive personality questions"
echo "   ✅ Personality scoring algorithm"
echo "   ✅ Compatibility matching system"
echo "   ✅ REST APIs for questionnaire management"
echo ""
echo "🚀 To start the server:"
echo "   npm run dev"
echo ""
echo "📊 To view the database:"
echo "   npx prisma studio"
echo ""
echo "🧪 API Endpoints available:"
echo "   GET    /api/personality/questions     - Get all questions"
echo "   POST   /api/personality/submit       - Submit answers"
echo "   GET    /api/personality/scores       - Get user's scores"
echo "   GET    /api/personality/compatibility/:userId - Get compatibility"
echo "   DELETE /api/personality/retake       - Reset questionnaire"
echo ""
echo "📱 Frontend integration:"
echo "   - QuestionsScreen updated with 22 questions"
echo "   - Redux state management configured"
echo "   - Navigation flow integrated"
echo "   - Personality service for API calls"
echo ""