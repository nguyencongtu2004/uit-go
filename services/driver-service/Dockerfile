# DriverService Dockerfile
FROM node:24-alpine3.21

# Create app directory
WORKDIR /app

# Copy package.json from driver-service and common
COPY services/driver-service/package.json ./
COPY common/package.json ./common/
RUN npm install

# Install common dependencies
WORKDIR /app/common
RUN npm install

# Back to app directory
WORKDIR /app

# Copy common shared libraries
COPY common/ ./common/

# Bundle app source
COPY services/driver-service/src/ ./src/

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "dev"]