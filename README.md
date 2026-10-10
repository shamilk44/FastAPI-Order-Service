# FastAPI Order and Inventory Service

An asynchronous REST API for product management, order processing, inventory control, and reporting.

## Features

* Product CRUD operations.
* PostgreSQL full-text product search.
* Order creation and order retrieval.
* Atomic inventory updates to prevent overselling.
* Concurrent order and report processing.
* Order, revenue, and product summary reports.
* Asynchronous database access and connection pooling.
* Docker Compose setup for local development.

## Technologies

* Python 3.13
* FastAPI
* SQLAlchemy
* PostgreSQL
* asyncpg
* Pydantic
* HTTPX
* Docker and Docker Compose

## Running the Application

Make sure Docker Desktop is running.

Open PowerShell in the project directory and execute:

```powershell
docker compose up --build
```

The API will be available at:

* Swagger documentation: http://127.0.0.1:8000/docs
* Health check: http://127.0.0.1:8000/health
* OpenAPI schema: http://127.0.0.1:8000/openapi.json

To stop the containers, press Ctrl+C and execute:

```powershell
docker compose down
```

The named PostgreSQL data volume is retained when using this command.

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

### Reports

| Method | Endpoint           | Description              |
| ------ | ------------------ | ------------------------ |
| GET    | `/reports/summary` | Retrieve summary reports |
| GET    | `/health`          | Check application health |

For exact request and response details, visit `/docs`.

## Product Search

The product search endpoint uses PostgreSQL full-text search instead of SQL `LIKE` or `ILIKE` matching.

A GIN expression index named `ix_products_search_gin` supports searches on product names and descriptions.

Example:

`GET /products/search?q=keyboard&limit=10`

The search query and index must use compatible text-search expressions and configurations.

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

If the update affects no product, the order is rejected. The inventory update and order creation occur in the same transaction to prevent overselling when multiple requests arrive simultaneously.

## Database Connection Pooling

The application uses asynchronous SQLAlchemy sessions with PostgreSQL through asyncpg.

Configured connection pool settings:

* `pool_size=5`
* `max_overflow=10`
* `pool_timeout=30`
* `pool_recycle=1800`
* `pool_pre_ping=True`

These settings support connection reuse and concurrent database access. The total connection count also depends on the number of application processes and replicas.

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

**Result: PASS.** No stock overselling occurred, and all ten report requests succeeded during this test.

The response time represents one local test run and is not a production performance guarantee.

## Environment Configuration

Docker Compose configures the API to connect to PostgreSQL using the database service name.

* PostgreSQL container port: `5432`
* PostgreSQL host port: `5433`
* API port: `8000`

Keep passwords, API keys, and other secrets out of Git. Use environment variables or an untracked `.env` file for sensitive settings.

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
│   └── main.py
├── test_concurrency.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .dockerignore
├── .gitignore
└── README.md
```

## Scope

This project focuses on backend APIs, product search, inventory consistency, asynchronous database access, and concurrent request handling.

Authentication, payment processing, frontend development, and cloud deployment are outside the current scope.
