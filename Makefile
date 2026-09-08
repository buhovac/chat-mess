# Run from a bash shell: macOS Terminal, or the WSL2 Ubuntu terminal on
# Windows (not PowerShell/cmd — see SETUP.md). Same commands, same results,
# on both laptops.

.PHONY: up down logs shell-api shell-client migrate seed reset

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f api client

shell-api:
	docker compose exec api sh

shell-client:
	docker compose exec client sh

migrate:
	docker compose exec api npm run prisma:migrate

# Nukes local containers + the Postgres volume. Use when the db gets into a
# state you don't want to debug — everyone's local data is disposable,
# nothing here is production.
reset:
	docker compose down -v
	docker compose up --build
