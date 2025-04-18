# CMS Demo

A simple CMS-powered website built with Node.js and Express.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following content:
   ```
   # Admin credentials
   ADMIN_PASSWORD=your_secure_password
   
   # Session secret
   SESSION_SECRET=your_secure_random_string
   
   # Server configuration
   PORT=3001
   ```
   
   Be sure to replace the default password with a secure one and generate a random session secret.

4. Start the server:
   ```
   npm start
   ```

5. Access the site at http://localhost:3001

## Environment Variables

- `ADMIN_PASSWORD`: Password for admin login
- `SESSION_SECRET`: Secret key for session encryption
- `PORT`: Port number for the server (defaults to 3001)

## Login

To access the admin area, navigate to `/login` and enter your admin password. 