from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


async def create_product(
    db: AsyncSession,
    product_data: ProductCreate,
) -> Product:
    product = Product(**product_data.model_dump())

    db.add(product)
    await db.commit()
    await db.refresh(product)

    return product


async def get_products(db: AsyncSession) -> list[Product]:
    result = await db.execute(
        select(Product).order_by(Product.id)
    )
    return list(result.scalars().all())


async def get_product(
    db: AsyncSession,
    product_id: int,
) -> Product | None:
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    return result.scalar_one_or_none()


async def update_product(
    db: AsyncSession,
    product: Product,
    product_data: ProductUpdate,
) -> Product:
    update_data = product_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)

    return product


async def delete_product(
    db: AsyncSession,
    product: Product,
) -> None:
    await db.delete(product)
    await db.commit()