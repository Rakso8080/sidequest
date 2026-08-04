# SideQuest — single container serving the built SPA + FastAPI backend.
# Build the frontend with Node, then run everything with Python.
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --silent || npm install --silent
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS backend
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /build/dist /app/frontend/dist

ENV STATIC_DIR=/app/frontend/dist \
    UPLOAD_DIR=/app/uploads

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
