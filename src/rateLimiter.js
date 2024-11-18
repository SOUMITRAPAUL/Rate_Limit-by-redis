const { client } = require('./redisClient');


const TOKEN_CAPACITY = 5;       
const REFILL_INTERVAL = 1000;   


async function rateLimiter(req, res, next) {
  const userIP = req.ip;  
  const currentTime = Date.now();  


  try {
    
    const refillInterval = REFILL_INTERVAL.toString(); 
    const tokenCapacity = TOKEN_CAPACITY.toString();    
    const currentTimeString = currentTime.toString();   


    
    const luaScript = `
      local userKey = KEYS[1]
      local currentTime = tonumber(ARGV[1])
      local refillInterval = tonumber(ARGV[2])
      local tokenCapacity = tonumber(ARGV[3])


      -- Ensure the key is a hash; delete if it exists as a different type
      if redis.call("TYPE", userKey).ok ~= "hash" and redis.call("EXISTS", userKey) == 1 then
        redis.call("DEL", userKey)
      end


      -- Get current token data
      local tokens = redis.call('HGET', userKey, 'tokens')
      local lastRefill = redis.call('HGET', userKey, 'lastRefill')


      -- Initialize tokens and lastRefill if they don't exist
      if not tokens then
          tokens = tokenCapacity
      else
          tokens = tonumber(tokens)
      end


      if not lastRefill then
          lastRefill = currentTime
      else
          lastRefill = tonumber(lastRefill)
      end


      -- Calculate elapsed time and tokens to add
      local elapsedTime = currentTime - lastRefill
      local tokensToAdd = math.floor(elapsedTime / refillInterval)
      local updatedTokens = math.min(tokens + tokensToAdd, tokenCapacity)


      -- Update last refill time
      redis.call('HSET', userKey, 'lastRefill', currentTime)


      -- Check if there are enough tokens
      if updatedTokens > 0 then
          redis.call('HSET', userKey, 'tokens', updatedTokens - 1)  -- Use a token
          return {1, tostring(updatedTokens - 1)}  -- Return success and remaining tokens as string
      else
          local retryAfter = tostring((refillInterval - (elapsedTime % refillInterval)) / 1000)  -- Retry time in seconds as string
          return {0, retryAfter}  -- Indicate rate limit exceeded and retry time
      end
    `;


    // Execute Lua script on Redis, passing keys and arguments as strings
    const result = await client.eval(luaScript, {
      keys: [userIP],
      arguments: [currentTimeString, refillInterval, tokenCapacity]
    });
   
    const [success, remainingTokensOrRetryTime] = result;

    if (success === 0) {
      // Rate limit exceeded, send retry time
      const retryAfter = remainingTokensOrRetryTime;
      console.log(`Rate limit exceeded for IP: ${userIP}. Retry after ${retryAfter} seconds`);
      res.setHeader('X-Ratelimit-Limit', TOKEN_CAPACITY);
      res.setHeader('X-Ratelimit-Remaining', 0);
      res.setHeader('X-Ratelimit-Retry-After', retryAfter);
      res.status(429).json({
        message: 'Too many requests. Please wait before trying again.',
        retry_after: retryAfter
      });
    } else {
      // Tokens available, proceed with the request
      const remainingTokens = remainingTokensOrRetryTime;
      console.log(`IP: ${userIP} - Tokens remaining: ${remainingTokens}`);
      res.setHeader('X-Ratelimit-Limit', TOKEN_CAPACITY);
      res.setHeader('X-Ratelimit-Remaining', remainingTokens);
      res.setHeader('X-Ratelimit-Retry-After', 0);
      next(); // Proceed with the request
    }
  } catch (error) {
    console.error('Rate limiting error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = rateLimiter;


