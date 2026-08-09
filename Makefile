.PHONY: build rebuild up down run restart stop logs clean test test-ui check lint lint-fix setup db-init

# Build Docker images
build:
	docker compose build

# Rebuild Docker images and restart services
rebuild:
	$(MAKE) build
	$(MAKE) restart

# Start all services in the background
up:
	docker compose up -d

# Start services in the background and attach to logs
run:
	docker compose up -d
	docker compose logs -n 100 -f

# Restart all services
restart:
	docker compose down
	$(MAKE) run

# Stop all services
stop:
	docker compose stop

# Tear down all services
down:
	docker compose down

# Follow logs
logs:
	docker compose logs -f

# Run backend unit tests locally
test:
	PYTHONPATH=backend ./backend/venv/bin/pytest backend/tests

# Run UI tests (placeholder for future UI tests)
test-ui:
	cd frontend && npm test || echo "No UI tests configured yet."

# Clean up build artifacts and caches
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +

# Lint backend using Megalinter or standard linters
lint:
	docker run --rm \
		-v "$$(pwd):/tmp/lint" \
		-e VALIDATE_ALL_CODEBASE=true \
		-e CI=false \
		oxsecurity/megalinter:v9.4.0

# Initialize DB via script (if needed manually)
db-init:
	docker compose run --rm db-init

# Check code (tests)
check: test test-ui
