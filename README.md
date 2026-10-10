# FastAPI Order and Inventory Service

An asynchronous REST API for product management, order processing, inventory control, product search, and reporting.

## Features

* Product CRUD operations.
* Fast full-text product search using Meilisearch.
* Automatic search-index synchronization when products are created, updated, or deleted.
* Order creation and order retrieval.
* Atomic inventory updates to prevent overselling.
* Concurrent order and report processing.
* Order, revenue, and product summary reports.
* Asynchronous database access and connection pooling.
* PostgreSQL as the primary database.
* Docker Compose setup for local development.

## Technologies

* Python 3.13
* FastAPI
* SQLAlchemy
* PostgreSQL
* asyncpg
* Pydantic
* HTTPX
* Meilisearch
* Docker and Docker Compose
* Vite (frontend development service)

## Running the Application

Make sure Docker Desktop is running.

Open PowerShell in the project directory and execute:

```powershell
docker compose up --build
```

Docker Compose starts the configured application services, including PostgreSQL, the FastAPI backend, Meilisearch, and the frontend service.

### Application URLs

* Swagger documentation: http://127.0.0.1:8000/docs
* Health check: http://127.0.0.1:8000/health
* OpenAPI schema: http://127.0.0.1:8000/openapi.json
* Meilisearch: http://127.0.0.1:7700
* Frontend development server: http://127.0.0.1:5173

To stop the containers, press `Ctrl+C` and execute:

```powershell
docker compose down
```

The named PostgreSQL and Meilisearch data volumes are retained when using this command. To remove the stored volume data as well, use `docker compose down -v`. This permanently deletes the data in those volumes.

## API Endpoints

### Products

| Method | Endpoint                      | Description        |
| ------ | ----------------------------- | ------------------ |
| POST   | `/products/`                  | Create a product   |
| GET    | `/products/`                  | List products      |
| GET    | `/products/{product_id}`      | Retrieve a product |
| PUT    | `/products/{product_id}`      | Update a product   |
| DELETE | `/products/{product_id}`      | Delete a product   |
| GET    | `/products/search?q=keyboard` | Search products    |

### Orders

| Method | Endpoint             | Description            |
| ------ | -------------------- | ---------------------- |
| POST   | `/orders/`           | Place an order         |
| GET    | `/orders/{order_id}` | Retrieve order details |

### Reports and Health

| Method | Endpoint           | Description                           |
| ------ | ------------------ | ------------------------------------- |
| GET    | `/reports/summary` | Retrieve summary reports              |
| GET    | `/health`          | Check application and database health |

For exact request and response details, visit `/docs`.

## Product Search

The product search endpoint uses **Meilisearch** for full-text product search instead of SQL `LIKE` or `ILIKE` queries.

Meilisearch maintains a dedicated search index containing searchable product information, including:

* Product name
* SKU
* Description

The index is configured to filter out inactive products.

### Example Request

```http
GET /products/search?q=keyboard&limit=10
```

Example URL:

http://127.0.0.1:8000/products/search?q=keyboard&limit=10

### Search Workflow

1. The client sends a search request to the FastAPI endpoint.
2. The application queries Meilisearch for matching product IDs.
3. The application retrieves the corresponding current product records from PostgreSQL.
4. The API returns the matching product information while preserving the search result order.

PostgreSQL remains the primary source of product data. Meilisearch is used to find relevant products efficiently.

### Search Index Synchronization

When a product is created or updated, the application attempts to add or update its document in Meilisearch. When a product is deleted, the application attempts to remove its document from the search index.

Synchronous Meilisearch operations are executed through `asyncio.to_thread()` to avoid blocking the asynchronous event loop.

Search-index synchronization is separate from the PostgreSQL transaction. If synchronization fails, the error is logged, but the product database operation is not automatically rolled back.

Consequently, the search index may temporarily become inconsistent with PostgreSQL.

### Search Trade-offs

**Advantages:**

* Fast full-text search.
* Relevant search results without SQL `LIKE` or `ILIKE` matching.
* Separation of database storage and search functionality.
* Search operations do not directly block the asynchronous event loop.

**Limitations:**

