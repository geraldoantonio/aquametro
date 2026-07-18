PORT ?= 8000

.PHONY: dev

dev: ## Servir o projeto localmente em http://localhost:$(PORT)
	@echo "Servindo em http://localhost:$(PORT)"
	@python3 -m http.server $(PORT) --directory src
