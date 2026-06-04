.PHONY: start backend frontend install seed-master

start:
	@echo "Starting development environment (Backend, Frontend, ONLYOFFICE)..."
	@bash scripts/start_dev.sh

backend:
	@echo "Starting backend server..."
	bash -c "source .venv/bin/activate && cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

frontend:
	@echo "Starting frontend dev server..."
	cd frontend && npm run dev

install:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Installing backend dependencies..."
	python3 -m venv .venv
	bash -c "source .venv/bin/activate && pip install -r backend/requirements.txt"
	@if [ ! -f backend/.env ]; then \
		echo "Creating .env from example..."; \
		cp backend/.env.example backend/.env; \
	fi

seed-master:
	bash -c "source .venv/bin/activate && cd backend && python seed_master.py"