* Search results depend on the availability of Meilisearch.
* The search index may lag behind database changes.
* Failed synchronization does not currently have a durable automatic retry mechanism.
* Meilisearch initialization and readiness must be handled appropriately.

The API returns HTTP `503 Service Unavailable` when the search endpoint cannot complete a search because of a search-service failure.

For production use, a durable background job or transactional outbox, retry handling, monitoring, and index-rebuilding procedures would improve reliability.

## Concurrency and Inventory Safety

Order creation uses a conditional database update to decrement stock only when the product is active and sufficient stock is available.

Conceptually:

```sql
UPDATE products
SET stock_quantity = stock_quantity - :quantity
WHERE id = :product_id
  AND is_active = TRUE
  AND stock_quantity >= :quantity;
```

If the update affects no product, the order is rejected.

The inventory update and order creation occur within the same transaction. This prevents concurrent requests from successfully purchasing more units than are available, provided the transaction is handled correctly.

The database performs the stock check and decrement as one conditional operation, avoiding the unsafe pattern of reading stock into application code and decrementing it separately.

## Database Connection Pooling

The application uses asynchronous SQLAlchemy sessions with PostgreSQL through asyncpg.

Configured connection pool settings:

* `pool_size=5`
* `max_overflow=10`
* `pool_timeout=30`
* `pool_recycle=1800`
* `pool_pre_ping=True`

These settings support connection reuse and concurrent database access.

* `pool_size=5`: Maintains up to five regular pooled connections per engine.
* `max_overflow=10`: Allows up to ten additional connections beyond the regular pool.
* `pool_timeout=30`: Waits up to 30 seconds for a pooled connection before timing out.
* `pool_recycle=1800`: Recycles connections after the configured connection age.
* `pool_pre_ping=True`: Checks connections before use to help detect stale connections.

The maximum potential connection count depends on the number of application processes and replicas. Production deployments should configure connection limits according to the database capacity and expected workload.

## Concurrent Load Test

Make sure the API is running, then execute:

```powershell
python test_concurrency.py
```

The test creates a product with three units of stock and sends ten order requests and ten report requests concurrently.

### Verified Test Results

| Metric                  |        Result |
| ----------------------- | ------------: |
| Successful orders       |             3 |
| Rejected orders         |             7 |
| Other order responses   |             0 |
| Successful reports      |            10 |
| Failed reports          |             0 |
| Final stock             |             0 |
| Concurrent request time | 0.388 seconds |

**Result: PASS.** In the recorded test run, only three orders succeeded for the three available units. Seven orders were rejected, no stock overselling occurred, and all ten report requests succeeded.

The response time represents one local test run and is not a production performance guarantee. Results may vary depending on hardware, database state, and system load.

## Environment Configuration

Docker Compose configures the API to connect to PostgreSQL using the database service name and to Meilisearch using its service name.

| Service                     | Container Port | Host Port |
| --------------------------- | -------------: | --------: |
| FastAPI                     |           8000 |      8000 |
| PostgreSQL                  |           5432 |      5433 |
| Meilisearch                 |           7700 |      7700 |
| Frontend development server |           5173 |      5173 |

Inside Docker Compose, services communicate through their service names rather than `localhost`.

For example, the API connects to PostgreSQL through `db:5432` and Meilisearch through `meilisearch:7700`.

Keep passwords, API keys, and other secrets out of Git. Use environment variables or an untracked `.env` file for sensitive settings.

The current Compose configuration is intended for local development. Production deployments should use appropriate secrets management, access controls, authentication for Meilisearch where required, and secure network configuration.

## Project Structure

```text
FastAPI-Order-Service/
├── app/
│   ├── api/
│   ├── core/
│   ├── db/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   │   ├── product_service.py
│   │   └── search_service.py
│   └── main.py
├── frontend/
├── test_concurrency.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .dockerignore
├── .gitignore
└── README.md
```

## Scope

This project focuses on backend APIs, product search, inventory consistency, asynchronous database access, connection pooling, and concurrent request handling.

Authentication, payment processing, frontend development, and cloud deployment are outside the intended assessment scope. The Compose configuration may include a frontend development service, but the assessment focuses on the backend implementation.
