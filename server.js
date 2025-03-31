require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');

const { setRoutes } = require('./routes/index');

const app = express();

const LOCAL_IP = '192.168.18.5';

app.use(cors({
  origin: [
    `http://${LOCAL_IP}:19000`, // Expo dev server
    `http://${LOCAL_IP}:3000`,  // Your backend
  ], // Allow all origins (tighten this later!)
  credentials: true
}));




app.use(express.json());
app.use(express.urlencoded({ extended: true }));



//Set Routes
setRoutes(app);


//connect to database
connectDB();


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
  }).on('error', (error) => {
    console.error('Error starting server:', error);
  });