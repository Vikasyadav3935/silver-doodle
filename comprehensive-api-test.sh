#!/bin/bash

# Connect Dating App - Comprehensive API Test Suite
# Generated on: $(date)
# Server: http://localhost:3001/api

echo "🚀 Connect Dating App - API Test Suite"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3001/api"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# JWT Token (will be set after authentication)
TOKEN=""
USER_ID=""

# Function to run test
run_test() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local auth="$5"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "\n${BLUE}🧪 Testing: $test_name${NC}"
    
    # Build curl command
    local curl_cmd="curl -s -w 'HTTP_STATUS:%{http_code}' -X $method"
    
    if [ "$auth" = "true" ] && [ -n "$TOKEN" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $TOKEN'"
    fi
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    curl_cmd="$curl_cmd $BASE_URL$endpoint"
    
    # Execute test
    local response=$(eval $curl_cmd)
    local http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    # Check if test passed
    if [[ "$http_status" =~ ^(200|201)$ ]]; then
        echo -e "${GREEN}✅ PASS - Status: $http_status${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Save token from auth response
        if [[ "$endpoint" == "/auth/verify-otp" ]] && [[ "$body" == *"token"* ]]; then
            TOKEN=$(echo "$body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
            USER_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
            echo -e "${YELLOW}🔑 Token saved for subsequent tests${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL - Status: $http_status${NC}"
        echo -e "${RED}   Response: $body${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Pretty print successful responses (truncated)
    if [[ "$http_status" =~ ^(200|201)$ ]] && [ ${#body} -lt 200 ]; then
        echo -e "${YELLOW}📋 Response: $body${NC}"
    fi
    
    sleep 0.5
}

# Test System Health
echo -e "\n${BLUE}🏥 SYSTEM HEALTH TESTS${NC}"
run_test "Health Check" "GET" "/health" "" "false"

# Test Authentication
echo -e "\n${BLUE}🔐 AUTHENTICATION TESTS${NC}"
run_test "Send OTP" "POST" "/auth/send-otp" '{"phoneNumber": "+916387712911"}' "false"
echo -e "${YELLOW}⏳ Waiting for OTP... Please check your phone${NC}"
echo -e "${YELLOW}   Using OTP: 300585${NC}"
run_test "Verify OTP" "POST" "/auth/verify-otp" '{"phoneNumber": "+916387712911", "code": "300585"}' "false"
run_test "Get Current User" "GET" "/auth/me" "" "true"
run_test "Refresh Token" "POST" "/auth/refresh-token" "" "true"

# Test User Profile
echo -e "\n${BLUE}👤 USER PROFILE TESTS${NC}"
run_test "Get User Profile" "GET" "/users/profile" "" "true"
run_test "Create Profile" "POST" "/users/profile" '{
    "firstName": "John",
    "lastName": "Doe", 
    "dateOfBirth": "1990-01-01",
    "gender": "MALE",
    "bio": "Test bio for API testing",
    "occupation": "Software Engineer",
    "company": "Tech Corp",
    "education": "Computer Science",
    "height": 175,
    "interests": ["Technology", "Sports"],
    "latitude": 28.6139,
    "longitude": 77.2090
}' "true"
run_test "Update Profile" "PUT" "/users/profile" '{"bio": "Updated bio via API testing"}' "true"
run_test "Get User Settings" "GET" "/users/settings" "" "true"
run_test "Update Settings" "PUT" "/users/settings" '{"pushNotifications": true, "showAge": true}' "true"
run_test "Get User Stats" "GET" "/users/stats" "" "true"

# Test Upload Endpoints
echo -e "\n${BLUE}📸 UPLOAD TESTS${NC}"
run_test "Get Upload Stats" "GET" "/uploads/stats" "" "true"

# Test Profile Discovery
echo -e "\n${BLUE}🔍 PROFILE DISCOVERY TESTS${NC}"
run_test "Get Available Interests" "GET" "/profiles/interests/all" "" "false"
run_test "Search Profiles" "GET" "/profiles/search/profiles?minAge=18&maxAge=35&limit=5" "" "true"

if [ -n "$USER_ID" ]; then
    run_test "Get Match Preferences" "GET" "/profiles/$USER_ID/preferences" "" "true"
    run_test "Update Match Preferences" "PUT" "/profiles/$USER_ID/preferences" '{
        "minAge": 20,
        "maxAge": 35,
        "maxDistance": 50,
        "genderPreference": "ALL"
    }' "true"
fi

# Test Matching
echo -e "\n${BLUE}💕 MATCHING TESTS${NC}"
run_test "Get Discovery Profiles" "GET" "/matches/discovery?limit=5" "" "true"
run_test "Get Who Liked Me" "GET" "/matches/who-liked-me" "" "true"
run_test "Get My Matches" "GET" "/matches/matches" "" "true"

# Test Chat
echo -e "\n${BLUE}💬 CHAT TESTS${NC}"
run_test "Get Conversations" "GET" "/chats/conversations" "" "true"
run_test "Get Unread Count" "GET" "/chats/unread-count" "" "true"

# Test Payments
echo -e "\n${BLUE}💳 PAYMENT TESTS${NC}"
run_test "Get Subscription Plans" "GET" "/payments/plans" "" "false"
run_test "Get Current Subscription" "GET" "/payments/subscription" "" "true"
run_test "Get Active Boosts" "GET" "/payments/boosts" "" "true"
run_test "Check Feature Access" "GET" "/payments/features/unlimited_likes" "" "true"
run_test "Get Pricing" "GET" "/payments/pricing" "" "false"
run_test "Get Payment History" "GET" "/payments/history" "" "true"

# Test Notifications
echo -e "\n${BLUE}🔔 NOTIFICATION TESTS${NC}"
run_test "Get Notifications" "GET" "/notifications" "" "true"
run_test "Get Notification Stats" "GET" "/notifications/stats" "" "true"
run_test "Add Push Token" "POST" "/notifications/push-token" '{
    "token": "test-push-token-12345",
    "platform": "android"
}' "true"
run_test "Send Test Notification" "POST" "/notifications/test" '{
    "title": "API Test Notification",
    "message": "This is a test notification from API testing",
    "type": "SYSTEM"
}' "true"

# Test Admin (will likely fail due to restrictions)
echo -e "\n${BLUE}🛡️ ADMIN TESTS (May fail due to permissions)${NC}"
run_test "Get Platform Stats" "GET" "/admin/stats" "" "true"
run_test "Get Users List" "GET" "/admin/users?limit=5" "" "true"
run_test "Get Reports" "GET" "/admin/reports" "" "true"
run_test "Get System Metrics" "GET" "/admin/metrics" "" "true"

# Summary
echo -e "\n${'=' * 60}"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo -e "${'=' * 60}"
echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"
echo -e "${BLUE}📈 Total: $TOTAL_TESTS${NC}"

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "${YELLOW}🎯 Success Rate: $SUCCESS_RATE%${NC}"
fi

echo -e "\n${GREEN}🎉 API Testing Complete!${NC}"
echo -e "${BLUE}📄 For detailed documentation, see API_DOCUMENTATION.md${NC}"