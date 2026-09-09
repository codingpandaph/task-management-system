# Prototype deployment

The Docker path demonstrates reproducible builds and service health without claiming a production platform.

1. Install Docker with Compose.
2. Replace the example database password and JWT secret in `docker-compose.prototype.yml` for any shared environment.
3. Run `yarn prototype:up`.
4. Open `http://localhost:3000`; check `http://localhost:3000/health` through the API directly at port 3001 inside the
   Compose network, or inspect the API health status with `docker compose ps`.
5. Run the guarded demo seed inside the API container only when fictional data is wanted.
6. Stop with `yarn prototype:down`. Add `--volumes` manually only when intentionally discarding prototype data.

The images use pinned Node and PostgreSQL versions, immutable dependency installation, Prisma migrations before API
startup, non-root runtime users, and readiness-based dependency ordering. A real deployment must terminate HTTPS,
inject rotated secrets from its platform, restrict database networking, persist logs, scan images, and provide rollback.
