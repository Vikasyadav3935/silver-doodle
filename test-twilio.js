const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('Twilio credentials not found in environment variables');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function testTwilioCredentials() {
  try {
    console.log('Testing Twilio credentials...');
    
    // Test credentials by fetching account info
    const account = await client.api.accounts(accountSid).fetch();
    console.log(`✅ Credentials valid - Account: ${account.friendlyName} (${account.status})`);
    
    return true;
  } catch (error) {
    console.error('❌ Twilio credentials test failed:', error.message);
    return false;
  }
}

async function checkIndiaPhoneNumbers() {
  try {
    console.log('\nChecking available phone numbers for India (+91)...');
    
    // Check available phone numbers in India
    const phoneNumbers = await client.availablePhoneNumbers('IN')
      .local
      .list({ limit: 10 });
    
    if (phoneNumbers.length > 0) {
      console.log(`✅ Found ${phoneNumbers.length} available phone numbers in India:`);
      phoneNumbers.forEach((number, index) => {
        console.log(`${index + 1}. ${number.phoneNumber} (${number.locality || 'No locality'})`);
      });
    } else {
      console.log('❌ No phone numbers available in India');
    }
    
    return phoneNumbers;
  } catch (error) {
    console.error('❌ Error checking India phone numbers:', error.message);
    
    // Try checking toll-free numbers as an alternative
    try {
      console.log('\nTrying toll-free numbers for India...');
      const tollFreeNumbers = await client.availablePhoneNumbers('IN')
        .tollFree
        .list({ limit: 5 });
      
      if (tollFreeNumbers.length > 0) {
        console.log(`✅ Found ${tollFreeNumbers.length} toll-free numbers in India:`);
        tollFreeNumbers.forEach((number, index) => {
          console.log(`${index + 1}. ${number.phoneNumber}`);
        });
      } else {
        console.log('❌ No toll-free numbers available in India');
      }
    } catch (tollFreeError) {
      console.error('❌ Error checking toll-free numbers:', tollFreeError.message);
    }
    
    return [];
  }
}

async function checkCurrentPhoneNumber() {
  try {
    const currentNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!currentNumber) {
      console.log('❌ No phone number configured in TWILIO_PHONE_NUMBER');
      return;
    }
    
    console.log(`\nChecking current phone number: ${currentNumber}...`);
    
    // Try to fetch details of the current phone number
    const phoneNumbers = await client.incomingPhoneNumbers.list();
    const currentPhoneNumber = phoneNumbers.find(num => num.phoneNumber === currentNumber);
    
    if (currentPhoneNumber) {
      console.log(`✅ Current number is valid and active`);
      console.log(`   Status: ${currentPhoneNumber.status || 'Active'}`);
      console.log(`   Capabilities: SMS: ${currentPhoneNumber.capabilities.sms ? '✅' : '❌'}, Voice: ${currentPhoneNumber.capabilities.voice ? '✅' : '❌'}`);
    } else {
      console.log(`❌ Current number ${currentNumber} is not found in your Twilio account`);
    }
  } catch (error) {
    console.error('❌ Error checking current phone number:', error.message);
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('TWILIO PHONE NUMBER TEST FOR INDIA');
  console.log('='.repeat(50));
  
  const credentialsValid = await testTwilioCredentials();
  
  if (!credentialsValid) {
    console.log('\n❌ Cannot proceed without valid credentials');
    process.exit(1);
  }
  
  await checkCurrentPhoneNumber();
  await checkIndiaPhoneNumbers();
  
  console.log('\n='.repeat(50));
  console.log('TEST COMPLETED');
  console.log('='.repeat(50));
}

main().catch(console.error);