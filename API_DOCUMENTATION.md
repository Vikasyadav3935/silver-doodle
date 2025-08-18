# Connect Dating App - Complete API Documentation

**Generated**: August 13, 2025  
**Server**: http://localhost:3001/api  
**Version**: 1.0.0  
**Authentication**: JWT Bearer Token  

## 📋 Overview

Connect is a comprehensive dating app backend built with Node.js, Express, TypeScript, and PostgreSQL. It provides a complete set of APIs for user authentication, profile management, matching, messaging, payments, and administrative functions.

## 🎯 Test Results Summary

- **Total Endpoints**: 40+
- **Categories**: 8 (Auth, Profile, Discovery, Matching, Chat, Upload, Payment, Admin)
- **Authentication**: ✅ Working (OTP-based phone verification)
- **Database**: ✅ Connected (PostgreSQL via Neon)
- **SMS Service**: ✅ Working (AWS SNS)
- **Server Status**: ✅ Running on port 3001

## 🔐 Authentication Flow

### 1. Send OTP
```bash
POST /api/auth/send-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "purpose": "PHONE_VERIFICATION" // optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

### 2. Verify OTP
```bash
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "code": "123456",
  "purpose": "PHONE_VERIFICATION" // optional
}
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "phoneNumber": "+1234567890",
    "isVerified": true
  }
}
```

### 3. Use JWT Token
Include the token in all subsequent requests:
```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📱 Complete API Reference

### 🏥 System Health
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | ❌ | Server health check |

### 🔐 Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/send-otp` | ❌ | Send OTP to phone |
| POST | `/auth/verify-otp` | ❌ | Verify OTP & get token |
| POST | `/auth/resend-otp` | ❌ | Resend OTP (rate limited) |
| GET | `/auth/me` | ✅ | Get current user info |
| POST | `/auth/refresh-token` | ✅ | Refresh JWT token |
| POST | `/auth/logout` | ✅ | Logout user |

### 👤 User Profile
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/profile` | ✅ | Get user profile |
| POST | `/users/profile` | ✅ | Create user profile |
| PUT | `/users/profile` | ✅ | Update user profile |
| GET | `/users/settings` | ✅ | Get user settings |
| PUT | `/users/settings` | ✅ | Update user settings |
| GET | `/users/stats` | ✅ | Get user statistics |
| DELETE | `/users/account` | ✅ | Delete user account |

### 🔍 Profile Discovery
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profiles/:userId` | ✅ | Get profile by ID |
| GET | `/profiles/:userId/preferences` | ✅ | Get match preferences |
| PUT | `/profiles/:userId/preferences` | ✅ | Update match preferences |
| GET | `/profiles/interests/all` | ❌ | Get available interests |
| GET | `/profiles/search/profiles` | ✅ | Search profiles |

### 💕 Matching System
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/matches/discovery` | ✅ | Get discovery profiles |
| POST | `/matches/like` | ✅ | Like a profile |
| POST | `/matches/pass` | ✅ | Pass on a profile |
| POST | `/matches/super-like` | ✅ | Super like a profile |
| GET | `/matches/who-liked-me` | ✅ | Get who liked you |
| GET | `/matches/matches` | ✅ | Get your matches |
| POST | `/matches/undo` | ✅ | Undo last action (premium) |

### 💬 Chat & Messaging  
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chats/conversations` | ✅ | Get conversations list |
| GET | `/chats/conversations/:id` | ✅ | Get specific conversation |
| GET | `/chats/conversations/:id/messages` | ✅ | Get conversation messages |
| POST | `/chats/conversations/:id/messages` | ✅ | Send a message |
| PUT | `/chats/conversations/:id/read` | ✅ | Mark messages as read |
| DELETE | `/chats/messages/:messageId` | ✅ | Delete a message |
| GET | `/chats/unread-count` | ✅ | Get unread message count |
| GET | `/chats/conversations/:id/search` | ✅ | Search messages |

### 📸 File Upload
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/uploads/profile-photo` | ✅ | Upload profile photo |
| DELETE | `/uploads/profile-photo/:id` | ✅ | Delete profile photo |
| PUT | `/uploads/profile-photos/reorder` | ✅ | Reorder photos |
| PUT | `/uploads/profile-photo/:id/primary` | ✅ | Set primary photo |
| POST | `/uploads/chat-media` | ✅ | Upload chat media |
| POST | `/uploads/profile-photos/batch` | ✅ | Batch upload photos |
| GET | `/uploads/stats` | ✅ | Get upload statistics |
| POST | `/uploads/presigned-url` | ✅ | Get presigned upload URL |

### 💳 Payments & Subscriptions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/payments/plans` | ❌ | Get subscription plans |
| GET | `/payments/subscription` | ✅ | Get current subscription |
| POST | `/payments/subscription` | ✅ | Create subscription |
| DELETE | `/payments/subscription` | ✅ | Cancel subscription |
| POST | `/payments/boost` | ✅ | Purchase boost |
| GET | `/payments/boosts` | ✅ | Get active boosts |
| GET | `/payments/features/:feature` | ✅ | Check feature access |
| GET | `/payments/pricing` | ❌ | Get pricing information |
| POST | `/payments/super-likes` | ✅ | Purchase super likes |
| GET | `/payments/history` | ✅ | Get payment history |
| POST | `/payments/webhook` | ❌ | Stripe webhook handler |

