import asyncio
from sqlalchemy import text
from app.db.session import engine

async def main():
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
        )
        print("Database tables:", result.scalars().all())

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
