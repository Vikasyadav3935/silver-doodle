# Connect Dating App Backend

A comprehensive backend API for the Connect dating application built with Node.js, Express, TypeScript, PostgreSQL, and Prisma.

## Features

### Core Features
- 🔐 **Authentication**: Phone-based OTP authentication with JWT tokens
- 👤 **User Management**: Complete profile management with photos and preferences
- 💝 **Matching System**: Intelligent matching algorithm based on compatibility
- 💬 **Real-time Messaging**: Socket.IO powered chat system with typing indicators
- 📷 **Media Upload**: Cloudinary integration for photo and video uploads
- 🔔 **Notifications**: Push notifications and in-app notification system
- 💳 **Premium Features**: Stripe integration for subscriptions and in-app purchases
- 🛡️ **Safety**: User reporting, blocking, and moderation tools
- 📊 **Analytics**: Admin dashboard with comprehensive statistics

### Technical Features
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.IO for live messaging and match notifications
- **File Storage**: Cloudinary for media management
- **Payments**: Stripe for subscription and payment processing
- **SMS**: Twilio integration for OTP delivery
- **Caching**: Redis support for session management
- **Security**: Helmet, CORS, rate limiting, and input validation
- **Logging**: Winston for comprehensive logging
- **Testing**: Ready for unit and integration tests

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Redis (optional, for caching)
- Cloudinary account (for image uploads)
- Twilio account (for SMS)
- Stripe account (for payments)

### Installation

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd connect-backend
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up the database**:
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database with initial data
npm run seed
```

4. **Start the development server**:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/connect_dating_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Twilio (for SMS/OTP)
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="your-twilio-phone-number"

# Email (optional)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-email-password"

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

# Stripe (for payments)
STRIPE_SECRET_KEY="sk_test_your-stripe-secret-key"
STRIPE_WEBHOOK_SECRET="whsec_your-webhook-secret"

# Push Notifications
FCM_SERVER_KEY="your-fcm-server-key"

# CORS
ALLOWED_ORIGINS="http://localhost:19006,http://localhost:19000"
```

## API Documentation

### Authentication Endpoints

#### Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "code": "123456"
}
```

### User Management

#### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer <jwt-token>
```

#### Create Profile
```http
POST /api/users/profile
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01",
  "gender": "MALE",
  "bio": "Love hiking and photography",
  "interests": ["Photography", "Hiking", "Travel"]
}
```

### Matching System

#### Get Discovery Profiles
```http
GET /api/matches/discovery?limit=10
Authorization: Bearer <jwt-token>
```

#### Like a Profile
```http
POST /api/matches/like
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "userId": "user-uuid"
}
```

#### Super Like a Profile
```http
POST /api/matches/super-like
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "userId": "user-uuid"
}
```

### Messaging

#### Get Conversations
```http
GET /api/chats/conversations
Authorization: Bearer <jwt-token>
```

#### Send Message
```http
POST /api/chats/conversations/{conversationId}/messages
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "messageType": "TEXT",
  "content": "Hello there!"
}
```

### File Uploads

#### Upload Profile Photo
```http
POST /api/uploads/profile-photo
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

photo: <file>
isPrimary: true
```

### Real-time Events

Connect to Socket.IO at `ws://localhost:3000` with authentication token.

#### Chat Events
- `join_conversation` - Join a conversation room
- `send_message` - Send a message
- `typing_start` / `typing_stop` - Typing indicators
- `mark_messages_read` - Mark messages as read

#### Match Events
- `like_user` - Like a user
- `super_like_user` - Super like a user
- `get_discovery_profiles` - Get new profiles

## Database Schema

The application uses a comprehensive PostgreSQL schema with the following main entities:

- **Users**: Core user accounts with authentication
- **Profiles**: User profiles with personal information
- **Photos**: Profile photos with ordering and primary flags
- **Interests**: User interests for matching
- **Matches**: Mutual likes between users
- **Conversations & Messages**: Chat system
- **Likes/Passes**: User interactions
- **Subscriptions**: Premium membership management
- **Notifications**: Push and in-app notifications
- **Reports**: User safety and moderation

## Architecture

### Service Layer
- `AuthService`: Authentication and OTP management
- `UserService`: User and profile management
- `MatchService`: Matching algorithm and discovery
- `ChatService`: Messaging functionality
- `UploadService`: File upload and management
- `NotificationService`: Push and email notifications
- `SubscriptionService`: Payment and subscription handling

### Real-time Features
- Socket.IO for instant messaging
- Real-time match notifications
- Typing indicators
- Online status tracking

### Security
- JWT-based authentication
- Phone number verification via OTP
- Input validation with express-validator
- Rate limiting
- CORS protection
- Helmet security headers
- SQL injection protection via Prisma

## Deployment

### Production Setup

1. **Environment**: Set `NODE_ENV=production`
2. **Database**: Use a production PostgreSQL instance
3. **SSL**: Configure HTTPS with proper SSL certificates
4. **Process Manager**: Use PM2 or similar for process management
5. **Monitoring**: Set up logging and monitoring
6. **Backup**: Configure automated database backups

### Docker (Optional)

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and add tests
4. Commit changes: `git commit -am 'Add new feature'`
5. Push to the branch: `git push origin feature/new-feature`
6. Create a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API endpoints

---

Built with ❤️ for connecting people around the world.