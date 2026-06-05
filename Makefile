.PHONY: help infra-up infra-down seed run-gateway run-processor run-interdiction run-bridge run-mock-bridge run-dashboard run-pipeline run-mock-pipeline kill-all

help:
	@echo "Fraud Detection Pipeline Orchestrator"
	@echo "====================================="
	@echo "Infrastructure commands:"
	@echo "  make infra-up          - Start Kafka & Redis containers (Docker)"
	@echo "  make infra-down        - Stop Kafka & Redis containers"
	@echo "  make seed              - Seed Redis baseline profile data"
	@echo ""
	@echo "Individual service commands:"
	@echo "  make run-gateway       - Start Zone 1 Ingestion REST API (Port 8080)"
	@echo "  make run-processor     - Start Zone 2 & 3 Core Rule Processing Engine"
	@echo "  make run-interdiction  - Start Zone 4 Interdiction Engine"
	@echo "  make run-bridge        - Start Live Streaming Bridge (Port 8081)"
	@echo "  make run-mock-bridge   - Start Mock WebSockets Server (Port 8081)"
	@echo "  make run-dashboard     - Start Vite/React Dashboard Frontend (Port 5173)"
	@echo ""
	@echo "Orchestration commands:"
	@echo "  make run-pipeline      - Start all real backend Go services + bridge + dashboard in parallel"
	@echo "  make run-mock-pipeline - Start Mock WebSocket server + Frontend Dashboard in parallel"
	@echo "  make kill-all          - Clean up all running Go processes on ports 8080, 8081, 5173"

infra-up:
	docker compose up -d

infra-down:
	docker compose down

seed:
	go run seed.go

run-gateway:
	go run main.go

run-processor:
	cd processor && go run .

run-interdiction:
	cd interdiction && go run .

run-bridge:
	cd dashboard-bridge && go run main.go

run-mock-bridge:
	cd dashboard-bridge && go run mock_server.go

run-dashboard:
	cd dashboard && npm run dev

# Runs the complete, real event-driven pipeline + UI in parallel
run-pipeline: infra-up
	@echo "🚀 Starting entire Live Pipeline..."
	@trap 'kill 0' SIGINT; \
	go run main.go & \
	(cd processor && go run .) & \
	(cd interdiction && go run .) & \
	(cd dashboard-bridge && go run main.go) & \
	(cd dashboard && npm run dev) & \
	wait

# Runs the mock server and the UI in parallel for easy testing
run-mock-pipeline:
	@echo "⚡ Starting Mock Server & Dashboard..."
	@trap 'kill 0' SIGINT; \
	(cd dashboard-bridge && go run mock_server.go) & \
	(cd dashboard && npm run dev) & \
	wait

# Force kills any processes listening on the project's standard ports
kill-all:
	@echo "Cleaning up local process bindings..."
	-fuser -k 8080/tcp || true
	-fuser -k 8081/tcp || true
	-fuser -k 5173/tcp || true
