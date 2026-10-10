import os

import meilisearch

MEILISEARCH_URL = os.getenv(
    "MEILISEARCH_URL",
    "http://localhost:7700",
)

MEILISEARCH_INDEX = os.getenv(
    "MEILISEARCH_INDEX",
    "products",
)

client = meilisearch.Client(MEILISEARCH_URL)
index = client.index(MEILISEARCH_INDEX)


def product_to_document(product):
    """Convert a product into a Meilisearch document."""
    return {
        "id": product.id,
        "name": product.name,
        "sku": product.sku,
        "description": product.description or "",
        "price": float(product.price),
        "stock_quantity": product.stock_quantity,
        "is_active": product.is_active,
    }


def index_product(product):
    """Add or update one product in Meilisearch."""
    return index.add_documents(
        [product_to_document(product)],
        primary_key="id",
    )


def delete_indexed_product(product_id):
    """Remove a product from the search index."""
    return index.delete_document(product_id)


def search_products(query, limit=10):
    """Search indexed products."""
    result = index.search(
        query,
        {
            "limit": limit,
            "filter": "is_active = true",
        },
    )
    return result["hits"]
