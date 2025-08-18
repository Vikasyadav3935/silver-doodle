const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function purchaseUSNumber() {
  try {
    console.log('🔍 Finding available US phone numbers...');
    
    // Get available US numbers
    const availableNumbers = await client.availablePhoneNumbers('US')
      .local
      .list({ 
        limit: 5,
        smsEnabled: true, // Ensure SMS capability
        voiceEnabled: true // Ensure voice capability
      });
    
    if (availableNumbers.length === 0) {
      console.log('❌ No available US numbers found');
      return null;
    }
    
    console.log(`✅ Found ${availableNumbers.length} available numbers:`);
    availableNumbers.forEach((number, index) => {
      console.log(`   ${index + 1}. ${number.phoneNumber} (${number.locality || 'No locality'})`);
    });
    
    // Purchase the first available number
    const selectedNumber = availableNumbers[0];
    console.log(`\n💳 Purchasing number: ${selectedNumber.phoneNumber}...`);
    
    const purchasedNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber.phoneNumber,
      friendlyName: 'Connect App SMS Number'
    });
    
    console.log(`✅ Successfully purchased: ${purchasedNumber.phoneNumber}`);
    console.log(`   Account SID: ${purchasedNumber.accountSid}`);
    console.log(`   Friendly Name: ${purchasedNumber.friendlyName}`);
    console.log(`   Status: ${purchasedNumber.status}`);
    console.log(`   SMS Enabled: ${purchasedNumber.capabilities.sms ? '✅' : '❌'}`);
    console.log(`   Voice Enabled: ${purchasedNumber.capabilities.voice ? '✅' : '❌'}`);
    
    return purchasedNumber.phoneNumber;
    
  } catch (error) {
    console.error('❌ Error purchasing number:', error.message);
    
    if (error.code === 21452) {
      console.log('💡 This usually means insufficient funds. Please add credit to your Twilio account.');
    }
    
    return null;
  }
}

async function updateEnvFile(phoneNumber) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace the TWILIO_PHONE_NUMBER line
    envContent = envContent.replace(
      /TWILIO_PHONE_NUMBER=.*/,
      `TWILIO_PHONE_NUMBER="${phoneNumber}"`
    );
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env file with new phone number: ${phoneNumber}`);
    
  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
    console.log(`💡 Please manually update TWILIO_PHONE_NUMBER="${phoneNumber}" in your .env file`);
  }
}

async function testSMS(phoneNumber) {
  try {
    console.log('\n📱 Testing SMS functionality...');
    
    // Note: This would send an actual SMS. Uncomment and modify for real testing
    /*
    const message = await client.messages.create({
      body: 'Test SMS from your Connect app! 🎉',
      from: phoneNumber,
      to: '+1YOUR_TEST_PHONE_NUMBER' // Replace with your actual phone number
    });
    
    console.log(`✅ Test SMS sent successfully! Message SID: ${message.sid}`);
    */
    
    console.log('💡 To test SMS, uncomment the code in testSMS() function and add your phone number');
    console.log(`💡 Or use the SMS service in your app: await smsService.sendSMS('+1YOUR_NUMBER', 'Test message')`);
    
  } catch (error) {
    console.error('❌ Error testing SMS:', error.message);
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('PURCHASE TWILIO PHONE NUMBER');
  console.log('='.repeat(50));
  
  const phoneNumber = await purchaseUSNumber();
  
  if (phoneNumber) {
    await updateEnvFile(phoneNumber);
    await testSMS(phoneNumber);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 SUCCESS! Your Twilio setup is now complete:');
    console.log(`📞 Phone Number: ${phoneNumber}`);
    console.log('📝 Updated .env file');
    console.log('🔧 Ready to send SMS through your app');
    console.log('='.repeat(50));
  } else {
    console.log('\n❌ Failed to purchase phone number. Please try again or check your account.');
  }
}

// Only run if called directly
if (require.main === module) {
  main().catch(console.error);
}