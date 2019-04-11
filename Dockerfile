# Stage: UI
FROM node:11.9-slim as ui

# Create app directory
WORKDIR /app

# Bundle app source
COPY redtunnel-ui/ /app/

# Install packages
RUN npm install
RUN npm run build


# Stage: Core
FROM node:11.9-slim as core

# Create app directory
WORKDIR /app

# Bundle app source
COPY public/ /app/public
COPY views/ /app/views
COPY routes/ /app/routes
COPY models/ /app/models
COPY index.js config.js package.json /app/

# Copy ui
COPY --from=ui /app/dist/ /app/public/dist
COPY --from=ui /app/src/assets/favicons /app/public/dist/favicons
COPY --from=ui /app/index.html /app/views/admin.ejs

# Install packages
RUN npm install -g forever
RUN npm install

EXPOSE 3000
CMD [ "npm", "start" ]

