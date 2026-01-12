# DevDrop Backend Server

This is the backend server for **DevDrop**, a secure, real-time file-sharing application built with the MERN stack (MongoDB, Express, React, Node.js) and TypeScript.

## Frontend Repository

Access the frontend application **[DevDrop Frontend](https://github.com/taniyakamboj15/devDrop-frontend)**.


## Features

-   **User Authentication**: Secure Signup, Login, and Logout using JWT and HTTP-only cookies.
-   **Real-time Communication**: Powered by `Socket.io` for instant file sharing and user status updates.
-   **File Sharing**:
    -   **Public Sharing**: Broadcast files to all connected users.
    -   **Private Sharing**: Send files securely to specific users.
    -   **Offline Delivery**: **[NEW]** Files sent to offline users are queued and instantly delivered when they log in.
    -   **Chunked Uploads**: Supports large file uploads via chunking for reliability.
-   **User Search**: **[NEW]** Search for any registered user by name or email to send files, regardless of their online status.
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
-   **Real-time**: Socket.io (with Room-based targeting)
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
-   `GET /search` - **[NEW]** Search users by name or email.

## Socket Events

The server listens for and emits the following socket events for real-time functionality. Now utilizes **Socket Rooms** (room name = `userId`) for reliable multi-tab support.

-   `connection` / `disconnect`: Handle user presence.
-   `join`: Register user and join them to their personal room (`socket.join(userId)`).
-   `upload-start`: Initiate a file upload session.
-   `upload-chunk`: Receive file binary chunks.
-   `upload-end`: Finalize upload and notify recipients.
-   `file-shared`: Emit to recipient's room when a file is ready. Contains `isOffline` flag if delivered asynchronously.
-   `file-delivered`: **[NEW]** Emitted to the Sender's room when an offline recipient comes online and successfully receives a pending file. 
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
1.  **Upload Start**: Sender initiates upload.
2.  **Mid-Transfer / Offline**: If the Recipient is offline, the file is saved to disk and a `FileTransfer` record is created with status `pending`.
3.  **Completion**:
    -   **Sender Feedback**: Sender sees "Private to [Name] (Queued)".
    -   **Recipient Login**: When the recipient logs in next, the `join` event triggers a check for pending files.
    -   **Delivery**: Pending files are delivered immediately with an `isOffline: true` flag (provoking a specific toast).
    -   **Receipt**: The Sender (if online) receives a `file-delivered` event, updating their UI status to "Delivered".

