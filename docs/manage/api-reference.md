# Manage the Spire - Complete API Reference

## Base URL
```
http://localhost:5000/api/v1/manage
```

## Authentication
All endpoints (except `/health`) require:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## Endpoints

### ✅ Health Check
```http
GET /health
```
**Response**: 200 OK
```json
{
    "status": "healthy",
    "service": "Manage the Spire"
}
```

---

## Business Endpoints

### Create Business
```http
POST /businesses
```
**Request**:
```json
{
    "name": "Acme Corporation",
    "industry": "Retail",
    "owner_user_id": 1,
    "subscription_tier": "free"
}
```
**Response**: 201 Created
```json
{
    "id": 1,
    "name": "Acme Corporation",
    "industry": "Retail",
    "owner_user_id": 1,
    "subscription_tier": "free",
    "created_at": "2024-02-15T10:30:00Z"
}
```

### Get Business
```http
GET /businesses/{business_id}
```
**Response**: 200 OK
```json
{
    "id": 1,
    "name": "Acme Corporation",
    "industry": "Retail",
    "owner_user_id": 1,
    "subscription_tier": "free",
    "created_at": "2024-02-15T10:30:00Z"
}
```

### Get Businesses by Owner
```http
GET /businesses/owner/{owner_user_id}
```
**Response**: 200 OK
```json
[
    {
        "id": 1,
        "name": "Acme Corporation",
        ...
    }
]
```

### Get Dashboard Stats
```http
GET /businesses/{business_id}/dashboard
```
**Response**: 200 OK
```json
{
    "total_employees": 12,
    "today_shifts": 8,
    "this_week_shifts": 52,
    "pending_time_off": 3,
    "pending_warnings": 1,
    "commendations_this_month": 5
}
```

---

## Employee Endpoints

### Create Employee
```http
POST /employees
```
**Request**:
```json
{
    "business_id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@acme.com",
    "role_name": "employee",
    "hire_date": "2024-01-15",
    "hourly_wage": 15.50,
    "pto_balance_hours": 80
}
```
**Response**: 201 Created
```json
{
    "id": 5,
    "business_id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@acme.com",
    "role_name": "employee",
    "hire_date": "2024-01-15",
    "hourly_wage": 15.50,
    "pto_balance_hours": 80,
    "created_at": "2024-02-15T11:00:00Z"
}
```

### Get Employees (by Business)
```http
GET /businesses/{business_id}/employees
```
**Response**: 200 OK
```json
[
    {
        "id": 5,
        "first_name": "John",
        "last_name": "Doe",
        ...
    },
    {
        "id": 6,
        "first_name": "Jane",
        "last_name": "Smith",
        ...
    }
]
```

### Get Employee by ID
```http
GET /employees/{employee_id}
```
**Response**: 200 OK
```json
{
    "id": 5,
    "business_id": 1,
    "first_name": "John",
    ...
}
```

### Update Employee
```http
PUT /employees/{employee_id}
```
**Request** (partial):
```json
{
    "hourly_wage": 17.50,
    "role_name": "supervisor"
}
```
**Response**: 200 OK
```json
{
    "id": 5,
    "hourly_wage": 17.50,
    "role_name": "supervisor",
    ...
}
```

---

## Shift Endpoints

### Create Shift
```http
POST /shifts
Content-Type: application/json
Authorization: Bearer <token>
```
**Request**:
```json
{
    "business_id": 1,
    "employee_id": 5,
    "shift_date": "2024-02-15",
    "start_time": "09:00:00",
    "end_time": "17:00:00",
    "shift_type": "regular"
}
```
**Response**: 201 Created
```json
{
    "id": 123,
    "business_id": 1,
    "employee_id": 5,
    "employee_name": "John Doe",
    "shift_date": "2024-02-15",
    "start_time": "09:00:00",
    "end_time": "17:00:00",
    "shift_type": "regular",
    "hours": 8.0,
    "created_at": "2024-02-15T11:15:00Z"
}
```
**Real-Time**: Broadcasts `shift_created` to all connected clients

### Get Business Shifts
```http
GET /businesses/{business_id}/shifts?start_date=2024-02-01&end_date=2024-02-29
```
**Query Parameters**:
- `start_date` (required): Date in YYYY-MM-DD format
- `end_date` (required): Date in YYYY-MM-DD format

