# BGG Collection API

Simple REST API for storing and retrieving BoardGameGeek collections across devices.

## Features

- Save BGG collection data with complexity ratings
- Cross-device access to saved collections  
- SQLite database for persistence
- Automatic data compression and storage
- Health check endpoint

## API Endpoints

### GET /api/collections
Returns list of all saved collections with metadata.

### GET /api/collections/:username
Returns full collection data for a specific username.

### POST /api/collections/:username
Saves or updates collection data for a username.

### DELETE /api/collections/:username
Deletes a saved collection.

### GET /api/health
Returns API health status and collection count.

## Database

Uses SQLite database stored in `/app/api/data/collections.db` within container.
Data is persisted via Docker volume mount.

## Environment Variables

- `PORT` - API server port (default: 3001)
- `NODE_ENV` - Environment mode (production/development)

## Docker Integration

The API runs alongside nginx in the same container using supervisor.
Collection data is persisted using Docker volumes for cross-device access.