// server.js
require('dotenv').config();
const app = require('./app');
const cors = require('cors');

app.set('trust proxy', 1);


const allowedOrigins = [
  "http://localhost:3000",            // always allow local dev
  process.env.FRONTEND_URL,           // your deployed frontend (from env)
].filter(Boolean); // removes undefined if FRONTEND_URL not set

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests without origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