### 🔔 Notifications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | ✅ | Get user notifications |
| PUT | `/notifications/read` | ✅ | Mark notifications as read |
| DELETE | `/notifications/:id` | ✅ | Delete notification |
| POST | `/notifications/push-token` | ✅ | Add push token |
| DELETE | `/notifications/push-token` | ✅ | Remove push token |
| GET | `/notifications/stats` | ✅ | Get notification stats |
| POST | `/notifications/test` | ✅ | Send test notification (dev) |

### 🛡️ Admin Panel
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/stats` | ✅ | Get platform statistics |
| GET | `/admin/users` | ✅ | Get users with pagination |
| GET | `/admin/reports` | ✅ | Get user reports |
| PUT | `/admin/reports/:id` | ✅ | Update report status |
| POST | `/admin/notifications/broadcast` | ✅ | Broadcast notification |
| GET | `/admin/metrics` | ✅ | Get system metrics |

## 📊 Sample Requests & Responses

### Authentication Example
```bash
# Send OTP
curl -X POST http://localhost:3001/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+916387712911"}'

# Response
{
  "success": true,
  "message": "OTP sent successfully"
}
```

### Create Profile Example
```bash
curl -X POST http://localhost:3001/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "gender": "MALE",
    "bio": "Software engineer who loves hiking and coffee",
    "occupation": "Software Engineer",
    "company": "Tech Corp",
    "education": "Computer Science",
    "height": 175,
    "interests": ["Technology", "Hiking", "Coffee"],
    "latitude": 28.6139,
    "longitude": 77.2090
  }'

# Response
{
  "success": true,
  "profile": {
    "id": "profile-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Software engineer who loves hiking and coffee",
    "profileCompleteness": 85,
    "isVerified": false,
    "photos": [],
    "interests": [
      {"id": "1", "name": "Technology"},
      {"id": "2", "name": "Hiking"}, 
      {"id": "3", "name": "Coffee"}
    ]
  }
}
```

### Photo Upload Example (with dummy URL)
```bash
# For photo uploads, you would typically use multipart/form-data
# Since we're testing, here's the expected structure:
curl -X POST http://localhost:3001/api/uploads/profile-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@/path/to/photo.jpg" \
  -F "isPrimary=true"

# Expected Response (simulated)
{
  "success": true,
  "photo": {
    "id": "photo-uuid",
    "url": "https://dummy-photo-url.com/photo.jpg",
    "publicId": "cloudinary-public-id",
    "isPrimary": true,
    "order": 0
  }
}
```

### Like Profile Example
```bash
curl -X POST http://localhost:3001/api/matches/like \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userId": "target-user-uuid"}'

# Response (Match created)
{
  "success": true,
  "isMatch": true,
  "match": {
    "id": "match-uuid",
    "user1Id": "your-uuid",
    "user2Id": "target-user-uuid",
    "createdAt": "2025-08-13T18:00:00.000Z"
  }
}

# Response (Like only)
{
  "success": true,
  "isMatch": false,
  "message": "Like sent successfully"
}
```

### Send Message Example
```bash
curl -X POST http://localhost:3001/api/chats/conversations/conversation-uuid/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "messageType": "TEXT",
    "content": "Hey! How are you doing?"
  }'

# Response
{
  "success": true,
  "message": {
    "id": "message-uuid",
    "content": "Hey! How are you doing?",
    "messageType": "TEXT",
    "senderId": "your-uuid",
    "receiverId": "other-user-uuid",
    "isRead": false,
    "createdAt": "2025-08-13T18:00:00.000Z"
  }
}
```

## 🔒 Security & Validation

### Authentication Requirements
- **Phone Verification**: All users must verify phone numbers via OTP
- **JWT Tokens**: 7-day expiration by default
- **Rate Limiting**: 3 OTP attempts per 30 minutes
- **Input Validation**: All endpoints validate input data

### Data Validation Examples
```typescript
// Profile Creation Validation
{
  firstName: "Required, 1-50 characters",
  lastName: "Optional, max 50 characters", 
  dateOfBirth: "Required, valid ISO date",
  gender: "Required, MALE|FEMALE|NON_BINARY|OTHER",
  bio: "Optional, max 500 characters",
  phoneNumber: "Valid international format",
  interests: "Optional array, max 20 items"
}

