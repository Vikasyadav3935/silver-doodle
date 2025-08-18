const fs = require('fs');

// Test results storage
const testResults = [];
let currentUser = null;
let authToken = null;

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null, isFormData = false) {
  const baseUrl = 'http://localhost:3000/api';
  const url = `${baseUrl}${endpoint}`;
  
  const headers = {
    'Content-Type': isFormData ? undefined : 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers: Object.fromEntries(Object.entries(headers).filter(([_, v]) => v !== undefined))
  };

  if (data && !isFormData) {
    config.body = JSON.stringify(data);
  } else if (data && isFormData) {
    config.body = data;
  }

  try {
    const response = await fetch(url, config);
    const result = await response.json();
    
    return {
      status: response.status,
      data: result,
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      success: false
    };
  }
}

// Test function wrapper
function createTest(category, name, testFunc) {
  return async () => {
    console.log(`\n🧪 Testing: ${category} - ${name}`);
    try {
      const result = await testFunc();
      testResults.push({
        category,
        name,
        status: result.success ? 'PASS' : 'FAIL',
        httpStatus: result.status,
        response: result.data,
        timestamp: new Date().toISOString()
      });
      
      if (result.success) {
        console.log(`✅ PASS - Status: ${result.status}`);
      } else {
        console.log(`❌ FAIL - Status: ${result.status}`);
        console.log(`   Error: ${JSON.stringify(result.data, null, 2)}`);
      }
      
      return result;
    } catch (error) {
      testResults.push({
        category,
        name,
        status: 'ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.log(`💥 ERROR: ${error.message}`);
      return { success: false, error: error.message };
    }
  };
}

// Authentication Tests
const authTests = {
  healthCheck: createTest('System', 'Health Check', async () => {
    return await apiCall('GET', '/health');
  }),

  sendOTP: createTest('Authentication', 'Send OTP', async () => {
    return await apiCall('POST', '/auth/send-otp', {
      phoneNumber: '+916387712911'
    });
  }),

  verifyOTP: createTest('Authentication', 'Verify OTP', async () => {
    const otpCode = '123456'; // We'll need to get this from user input or database
    const result = await apiCall('POST', '/auth/verify-otp', {
      phoneNumber: '+916387712911',
      code: otpCode
    });
    
    if (result.success && result.data.token) {
      authToken = result.data.token;
      currentUser = result.data.user;
      console.log(`   🔑 Token saved: ${authToken.substring(0, 20)}...`);
      console.log(`   👤 User ID: ${currentUser.id}`);
    }
    
    return result;
  }),

  getCurrentUser: createTest('Authentication', 'Get Current User', async () => {
    return await apiCall('GET', '/auth/me', null, authToken);
  }),

  refreshToken: createTest('Authentication', 'Refresh Token', async () => {
    return await apiCall('POST', '/auth/refresh-token', null, authToken);
  })
};

// User Profile Tests
const profileTests = {
  createProfile: createTest('User Profile', 'Create Profile', async () => {
    return await apiCall('POST', '/users/profile', {
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      gender: 'MALE',
      bio: 'This is a test bio for API testing',
      occupation: 'Software Engineer',
      company: 'Tech Corp',
      education: 'Computer Science',
      height: 175,
      interests: ['Technology', 'Sports', 'Music'],
      latitude: 28.6139,
      longitude: 77.2090
    }, authToken);
  }),

  getUserProfile: createTest('User Profile', 'Get User Profile', async () => {
    return await apiCall('GET', '/users/profile', null, authToken);
  }),

  updateProfile: createTest('User Profile', 'Update Profile', async () => {
    return await apiCall('PUT', '/users/profile', {
      bio: 'Updated bio via API testing',
      occupation: 'Senior Software Engineer'
    }, authToken);
  }),

  getUserSettings: createTest('User Profile', 'Get User Settings', async () => {
    return await apiCall('GET', '/users/settings', null, authToken);
  }),

  updateSettings: createTest('User Profile', 'Update Settings', async () => {
    return await apiCall('PUT', '/users/settings', {
      pushNotifications: true,
      showAge: true,
      discoveryEnabled: true
    }, authToken);
  }),

  getUserStats: createTest('User Profile', 'Get User Stats', async () => {
    return await apiCall('GET', '/users/stats', null, authToken);
  })
};

// Upload Tests (with dummy URLs since we can't upload real files)
const uploadTests = {
  uploadStats: createTest('Upload', 'Get Upload Stats', async () => {
    return await apiCall('GET', '/uploads/stats', null, authToken);
  })
};

// Profile Discovery Tests
const discoveryTests = {
  getInterests: createTest('Profile Discovery', 'Get Available Interests', async () => {
    return await apiCall('GET', '/profiles/interests/all');
  }),

  searchProfiles: createTest('Profile Discovery', 'Search Profiles', async () => {
    return await apiCall('GET', '/profiles/search/profiles?minAge=18&maxAge=35&limit=10', null, authToken);
  }),

  getMatchPreferences: createTest('Profile Discovery', 'Get Match Preferences', async () => {
    if (!currentUser) return { success: false, data: { error: 'No current user' } };
    return await apiCall('GET', `/profiles/${currentUser.id}/preferences`, null, authToken);
  }),

  updateMatchPreferences: createTest('Profile Discovery', 'Update Match Preferences', async () => {
    if (!currentUser) return { success: false, data: { error: 'No current user' } };
    return await apiCall('PUT', `/profiles/${currentUser.id}/preferences`, {
      minAge: 20,
      maxAge: 35,
      maxDistance: 50,
      genderPreference: 'ALL'
    }, authToken);
  })
};

// Matching Tests
const matchTests = {
  getDiscoveryProfiles: createTest('Matching', 'Get Discovery Profiles', async () => {
    return await apiCall('GET', '/matches/discovery?limit=5', null, authToken);
  }),

  getWhoLikedMe: createTest('Matching', 'Get Who Liked Me', async () => {
    return await apiCall('GET', '/matches/who-liked-me', null, authToken);
  }),

  getMatches: createTest('Matching', 'Get My Matches', async () => {
    return await apiCall('GET', '/matches/matches', null, authToken);
  })
};

// Chat Tests
const chatTests = {
  getConversations: createTest('Chat', 'Get Conversations', async () => {
    return await apiCall('GET', '/chats/conversations', null, authToken);
  }),

  getUnreadCount: createTest('Chat', 'Get Unread Message Count', async () => {
    return await apiCall('GET', '/chats/unread-count', null, authToken);
  })
};

// Payment Tests
const paymentTests = {
  getSubscriptionPlans: createTest('Payment', 'Get Subscription Plans', async () => {
    return await apiCall('GET', '/payments/plans');
  }),

  getCurrentSubscription: createTest('Payment', 'Get Current Subscription', async () => {
    return await apiCall('GET', '/payments/subscription', null, authToken);
  }),

  getActiveBoosts: createTest('Payment', 'Get Active Boosts', async () => {
    return await apiCall('GET', '/payments/boosts', null, authToken);
  }),

  checkFeatureAccess: createTest('Payment', 'Check Feature Access', async () => {
    return await apiCall('GET', '/payments/features/unlimited_likes', null, authToken);
  }),

  getPricing: createTest('Payment', 'Get Pricing Info', async () => {
    return await apiCall('GET', '/payments/pricing');
  }),

  getPaymentHistory: createTest('Payment', 'Get Payment History', async () => {
    return await apiCall('GET', '/payments/history', null, authToken);
  })
};

// Notification Tests
const notificationTests = {
  getNotifications: createTest('Notifications', 'Get Notifications', async () => {
    return await apiCall('GET', '/notifications', null, authToken);
  }),

  getNotificationStats: createTest('Notifications', 'Get Notification Stats', async () => {
    return await apiCall('GET', '/notifications/stats', null, authToken);
  }),

  addPushToken: createTest('Notifications', 'Add Push Token', async () => {
    return await apiCall('POST', '/notifications/push-token', {
      token: 'test-push-token-12345',
      platform: 'android'
    }, authToken);
  }),

  testNotification: createTest('Notifications', 'Send Test Notification', async () => {
    return await apiCall('POST', '/notifications/test', {
      title: 'Test Notification',
      message: 'This is a test notification from API testing',
      type: 'SYSTEM'
    }, authToken);
  })
};

// Admin Tests (will likely fail due to admin restrictions)
const adminTests = {
  getAdminStats: createTest('Admin', 'Get Platform Statistics', async () => {
    return await apiCall('GET', '/admin/stats', null, authToken);
  }),

  getUsers: createTest('Admin', 'Get Users List', async () => {
    return await apiCall('GET', '/admin/users?limit=5', null, authToken);
  }),

  getReports: createTest('Admin', 'Get Reports', async () => {
    return await apiCall('GET', '/admin/reports', null, authToken);
  }),

  getMetrics: createTest('Admin', 'Get System Metrics', async () => {
    return await apiCall('GET', '/admin/metrics', null, authToken);
  })
};

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Connect Dating App API Test Suite');
  console.log('=' * 60);

  const allTests = [
    ...Object.values(authTests),
    ...Object.values(profileTests), 
    ...Object.values(uploadTests),
    ...Object.values(discoveryTests),
    ...Object.values(matchTests),
    ...Object.values(chatTests),
    ...Object.values(paymentTests),
    ...Object.values(notificationTests),
    ...Object.values(adminTests)
  ];

  for (const test of allTests) {
    await test();
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }

  // Generate summary
  const passed = testResults.filter(t => t.status === 'PASS').length;
  const failed = testResults.filter(t => t.status === 'FAIL').length;
  const errors = testResults.filter(t => t.status === 'ERROR').length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`💥 Errors: ${errors}`);
  console.log(`📈 Success Rate: ${Math.round((passed / testResults.length) * 100)}%`);

  // Save detailed results to file
  const documentation = generateDocumentation();
  fs.writeFileSync('API_TEST_RESULTS.json', JSON.stringify(testResults, null, 2));
  fs.writeFileSync('API_DOCUMENTATION.md', documentation);
  
  console.log('\n📄 Full test results saved to: API_TEST_RESULTS.json');
  console.log('📚 API Documentation saved to: API_DOCUMENTATION.md');
}

