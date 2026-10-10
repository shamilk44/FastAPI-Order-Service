from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.services import product_service, search_service

router = APIRouter(prefix="/products", tags=["Products"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
):
    return await product_service.create_product(db, product_data)


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    db: AsyncSession = Depends(get_db),
):
    return await product_service.get_products(db)


@router.get("/search", response_model=list[ProductResponse])
async def search_products(
    q: str = Query(..., min_length=1, description="Product search keywords"),
    limit: int = Query(10, ge=1, le=100),
):
    try:
        hits = await __import__("asyncio").to_thread(
            search_service.search_products,
            q,
            limit,
        )
        product_ids = [int(hit["id"]) for hit in hits]

        if not product_ids:
            return []

        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Product).where(
                    Product.id.in_(product_ids),
                    Product.is_active.is_(True),
                )
            )
            products = result.scalars().all()
            products_by_id = {product.id: product for product in products}

            return [
                products_by_id[product_id]
                for product_id in product_ids
                if product_id in products_by_id
            ]

    except Exception as exc:
        print(f"Meilisearch search failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Product search is temporarily unavailable",
        ) from exc


@router.get("/{product_id}", response_model=ProductResponse)
async def retrieve_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
):
    product = await product_service.get_product(db, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def edit_product(
    product_id: int,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    product = await product_service.get_product(db, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return await product_service.update_product(db, product, product_data)


@router.delete("/{product_id}")
async def remove_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
):
    product = await product_service.get_product(db, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    await product_service.delete_product(db, product)

    return {"message": "Product deleted successfully"}
