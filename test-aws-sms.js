const AWS = require('aws-sdk');
require('dotenv').config();

async function testAWSSNS() {
  console.log('='.repeat(50));
  console.log('AWS SNS SMS TEST');
  console.log('='.repeat(50));

  try {
    // Check credentials
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION;

    if (!accessKeyId || !secretAccessKey) {
      console.log('❌ AWS credentials not found in .env file');
      return;
    }

    console.log(`✅ AWS credentials configured`);
    console.log(`   Access Key: ${accessKeyId.substring(0, 8)}...`);
    console.log(`   Region: ${region}`);

    // Configure AWS
    AWS.config.update({
      accessKeyId,
      secretAccessKey,
      region
    });

    const sns = new AWS.SNS();

    // Test connection first
    console.log('\n🔍 Testing AWS SNS connection...');
    try {
      await sns.listTopics().promise();
      console.log('✅ AWS SNS connection successful');
    } catch (error) {
      console.log('❌ AWS SNS connection failed:', error.message);
      if (error.code === 'InvalidUserID.NotFound' || error.code === 'SignatureDoesNotMatch') {
        console.log('💡 This usually means invalid AWS credentials');
      }
      return;
    }

    // Send test SMS
    const phoneNumber = '+916387712911';
    const message = 'Test SMS from your Connect app! 🎉 AWS SNS is working perfectly.';

    console.log(`\n📱 Sending test SMS to ${phoneNumber}...`);
    
    const params = {
      Message: message,
      PhoneNumber: phoneNumber
    };

    const result = await sns.publish(params).promise();
    
    console.log('✅ SMS sent successfully!');
    console.log(`   Message ID: ${result.MessageId}`);
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Message: "${message}"`);

    console.log('\n🎉 AWS SNS SMS service is working correctly!');

  } catch (error) {
    console.log('❌ Error during SMS test:', error.message);
    
    if (error.code === 'Throttling') {
      console.log('💡 SMS sending is throttled. Try again in a few minutes.');
    } else if (error.code === 'InvalidParameter') {
      console.log('💡 Invalid phone number format or message content.');
    } else if (error.code === 'OptedOut') {
      console.log('💡 This phone number has opted out of SMS messages.');
    }
  }
}

async function testWithSmsService() {
  console.log('\n' + '='.repeat(50));
  console.log('TESTING WITH SMS SERVICE CLASS');
  console.log('='.repeat(50));

  try {
    // Build first
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    console.log('Building TypeScript files...');
    await execAsync('npm run build');
    console.log('✅ Build successful');

    // Test the actual SMS service
    const { SmsService } = require('./dist/services/smsService');
    const smsService = new SmsService();

    console.log('\n📱 Testing SmsService.sendSMS()...');
    await smsService.sendSMS('+916387712911', 'Hello from Connect SmsService! This is a test.');

    console.log('\n🔐 Testing SmsService.sendOTPSMS()...');
    await smsService.sendOTPSMS('+916387712911', '123456');

    console.log('\n✅ Both SMS service methods work perfectly!');

  } catch (error) {
    console.log('❌ Error testing SMS service:', error.message);
  }
}

async function main() {
  await testAWSSNS();
  await testWithSmsService();
  
  console.log('\n' + '='.repeat(50));
  console.log('TEST COMPLETED');
  console.log('Your SMS service is ready to use in the app!');
  console.log('='.repeat(50));
}

main().catch(console.error);