from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.product import Product
from app.schemas.order import OrderCreate


class ProductNotFoundError(Exception):
    pass


class InsufficientStockError(Exception):
    pass


async def create_order(
    db: AsyncSession,
    order_data: OrderCreate,
) -> Order:
    # Read the current product price.
    result = await db.execute(
        select(Product).where(
            Product.id == order_data.product_id,
            Product.is_active.is_(True),
        )
    )
    product = result.scalar_one_or_none()

    if product is None:
        raise ProductNotFoundError("Product not found or inactive")

    # Atomically deduct stock only if enough stock remains.
    stock_update = await db.execute(
        update(Product)
        .where(
            Product.id == order_data.product_id,
            Product.is_active.is_(True),
            Product.stock_quantity >= order_data.quantity,
        )
        .values(
            stock_quantity=Product.stock_quantity - order_data.quantity
        )
        .returning(Product.id)
    )

    if stock_update.scalar_one_or_none() is None:
        await db.rollback()
        raise InsufficientStockError("Insufficient stock")

    # Store the price at the time of purchase.
    unit_price = product.price
    total_price = unit_price * order_data.quantity

    order = Order(
        product_id=product.id,
        quantity=order_data.quantity,
        unit_price=unit_price,
        total_price=total_price,
        status="confirmed",
    )

    db.add(order)

    try:
        await db.commit()
        await db.refresh(order)
    except Exception:
        await db.rollback()
        raise

    return order


async def get_order(
    db: AsyncSession,
    order_id: int,
) -> Order | None:
    result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    return result.scalar_one_or_none()
