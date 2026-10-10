from sqlalchemy.ext.asyncio import (
AsyncSession,
async_sessionmaker,
create_async_engine,
)

from app.core.config import settings

engine = create_async_engine(
settings.database_url,
echo=False,
pool_size=5,
max_overflow=10,
pool_timeout=30,
pool_recycle=1800,
pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
bind=engine,
class_=AsyncSession,
expire_on_commit=False,
)