// Message Validation  
{
  messageType: "Required, TEXT|IMAGE|VIDEO|AUDIO|LOCATION|GIF",
  content: "Optional, 1-1000 characters",
  mediaUrl: "Optional, valid URL format"
}
```

## ⚙️ Configuration

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:pass@host:port/db"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# AWS SNS (SMS)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"

# Server
PORT=3001
NODE_ENV="development"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚨 Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "stack": "Error stack trace (development only)"
}
```

### Common HTTP Status Codes
- **200**: OK - Request successful
- **201**: Created - Resource created successfully  
- **400**: Bad Request - Validation failed
- **401**: Unauthorized - Authentication required
- **403**: Forbidden - Permission denied
- **404**: Not Found - Resource not found
- **429**: Too Many Requests - Rate limited
- **500**: Internal Server Error - Server error

### Validation Error Example
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "firstName",
      "message": "First name is required"
    },
    {
      "field": "phoneNumber", 
      "message": "Please provide a valid phone number"
    }
  ]
}
```

## 📈 Features & Capabilities

### ✅ Implemented Features
- **Phone-based authentication** with SMS OTP
- **Complete user profiles** with photos and interests
- **Advanced matching system** with filters and preferences  
- **Real-time messaging** with Socket.IO support
- **File upload system** for photos and media
- **Premium subscriptions** with Stripe integration
- **Push notifications** with FCM
- **Comprehensive admin panel** with analytics
- **Rate limiting** and security measures
- **Input validation** and error handling

### 🚧 Additional Features Available
- **Profile verification** system
- **Location-based matching** with distance calculations
- **Super likes and boosts** (premium features)
- **Advanced search** with multiple filters
- **Message search** and conversation management
- **User reporting and moderation** tools
- **Payment history** and subscription management
- **Analytics and metrics** for platform insights

## 🧪 Testing

The API has been comprehensively tested with:
- **Unit tests** for individual endpoints
- **Integration tests** for complete workflows
- **Authentication flow** validation
- **Error handling** verification
- **Rate limiting** testing
- **Database connectivity** checks

### Test Coverage Summary
- **Authentication**: ✅ Complete (OTP send/verify, JWT)
- **User Management**: ✅ Complete (CRUD operations)
- **Matching System**: ✅ Complete (discovery, like/pass)
- **Messaging**: ✅ Complete (conversations, messages)
- **File Uploads**: ✅ Structure ready (dummy URLs)
- **Payments**: ✅ Complete (plans, subscriptions)
- **Notifications**: ✅ Complete (push tokens, delivery)
- **Admin Functions**: ✅ Complete (stats, moderation)

## 📱 Integration Examples

### React Native Integration
```javascript
// Authentication
const authenticateUser = async (phoneNumber, otp) => {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, code: otp })
  });
  
  const data = await response.json();
  if (data.success) {
    AsyncStorage.setItem('authToken', data.token);
    return data.user;
  }
  throw new Error(data.error);
};

// Get matches
const getMatches = async () => {
  const token = await AsyncStorage.getItem('authToken');
  const response = await fetch('/api/matches/matches', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return await response.json();
};
```

### Socket.IO Integration
```javascript
// Client-side connection
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: { token: 'your-jwt-token' }
});

// Listen for new messages
socket.on('new_message', (message) => {
  console.log('New message received:', message);
});

// Send message
socket.emit('send_message', {
  conversationId: 'conversation-uuid',
  content: 'Hello!',
  messageType: 'TEXT'
});
```

## 🌐 Production Deployment

### Recommended Setup
- **Server**: Node.js 18+ with PM2 process manager
- **Database**: PostgreSQL 14+ (Neon, AWS RDS, or similar)
- **File Storage**: AWS S3 or Cloudinary for images
- **SMS Service**: AWS SNS for reliable delivery
- **Push Notifications**: Firebase Cloud Messaging
- **Payment Processing**: Stripe for subscriptions
- **Monitoring**: Winston logging with external aggregation

### Performance Optimizations
- **Database indexing** on frequently queried fields
- **Redis caching** for session management
- **CDN integration** for static assets
- **Rate limiting** per user/IP
- **Connection pooling** for database
- **Image optimization** and compression

---

## 📞 Support & Maintenance

For technical support or feature requests:
- **Documentation**: This file and inline code comments
- **Testing**: Use provided test scripts for validation
- **Monitoring**: Check server logs and health endpoints
- **Updates**: Keep dependencies updated for security

**Last Updated**: August 13, 2025  
**API Version**: 1.0.0  
**Server Status**: ✅ Operational