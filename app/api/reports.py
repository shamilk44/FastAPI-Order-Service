from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.products import get_db
from app.models.order import Order
from app.models.product import Product

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary")
async def get_report_summary(
    db: AsyncSession = Depends(get_db),
):
    summary_query = select(
        func.count(Order.id).label("total_orders"),
        func.coalesce(func.sum(Order.total_price), 0).label("total_revenue"),
        func.coalesce(func.sum(Order.quantity), 0).label("total_items_sold"),
    )

    result = await db.execute(summary_query)
    summary = result.one()

    top_products_query = (
        select(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            func.sum(Order.quantity).label("quantity_sold"),
            func.sum(Order.total_price).label("revenue"),
        )
        .join(Order, Order.product_id == Product.id)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(Order.quantity).desc())
        .limit(5)
    )

    products_result = await db.execute(top_products_query)

    top_products = [
        {
            "product_id": row.product_id,
            "product_name": row.product_name,
            "quantity_sold": row.quantity_sold,
            "revenue": row.revenue,
        }
        for row in products_result
    ]

    return {
        "total_orders": summary.total_orders,
        "total_revenue": summary.total_revenue,
        "total_items_sold": summary.total_items_sold,
        "top_products": top_products,
    }