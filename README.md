# CMS Demo

A simple CMS-powered website built with Node.js and Express.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up Redis (optional, but recommended for production):
   - Install Redis locally: [Redis Installation Guide](https://redis.io/docs/getting-started/)
   - Or use a Redis cloud service like Redis Labs, Upstash, or AWS ElastiCache
   - For Windows users, see [install-redis-windows.md](install-redis-windows.md)

4. Create a `.env` file in the root directory with the following content:
   ```
   # Admin credentials
   ADMIN_PASSWORD=your_secure_password
   
   # Session secret
   SESSION_SECRET=your_secure_random_string
   
   # Server configuration
   PORT=3001
   
   # Redis configuration
   REDIS_URL=redis://localhost:6379
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your_redis_password_if_any
   REDIS_USERNAME=your_redis_username_if_any
   
   # Toggle session store (true = Redis, false = Memory)
   USE_REDIS_STORE=true
   ```
   
   Be sure to replace the default password with a secure one and generate a random session secret.

5. Start the server:
   ```
   npm start
   ```

6. Access the site at http://localhost:3001

## Session Store Management

The application supports both Redis and in-memory session stores. For development, you can easily switch between them:

```
# To use Redis (if available)
node manage-session-store.js redis

# To use in-memory session store
node manage-session-store.js memory
```

Run without arguments to see the current configuration:
```
node manage-session-store.js
```

## Environment Variables

- `ADMIN_PASSWORD`: Password for admin login
- `SESSION_SECRET`: Secret key for session encryption
- `PORT`: Port number for the server (defaults to 3001)
- `REDIS_URL`: Full Redis connection URL
- `REDIS_HOST`: Redis host (used if REDIS_URL is not provided)
- `REDIS_PORT`: Redis port (used if REDIS_URL is not provided)
- `REDIS_PASSWORD`: Redis password (if authentication is required)
- `REDIS_USERNAME`: Redis username (if authentication is required)
- `USE_REDIS_STORE`: Whether to use Redis for session storage ("true" or "false")

## Redis Session Store

The application uses Redis for session storage, which provides several benefits:
- Better performance and scalability for production environments
- Persistence of sessions across server restarts
- Ability to handle multiple server instances (horizontal scaling)

If Redis is not available or disabled, the application will automatically use the default in-memory session store.

## Login

To access the admin area, navigate to `/login` and enter your admin password. 