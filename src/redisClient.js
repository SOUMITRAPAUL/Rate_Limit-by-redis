// src/redisClient.js
const { createClient } = require('@redis/client');


const client = createClient({
  url: 'redis://localhost:6379'
});


client.on('error', (err) => {
  console.error('Redis Client Error', err);
});


// Function to connect to Redis
async function connectRedis() {
  await client.connect();
  console.log('Connected to Redis');
}


module.exports = {
  client,
  connectRedis
};


