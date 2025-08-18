const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function checkSupportedCountries() {
  try {
    console.log('Checking supported countries for phone numbers...\n');
    
    const countries = await client.availablePhoneNumbers.list();
    
    console.log(`✅ Found ${countries.length} supported countries:`);
    console.log('Country Code | Country Name');
    console.log('-'.repeat(30));
    
    // Sort by country code for better readability
    countries
      .sort((a, b) => a.countryCode.localeCompare(b.countryCode))
      .forEach(country => {
        console.log(`${country.countryCode.padEnd(12)} | ${country.country}`);
      });
    
    // Check if US is available (most common for testing)
    const usAvailable = countries.find(c => c.countryCode === 'US');
    if (usAvailable) {
      console.log('\n🔍 Checking US phone numbers (recommended for testing)...');
      await checkUSNumbers();
    }
    
    // Check UK as alternative
    const ukAvailable = countries.find(c => c.countryCode === 'GB');
    if (ukAvailable) {
      console.log('\n🔍 Checking UK phone numbers...');
      await checkUKNumbers();
    }
    
  } catch (error) {
    console.error('❌ Error checking supported countries:', error.message);
  }
}

async function checkUSNumbers() {
  try {
    const phoneNumbers = await client.availablePhoneNumbers('US')
      .local
      .list({ limit: 5 });
    
    if (phoneNumbers.length > 0) {
      console.log(`   ✅ Found ${phoneNumbers.length} US numbers:`);
      phoneNumbers.forEach((number, index) => {
        console.log(`   ${index + 1}. ${number.phoneNumber} (${number.locality || 'No locality'})`);
      });
    }
  } catch (error) {
    console.log('   ❌ Error getting US numbers:', error.message);
  }
}

async function checkUKNumbers() {
  try {
    const phoneNumbers = await client.availablePhoneNumbers('GB')
      .local
      .list({ limit: 3 });
    
    if (phoneNumbers.length > 0) {
      console.log(`   ✅ Found ${phoneNumbers.length} UK numbers:`);
      phoneNumbers.forEach((number, index) => {
        console.log(`   ${index + 1}. ${number.phoneNumber}`);
      });
    }
  } catch (error) {
    console.log('   ❌ Error getting UK numbers:', error.message);
  }
}

async function checkAccountBalance() {
  try {
    const balance = await client.balance.fetch();
    console.log(`\n💰 Account Balance: $${balance.balance} ${balance.currency}`);
    
    if (parseFloat(balance.balance) < 1) {
      console.log('⚠️  Warning: Low balance. You may need to add funds to purchase a phone number.');
    }
  } catch (error) {
    console.log('❌ Could not check account balance:', error.message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('TWILIO SUPPORTED COUNTRIES & PHONE NUMBER AVAILABILITY');
  console.log('='.repeat(60));
  
  await checkAccountBalance();
  await checkSupportedCountries();
  
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS:');
  console.log('1. Use US (+1) numbers for testing - widely supported');
  console.log('2. UK (+44) numbers are also reliable');
  console.log('3. Purchase a number using: client.incomingPhoneNumbers.create()');
  console.log('4. Update your .env file with the new number');
  console.log('='.repeat(60));
}

main().catch(console.error);