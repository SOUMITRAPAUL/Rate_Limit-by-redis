const express = require('express');
const rateLimiter = require('./rateLimiter');
const { connectRedis } = require('./redisClient');
const path = require('path');


const app = express();
const port = 3000;


// Connect to Redis
connectRedis().then(() => {
  console.log('Redis connected, server is starting...');
}).catch((error) => {
  console.error('Error connecting to Redis:', error);
});


// Serve static files from the public folder
app.use(express.static(path.join(__dirname, '../public')));


// Middleware for rate limiting
app.use(rateLimiter);


// Define the endpoint that handles the request from frontend
app.get('/api/test', (req, res) => {
  res.json({ message: 'Request received and processed!' });
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
