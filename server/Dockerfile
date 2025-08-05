# Start from your chosen base Node.js image
FROM node:18-slim 

# Install ffmpeg and any other necessary packages
# Use 'apt-get update' and 'apt-get install -y'
# Combine commands with '&& \' for smaller image layers
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/* # Clean up apt cache to keep image small

# Set your working directory inside the container
WORKDIR /app

# Copy your application files (make sure to copy package.json first for better caching)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build your TypeScript code (if your npm run dev command does this)
RUN npm run build # Or tsc, whatever your build command is for production

# Expose the port your server listens on
EXPOSE 4001

# Command to run your application when the container starts
CMD ["node", "dist/index.js"] 