function generateDocumentation() {
  return `# Connect Dating App - API Documentation

Generated on: ${new Date().toISOString()}
Server: http://localhost:3000/api

## Test Summary
- Total Tests: ${testResults.length}
- Passed: ${testResults.filter(t => t.status === 'PASS').length}
- Failed: ${testResults.filter(t => t.status === 'FAIL').length}
- Errors: ${testResults.filter(t => t.status === 'ERROR').length}

## API Endpoints

### 🔐 Authentication Endpoints
\`\`\`
POST /api/auth/send-otp          - Send OTP to phone number
POST /api/auth/verify-otp        - Verify OTP and get JWT token
POST /api/auth/resend-otp        - Resend OTP (rate limited)
POST /api/auth/refresh-token     - Refresh JWT token
POST /api/auth/logout           - Logout user
GET  /api/auth/me               - Get current user info
\`\`\`

### 👤 User Profile Endpoints
\`\`\`
GET  /api/users/profile         - Get current user profile
POST /api/users/profile         - Create user profile
PUT  /api/users/profile         - Update user profile
GET  /api/users/settings        - Get user settings
PUT  /api/users/settings        - Update user settings
GET  /api/users/stats           - Get user statistics
DELETE /api/users/account       - Delete user account
\`\`\`

### 🔍 Profile Discovery Endpoints
\`\`\`
GET /api/profiles/:userId                    - Get profile by ID
GET /api/profiles/:userId/preferences        - Get match preferences
PUT /api/profiles/:userId/preferences        - Update match preferences
GET /api/profiles/interests/all              - Get available interests
GET /api/profiles/search/profiles            - Search profiles
\`\`\`

### 💕 Matching Endpoints
\`\`\`
GET  /api/matches/discovery         - Get discovery profiles
POST /api/matches/like             - Like a profile
POST /api/matches/pass             - Pass on a profile
POST /api/matches/super-like       - Super like a profile
GET  /api/matches/who-liked-me     - Get who liked you
GET  /api/matches/matches          - Get your matches
POST /api/matches/undo             - Undo last action (premium)
\`\`\`

### 💬 Chat Endpoints
\`\`\`
GET    /api/chats/conversations                          - Get conversations
GET    /api/chats/conversations/:id                      - Get specific conversation
GET    /api/chats/conversations/:id/messages             - Get messages
POST   /api/chats/conversations/:id/messages             - Send message
PUT    /api/chats/conversations/:id/read                 - Mark messages as read
DELETE /api/chats/messages/:id                          - Delete message
GET    /api/chats/unread-count                          - Get unread count
GET    /api/chats/conversations/:id/search               - Search messages
\`\`\`

### 📸 Upload Endpoints
\`\`\`
POST /api/uploads/profile-photo              - Upload profile photo
DELETE /api/uploads/profile-photo/:id        - Delete profile photo
PUT /api/uploads/profile-photos/reorder      - Reorder photos
PUT /api/uploads/profile-photo/:id/primary   - Set primary photo
POST /api/uploads/chat-media                 - Upload chat media
POST /api/uploads/profile-photos/batch       - Batch upload photos
GET /api/uploads/stats                       - Get upload stats
POST /api/uploads/presigned-url              - Get presigned URL
\`\`\`

### 💳 Payment Endpoints
\`\`\`
GET    /api/payments/plans              - Get subscription plans
GET    /api/payments/subscription       - Get current subscription
POST   /api/payments/subscription       - Create subscription
DELETE /api/payments/subscription       - Cancel subscription
POST   /api/payments/boost              - Purchase boost
GET    /api/payments/boosts             - Get active boosts
GET    /api/payments/features/:feature  - Check feature access
GET    /api/payments/pricing            - Get pricing info
POST   /api/payments/super-likes        - Purchase super likes
GET    /api/payments/history            - Get payment history
POST   /api/payments/webhook            - Stripe webhook
\`\`\`

### 🔔 Notification Endpoints
\`\`\`
GET    /api/notifications                    - Get notifications
PUT    /api/notifications/read              - Mark notifications as read
DELETE /api/notifications/:id               - Delete notification
POST   /api/notifications/push-token        - Add push token
DELETE /api/notifications/push-token        - Remove push token
GET    /api/notifications/stats             - Get notification stats
POST   /api/notifications/test              - Send test notification
\`\`\`

### 🛡️ Admin Endpoints
\`\`\`
GET /api/admin/stats                      - Get platform statistics
GET /api/admin/users                      - Get users with pagination
GET /api/admin/reports                    - Get reports
PUT /api/admin/reports/:id                - Update report status
POST /api/admin/notifications/broadcast   - Broadcast notification
GET /api/admin/metrics                    - Get system metrics
\`\`\`

### 🏥 System Endpoints
\`\`\`
GET /api/health                          - Health check
\`\`\`

## Test Results Details

${testResults.map(test => `
### ${test.category} - ${test.name}
- **Status**: ${test.status}
- **HTTP Status**: ${test.httpStatus || 'N/A'}
- **Timestamp**: ${test.timestamp}
${test.error ? `- **Error**: ${test.error}` : ''}
${test.response ? `
**Response**:
\`\`\`json
${JSON.stringify(test.response, null, 2)}
\`\`\`
` : ''}
`).join('\n')}

## Sample Requests

### Authentication Flow
\`\`\`bash
# 1. Send OTP
curl -X POST http://localhost:3000/api/auth/send-otp \\
  -H "Content-Type: application/json" \\
  -d '{"phoneNumber": "+1234567890"}'

# 2. Verify OTP
curl -X POST http://localhost:3000/api/auth/verify-otp \\
  -H "Content-Type: application/json" \\
  -d '{"phoneNumber": "+1234567890", "code": "123456"}'

# 3. Get current user
curl -X GET http://localhost:3000/api/auth/me \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
\`\`\`

### Profile Creation
\`\`\`bash
curl -X POST http://localhost:3000/api/users/profile \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "gender": "MALE",
    "bio": "Hello, I am John!",
    "occupation": "Software Engineer",
    "interests": ["Technology", "Sports"]
  }'
\`\`\`

### Photo Upload (Simulated)
\`\`\`bash
# Note: For photo uploads, you would need to use multipart/form-data
# This is a simulated example - actual implementation would require file data
curl -X POST http://localhost:3000/api/uploads/profile-photo \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -F "photo=@/path/to/your/photo.jpg" \\
  -F "isPrimary=true"
\`\`\`

## Error Responses

All endpoints return errors in the following format:
\`\`\`json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors if applicable
}
\`\`\`

Common HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer YOUR_JWT_TOKEN
\`\`\`

Tokens are obtained through the OTP verification process and expire after 7 days by default.

---
*Generated by Connect Dating App API Test Suite*
`;
}