**Response**: 200 OK
```json
[
    {
        "id": 123,
        "employee_name": "John Doe",
        "shift_date": "2024-02-15",
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        ...
    }
]
```

### Get Employee Shifts
```http
GET /employees/{employee_id}/shifts?start_date=2024-02-01&end_date=2024-02-15
```
**Response**: 200 OK
```json
[
    {
        "id": 123,
        "employee_name": "John Doe",
        "shift_date": "2024-02-15",
        ...
    }
]
```

### Query Shifts (Filtered)
```http
GET /shifts?business_id=1&start_date=2024-02-01&end_date=2024-02-29
```
**Query Parameters**:
- `business_id` (required): Business ID
- `start_date` (optional): Defaults to today
- `end_date` (optional): Defaults to 7 days from start_date

**Response**: 200 OK
```json
[...]
```

### Update Shift
```http
PUT /shifts/{shift_id}
```
**Request** (partial):
```json
{
    "start_time": "08:00:00",
    "end_time": "16:00:00",
    "shift_type": "overtime"
}
```
**Response**: 200 OK
```json
{
    "id": 123,
    "start_time": "08:00:00",
    "end_time": "16:00:00",
    "shift_type": "overtime",
    ...
}
```
**Real-Time**: Broadcasts `shift_updated` to all connected clients

### Delete Shift
```http
DELETE /shifts/{shift_id}
```
**Response**: 204 No Content
**Real-Time**: Broadcasts `shift_deleted` to all connected clients

---

## Time-Off Endpoints

### Create Time-Off Request
```http
POST /time-off
```
**Request**:
```json
{
    "business_id": 1,
    "employee_id": 5,
    "request_type": "pto",
    "start_date": "2024-02-20",
    "end_date": "2024-02-22",
    "total_hours": 24,
    "reason": "Family vacation"
}
```
**Response**: 201 Created
```json
{
    "id": 42,
    "employee_id": 5,
    "employee_name": "John Doe",
    "request_type": "pto",
    "start_date": "2024-02-20",
    "end_date": "2024-02-22",
    "total_hours": 24,
    "status": "pending",
    "reason": "Family vacation",
    "created_at": "2024-02-15T11:30:00Z"
}
```
**Real-Time**: Broadcasts `time_off_requested` to all connected clients

### Get Pending Time-Off Requests (by Business)
```http
GET /businesses/{business_id}/time-off/pending
```
**Response**: 200 OK
```json
[
    {
        "id": 42,
        "employee_name": "John Doe",
        "request_type": "pto",
        "start_date": "2024-02-20",
        "status": "pending",
        ...
    }
]
```

### Get Employee Time-Off Requests
```http
GET /employees/{employee_id}/time-off
```
**Response**: 200 OK
```json
[
    {
        "id": 42,
        "request_type": "pto",
        "status": "pending",
        ...
    }
]
```

### Review Time-Off Request
```http
PUT /time-off/{request_id}
```
**Request**:
```json
{
    "status": "approved",
    "review_notes": "Approved per company policy"
}
```
**Response**: 200 OK
```json
{
    "id": 42,
    "employee_name": "John Doe",
    "status": "approved",
    "review_notes": "Approved per company policy",
    "reviewed_at": "2024-02-15T12:00:00Z"
}
```
**Real-Time**: Broadcasts `time_off_reviewed` to all connected clients

---

## Warning Endpoints

### Create Warning
```http
POST /warnings
```
**Request**:
```json
{
    "employee_id": 5,
    "issued_by": 1,
    "business_id": 1,
    "severity": "verbal",
    "reason": "Tardiness",
    "description": "Employee was 15 minutes late"
}
```
**Response**: 201 Created
```json
{
    "id": 1,
    "employee_id": 5,
    "severity": "verbal",
    "reason": "Tardiness",
    "created_at": "2024-02-15T12:15:00Z"
}
```

---

## Commendation Endpoints

