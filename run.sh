#!/bin/bash

# Start the backend server in the background
echo "Starting the backend server..."
node backend/server.js &

# Start the frontend server in the background
echo "Starting the frontend server..."
node frontend/dev-server.js &

# Wait for both servers to be up and running
wait
