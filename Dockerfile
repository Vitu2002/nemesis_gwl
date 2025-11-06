# Node image
FROM node:22-alpine

# Install dependencies to install Bun
RUN apk add --no-cache curl git bash ca-certificates

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

# Add bun to PATH
ENV PATH="/root/.bun/bin:$PATH"

# Create app directory
WORKDIR /app

# Install app dependencies (use frozen lockfile for reproducibility)
COPY package.json package-lock.json* bun.lockb* ./
RUN bun install --frozen-lockfiles

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Run app
CMD ["bun", "run", "start"]