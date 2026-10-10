import asyncio
from sqlalchemy import text
from app.db.session import engine

async def main():
try:
async with engine.connect() as connection:
result = await connection.execute(
text("""
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name
""")
)

```
        tables = result.scalars().all()

        print("\nTables found in PostgreSQL:")

        if tables:
            for table in tables:
                print(f"- {table}")
        else:
            print("No application tables found.")

except Exception as error:
    print(f"Database check failed: {error}")

finally:
    await engine.dispose()
```

if **name** == "**main**":
asyncio.run(main())
