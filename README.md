# DevDrop Backend Server

This is the backend server for **DevDrop**, a secure, real-time file-sharing application built with the MERN stack (MongoDB, Express, React, Node.js) and TypeScript.

## Frontend Repository

Access the frontend application **[DevDrop Frontend](https://github.com/taniyakamboj15/devDrop-frontend)**.


## Features

-   **User Authentication**: Secure Signup, Login, and Logout using JWT and HTTP-only cookies.
-   **Real-time Communication**: Powered by `Socket.io` for instant file sharing and user status updates.
-   **File Sharing**:
    -   **Public Sharing**: Broadcast files to all connected users.
    -   **Private Sharing**: Send files securely to specific online users.
    -   **Chunked Uploads**: Supports large file uploads via chunking for reliability.
-   **Local Storage**: Files are stored locally in the `uploads/` directory with sanitized names.
-   **Security**:
    -   **Authentication**: JWT (JSON Web Tokens) with HTTP-Only cookies to prevent XSS.
    -   **Middleware**: Protected routes verify tokens via `authMiddleware.ts`.
    -   **HTTP Headers**: `Helmet` middleware sets secure headers (protects against XSS, Clickjacking, Sniffing).
    -   **Rate Limiting**: 
        -   **Auth Routes**: Strict limit (20 req/15min) on Login/Signup.
        -   **API Routes**: Relaxed limit (100 req/15min) on general endpoints.
        -   **Uploads**: Custom limit (10 uploads/min) per user.
    -   **Input Validation**: Strict Regex for emails and passwords.
    -   **Sanitization**: Filenames are sanitized (removing special chars) to prevent path traversal attacks.
-   **Scheduled Tasks**: Cron jobs to clean up old files or inactive sessions (configurable).
-   **Global Error Handling**: Centralized error middleware for consistent API responses.

## Tech Stack

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Language**: TypeScript
-   **Database**: MongoDB (via Mongoose)
-   **Real-time**: Socket.io
-   **Auth**: JSON Web Tokens (JWT), BCrypt, Cookie-Parser
-   **Utilities**: Nodemailer (Email), Node-Cron (Scheduling)

## Prerequisites

-   Node.js (v18+ recommended)
-   MongoDB (running locally or a cloud instance)

## Installation

1.  Navigate to the server directory:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## Environment Variables

Create a `.env` file in the root of the `server` directory with the following variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

## Running the Server

-   **Development Mode** (with hot reload):
    ```bash
    npm run dev
    ```
-   **Production Build**:
    ```bash
    npm run build
    npm start
    ```

## API Endpoints

### Authentication (`/api/auth`)
-   `POST /signup` - Register a new user.
-   `POST /login` - Authenticate user and set HTTP-only cookie.
-   `POST /logout` - Clear auth cookie.
-   `POST /verify-otp` - Verify email OTP.
-   `POST /resend-otp` - Resend verification OTP.
-   `POST /forgot-password` - Request password reset link.
-   `POST /reset-password/:token` - Reset password.
-   `GET /profile` - Get current user profile (Protected).
-   `PUT /profile` - Update user profile (Protected).

## Socket Events

The server listens for and emits the following socket events for real-time functionality:

-   `connection` / `disconnect`: Handle user presence.
-   `join`: Register user with `userId` to map to `socketId`.
-   `upload-start`: Initiate a file upload session.
-   `upload-chunk`: Receive file binary chunks.
-   `upload-end`: Finalize upload and notify recipients.
-   `file-shared`: Emit to recipients when a file is ready for download.
-   `online-users`: Broadcast the list of currently active users.

## Security & Implementation Details

### Protection Flow
1.  **Request Entry**: Client sends a request to a protected route (e.g., `/api/auth/profile`).
2.  **Cookie Check**: `authMiddleware.ts` extracts the `jwt` cookie.
3.  **Token Verification**:
    -   Verifies signature using `JWT_SECRET`.
    -   Decodes `userId`.
4.  **User Verification**: Fetches user from DB (excluding password).
5.  **Grant Access**: If valid, attaches `req.user` and calls `next()`. If invalid, returns `401 Unauthorized`.

### Edge Cases Handling

**Scenario: Recipient goes offline during Private File Transfer**
1.  **Upload Start**: Sender initiates upload. Server checks if Recipient is online.
2.  **Mid-Transfer Disconnect**: Recipient closes browser while file is chunking.
3.  **Completion**:
    -   Server finishes saving the file to `uploads/`.
    -   **Check**: Server attempts to find Recipient's socket ID in `onlineUsers`.
    -   **Result**: Recipient is not found. The `file-shared` event is **NOT** emitted to the offline user to prevent socket errors. The Sender still gets a success ack, but the recipient won't see it until re-login (implementation dependent) or it's simply a missed transfer in this real-time implementation.

