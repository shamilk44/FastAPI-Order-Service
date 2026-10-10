import asyncio
from sqlalchemy import text
from app.db.session import engine

async def main():
    async with engine.begin() as connection:
        await connection.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_products_search_gin
            ON products
            USING GIN (
                to_tsvector(
                    'english',
                    name || ' ' || COALESCE(description, '')
                )
            )
        """))
    print("GIN search index created successfully.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())