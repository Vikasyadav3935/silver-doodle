const AWS = require('aws-sdk');
require('dotenv').config();

async function debugSMSDelivery() {
  console.log('='.repeat(50));
  console.log('AWS SNS SMS DEBUGGING');
  console.log('='.repeat(50));

  try {
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    const sns = new AWS.SNS();

    // Check SMS attributes for the region
    console.log('🔍 Checking SMS attributes for region:', process.env.AWS_REGION);
    
    try {
      const attributes = await sns.getSMSAttributes().promise();
      console.log('📋 Current SMS attributes:');
      Object.keys(attributes.attributes).forEach(key => {
        console.log(`   ${key}: ${attributes.attributes[key]}`);
      });
    } catch (error) {
      console.log('❌ Could not get SMS attributes:', error.message);
    }

    // Try sending with explicit SMS attributes
    console.log('\n📱 Sending SMS with debug options...');
    
    const params = {
      Message: 'DEBUG: Test SMS from Connect app. Time: ' + new Date().toISOString(),
      PhoneNumber: '+916387712911',
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'CONNECT'
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String', 
          StringValue: 'Transactional'
        }
      }
    };

    console.log('Sending with parameters:', JSON.stringify(params, null, 2));
    
    const result = await sns.publish(params).promise();
    console.log('✅ SMS sent with MessageId:', result.MessageId);

    // Try different region if current one doesn't work
    if (process.env.AWS_REGION === 'us-east-1') {
      console.log('\n🌏 Trying with Asia Pacific region...');
      
      const snsAsia = new AWS.SNS({ region: 'ap-south-1' });
      
      const asiaResult = await snsAsia.publish({
        Message: 'ASIA REGION: Test SMS from Connect app. Time: ' + new Date().toISOString(),
        PhoneNumber: '+916387712911'
      }).promise();
      
      console.log('✅ SMS sent from ap-south-1 with MessageId:', asiaResult.MessageId);
    }

    // Check delivery status if possible
    console.log('\n📊 Note: SMS delivery can take 1-5 minutes in India');
    console.log('💡 If still no SMS, possible issues:');
    console.log('   1. Phone number might be on Do Not Disturb registry');
    console.log('   2. Carrier blocking international SMS');
    console.log('   3. AWS SNS limits for new accounts');
    console.log('   4. Need to request SMS sandbox exit from AWS');

  } catch (error) {
    console.log('❌ Error during debug:', error.message);
    
    if (error.code === 'OptedOut') {
      console.log('📵 Phone number has opted out of SMS messages');
      console.log('💡 You can opt back in by replying START to any AWS SMS');
    }
  }
}

async function checkAWSSandbox() {
  console.log('\n' + '='.repeat(50));
  console.log('AWS SNS SANDBOX CHECK');
  console.log('='.repeat(50));
  
  console.log('🏠 AWS SNS starts in "Sandbox Mode" which limits SMS sending');
  console.log('📋 To check/exit sandbox:');
  console.log('   1. Go to AWS Console → Simple Notification Service');
  console.log('   2. Left menu → Text messaging (SMS) → Sandbox destination phone numbers');
  console.log('   3. Add +916387712911 to verified numbers');
  console.log('   4. Or request to exit sandbox for production use');
  console.log('\n💡 In sandbox mode, you can only send to verified numbers');
}

async function main() {
  await debugSMSDelivery();
  await checkAWSSandbox();
}

main().catch(console.error);