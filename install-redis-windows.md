# Installing Redis on Windows

There are a few methods to get Redis working on Windows:

## Method 1: Using WSL2 (Recommended)

If you have Windows 10/11, the best approach is to use Windows Subsystem for Linux (WSL2):

1. Install WSL2 by running this command in PowerShell as Administrator:
   ```
   wsl --install
   ```

2. After rebooting, install Ubuntu from the Microsoft Store

3. In your Ubuntu terminal, install Redis:
   ```
   sudo apt update
   sudo apt install redis-server
   ```

4. Start the Redis server:
   ```
   sudo service redis-server start
   ```

5. Verify it's working:
   ```
   redis-cli ping
   ```
   You should get a response of "PONG"

## Method 2: Using Docker

If you have Docker Desktop installed:

1. Pull the Redis image:
   ```
   docker pull redis
   ```

2. Run Redis container:
   ```
   docker run --name my-redis -p 6379:6379 -d redis
   ```

3. Test the connection:
   ```
   docker exec -it my-redis redis-cli ping
   ```

## Method 3: Using Memurai (Redis for Windows)

Memurai is a Redis-compatible cache and datastore for Windows:

1. Download Memurai from https://www.memurai.com/
2. Install it following their wizard
3. Memurai runs as a Windows service on port 6379 by default

## Method 4: Using Redis as a Service

For production use, consider using a managed Redis service:

- **Upstash**: https://upstash.com/ (Has a free tier)
- **Redis Labs**: https://redis.com/ (Has a free tier)
- **Azure Cache for Redis**: https://azure.microsoft.com/en-us/services/cache/
- **Amazon ElastiCache for Redis**: https://aws.amazon.com/elasticache/redis/

## Updating your .env file

Once Redis is running, update your `.env` file with the correct connection details:

For local Redis:
```
REDIS_URL=redis://localhost:6379
```

For WSL2 Redis:
```
REDIS_URL=redis://localhost:6379
```

For Docker (if using default port mapping):
```
REDIS_URL=redis://localhost:6379
```

For Memurai:
```
REDIS_URL=redis://localhost:6379
```

For Redis service providers, use the connection string they provide, for example:
```
REDIS_URL=redis://username:password@redis-hostname:port
```

## Testing your Redis connection

Run the Redis test script to verify your connection:
```
node redis-test.js
``` 