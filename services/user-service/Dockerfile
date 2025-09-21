# UserService Dockerfile
FROM node:24-alpine3.21

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package.json ./
RUN npm install

# Bundle app source
COPY src/ ./src/

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "dev"]