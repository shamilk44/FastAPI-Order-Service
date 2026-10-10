from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.db.base import Base
from app.db.session import engine
from app.models import product, order
from app.api.products import router as products_router
from app.api.orders import router as orders_router
from app.api.reports import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    yield

    await engine.dispose()


app = FastAPI(
    title="Order and Inventory Service",
    description="Asynchronous API for products, orders, inventory, and reporting.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(products_router)
app.include_router(orders_router)
app.include_router(reports_router)


@app.get("/", tags=["Health"])
async def home():
    return {
        "message": "Order and Inventory Service is running!",
        "status": "success",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

        return {"status": "healthy", "database": "connected"}

    except Exception as exc:
        print(f"Database connection error: {exc}")
        return {"status": "unhealthy", "database": "disconnected"}
