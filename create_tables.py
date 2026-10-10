import asyncio

from app.db.session import engine
from app.db.base import Base
from app.models import Product


async def main():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    print("SUCCESS: Database tables created successfully!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())