FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/terminal/package.json apps/terminal/
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "serve"]