### Create Commendation
```http
POST /commendations
```
**Request**:
```json
{
    "employee_id": 5,
    "issued_by": 1,
    "business_id": 1,
    "reason": "Outstanding Performance",
    "description": "Excellent customer service"
}
```
**Response**: 201 Created
```json
{
    "id": 1,
    "employee_id": 5,
    "reason": "Outstanding Performance",
    "created_at": "2024-02-15T12:20:00Z"
}
```

---

## WebSocket Endpoint

### Connect to Real-Time Updates
```
WebSocket ws://localhost:5000/api/v1/manage/ws/{business_id}/{user_id}
```

**Connection Example**:
```javascript
const ws = new WebSocket(
    `ws://localhost:5000/api/v1/manage/ws/${businessId}/${userId}`
);

ws.onopen = () => {
    console.log('Connected to real-time updates');
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log(`Event: ${message.type}`, message.data);
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from real-time updates');
};
```

**Message Types Received**:

#### Shift Created
```json
{
    "type": "shift_created",
    "data": {
        "id": 123,
        "employee_name": "John Doe",
        "shift_date": "2024-02-15",
        "start_time": "09:00:00",
        "end_time": "17:00:00"
    }
}
```

#### Shift Updated
```json
{
    "type": "shift_updated",
    "data": {
        "id": 123,
        "employee_name": "John Doe",
        "shift_date": "2024-02-15",
        "start_time": "08:00:00",
        "end_time": "16:00:00"
    }
}
```

#### Shift Deleted
```json
{
    "type": "shift_deleted",
    "data": {
        "shift_id": 123,
        "employee_name": "John Doe"
    }
}
```

#### Time-Off Requested
```json
{
    "type": "time_off_requested",
    "data": {
        "id": 42,
        "employee_name": "John Doe",
        "request_type": "pto",
        "start_date": "2024-02-20",
        "end_date": "2024-02-22"
    }
}
```

#### Time-Off Reviewed
```json
{
    "type": "time_off_reviewed",
    "data": {
        "approved": true,
        "employee_name": "John Doe",
        "status": "approved"
    }
}
```

#### Employee Joined
```json
{
    "type": "employee_joined",
    "data": {
        "id": 5,
        "first_name": "John",
        "last_name": "Doe",
        "role_name": "employee"
    }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
    "detail": "business_id is required"
}
```

### 401 Unauthorized
```json
{
    "detail": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
    "detail": "Employee does not belong to this business"
}
```

### 404 Not Found
```json
{
    "detail": "Business 999 not found"
}
```

### 500 Internal Server Error
```json
{
    "detail": "Failed to create shift"
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created |
| 204 | No Content - Success, no body |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - No permission |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Internal issue |

---

## Rate Limiting

Currently no rate limiting. In production, recommended:
- 100 requests per minute for authenticated users
- 10 requests per minute for public endpoints

---

## Pagination

Currently no pagination. For large datasets, consider:
- `?limit=50&offset=0` for list endpoints
- `?page=1&per_page=50` as alternative

---

## Versioning

Current API Version: **v1** (`/api/v1/manage`)

---

## CORS

CORS is enabled for development. In production, restrict to:
```
frontend.yourdomain.com
yourdomain.com
```

---

## OpenAPI Documentation

View interactive API docs at:
```
http://localhost:5000/docs
```

(Provided by FastAPI's built-in Swagger UI)

---

## cURL Examples

### Login
```bash
curl -X POST http://localhost:5000/api/v1/quiz/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass"
  }'
```

### Create Business
```bash
curl -X POST http://localhost:5000/api/v1/manage/businesses \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "industry": "Retail",
    "owner_user_id": 1,
    "subscription_tier": "free"
  }'
```

### Create Shift
```bash
curl -X POST http://localhost:5000/api/v1/manage/shifts \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": 1,
    "employee_id": 5,
    "shift_date": "2024-02-15",
    "start_time": "09:00:00",
    "end_time": "17:00:00",
    "shift_type": "regular"
  }'
```

### Update Shift
```bash
curl -X PUT http://localhost:5000/api/v1/manage/shifts/123 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "08:00:00"
  }'
```

### Delete Shift
```bash
curl -X DELETE http://localhost:5000/api/v1/manage/shifts/123 \
  -H "Authorization: Bearer <TOKEN>"
```

---

**Last Updated**: 2024-02-15
**API Version**: v1
**Status**: Production Ready ✅
