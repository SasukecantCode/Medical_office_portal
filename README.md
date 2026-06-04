# Medical Office Portal

## Development Workflow

The development environment consists of three main components:
1. **Frontend** (Vite + React)
2. **Backend** (FastAPI)
3. **ONLYOFFICE Document Server** (Docker Container)

### Quick Start

To start all development services, run:

```bash
make start
```

This single command will:
1. Ensure the `onlyoffice` Docker container is running (starting it or creating it if necessary).
2. Start the FastAPI backend server in the background.
3. Start the Vite frontend development server in the background.

The script automatically reuses the existing `onlyoffice` container, avoiding duplicate containers and preserving your configuration.

### Stopping the Services

To stop development cleanly, simply press `Ctrl+C` in the terminal where `make start` is running.

This will automatically trigger a clean shutdown sequence:
1. Stops the Frontend development server.
2. Stops the Backend server.
3. Stops the ONLYOFFICE Docker container (`docker stop onlyoffice`).

### Manual Container Management

If you need to manually manage the ONLYOFFICE container, you can use standard Docker commands:

- Check status: `docker ps -a | grep onlyoffice`
- Start manually: `docker start onlyoffice`
- Stop manually: `docker stop onlyoffice`

### Component Documentation

For component-specific details, please refer to:
- [Backend Documentation](backend/README.md)
