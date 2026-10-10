from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    sku: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    price: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    stock_quantity: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    sku: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    price: Decimal | None = Field(
        default=None, gt=0, max_digits=12, decimal_places=2
    )
    stock_quantity: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    description: str | None
    price: Decimal
    stock_quantity: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)