// Special function for OTP testing - will prompt user for OTP
async function testWithUserOTP() {
  console.log('🚀 Starting Authentication Flow Test');
  
  // Step 1: Send OTP
  console.log('\n1. Sending OTP...');
  const otpResult = await apiCall('POST', '/auth/send-otp', {
    phoneNumber: '+916387712911'
  });
  
  if (!otpResult.success) {
    console.log('❌ Failed to send OTP:', otpResult.data);
    return false;
  }
  
  console.log('✅ OTP sent successfully!');
  console.log('📱 Please check your phone for the OTP code');
  
  // In a real scenario, we would get OTP from user input
  // For automated testing, we'll need to get it from database or user input
  console.log('⚠️  You need to provide the OTP manually for verification test');
  console.log('   Use: await testAuthWithOTP("YOUR_OTP_CODE")');
  
  return true;
}

async function testAuthWithOTP(otpCode) {
  const result = await apiCall('POST', '/auth/verify-otp', {
    phoneNumber: '+916387712911',
    code: otpCode
  });
  
  if (result.success && result.data.token) {
    authToken = result.data.token;
    currentUser = result.data.user;
    console.log('✅ Authentication successful!');
    console.log('🔑 Token:', authToken.substring(0, 20) + '...');
    console.log('👤 User ID:', currentUser.id);
    
    // Now run the rest of the tests
    await runAllTests();
  } else {
    console.log('❌ Authentication failed:', result.data);
  }
}

// Export functions for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testWithUserOTP,
    testAuthWithOTP,
    apiCall
  };
} else {
  // For browser testing
  window.apiTester = {
    runAllTests,
    testWithUserOTP,
    testAuthWithOTP,
    apiCall
  };
}

// Auto-run if called directly
if (require.main === module) {
  testWithUserOTP();
}