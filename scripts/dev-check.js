const fs = require('fs');
const path = require('path');

console.log('🔍 Running development environment checks...\n');

// Check if required files exist
const requiredFiles = [
  '.env',
  'src/server.ts',
  'prisma/schema.prisma',
  'package.json',
  'tsconfig.json'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} is missing`);
    allFilesExist = false;
  }
});

// Check environment variables
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'PORT'
  ];

  console.log('\n🔧 Checking environment variables:');
  requiredEnvVars.forEach(envVar => {
    if (envContent.includes(`${envVar}=`)) {
      const value = envContent.match(new RegExp(`${envVar}=(.*)`))?.[1];
      if (value && !value.startsWith('your-') && value !== 'change-this') {
        console.log(`✅ ${envVar} is configured`);
      } else {
        console.log(`⚠️  ${envVar} needs to be configured`);
      }
    } else {
      console.log(`❌ ${envVar} is missing`);
    }
  });
}

// Check if node_modules exists
if (fs.existsSync('node_modules')) {
  console.log('\n✅ Dependencies are installed');
} else {
  console.log('\n❌ Dependencies not installed. Run: npm install');
  allFilesExist = false;
}

// Check TypeScript compilation
console.log('\n🔨 Checking TypeScript compilation...');
const { exec } = require('child_process');

exec('npx tsc --noEmit', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ TypeScript compilation errors found:');
    console.log(stderr);
  } else {
    console.log('✅ TypeScript compilation successful');
  }
  
  console.log('\n📋 Summary:');
  if (allFilesExist) {
    console.log('✅ All required files are present');
    console.log('🚀 Ready to start development server with: npm run dev');
  } else {
    console.log('❌ Some files are missing. Please check the setup.');
  }
});

console.log('\n📚 Useful commands:');
console.log('  npm run dev          - Start development server');
console.log('  npm run build        - Build for production');
console.log('  npm run prisma:studio - Open Prisma Studio');
console.log('  npm run seed         - Seed the database');
console.log('  npm run type-check   - Check TypeScript types');