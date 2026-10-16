"""Tableau de bord : indicateurs calculés sur données réelles."""

from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import Product, Sale
from ..permissions import IsSellerOrAdmin


def _parse_period(request):
    """Retourne (date_from, date_to, label) selon le filtre demandé."""
    today = timezone.localdate()
    period = request.query_params.get("period", "30d")

    if period == "today":
        return today, today, "Aujourd'hui"
    if period == "7d":
        return today - timedelta(days=6), today, "7 derniers jours"
    if period == "30d":
        return today - timedelta(days=29), today, "30 derniers jours"
    if period == "custom":
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        try:
            start = datetime.strptime(date_from, "%Y-%m-%d").date()
            end = datetime.strptime(date_to, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            start, end = today - timedelta(days=29), today
        if end < start:
            start, end = end, start
        return start, end, "Période personnalisée"
    # Toutes les données
    return None, None, "Tout l'historique"


@api_view(["GET"])
@permission_classes([IsSellerOrAdmin])
def dashboard_view(request):
    date_from, date_to, label = _parse_period(request)

    sales_qs = Sale.objects.filter(status=Sale.Status.COMPLETED)
    if date_from:
        sales_qs = sales_qs.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)

    agg = sales_qs.aggregate(
        revenue=Sum("total_amount"),
        cogs=Sum("cost_amount"),
        sales_count=Count("id"),
    )
    revenue = agg["revenue"] or Decimal("0")
    cogs = agg["cogs"] or Decimal("0")

    # Évolution quotidienne
    by_day = (
        sales_qs.annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(revenue=Sum("total_amount"), count=Count("id"))
        .order_by("day")
    )
    sales_over_time = [
        {"date": row["day"].isoformat(), "revenue": str(row["revenue"] or 0), "count": row["count"]}
        for row in by_day
    ]

    # Produits les plus vendus (sur la période)
    top_products = (
        sales_qs.values("items__product_id", "items__product_name")
        .annotate(quantity_sold=Sum("items__quantity"))
        .order_by("-quantity_sold")[:10]
    )
    # Revenu exact par produit (prix unitaire × quantité)
    top_ids = [row["items__product_id"] for row in top_products if row["items__product_id"]]
    revenue_by_product = {}
    if top_ids:
        from ..models import SaleItem

        rows = (
            SaleItem.objects.filter(sale__in=sales_qs, product_id__in=top_ids)
            .values("product_id")
            .annotate(revenue=Sum(F("unit_price") * F("quantity")))
        )
        revenue_by_product = {r["product_id"]: r["revenue"] for r in rows}

    top_products_list = [
        {
            "product_id": row["items__product_id"],
            "name": row["items__product_name"] or "Produit supprimé",
            "quantity_sold": row["quantity_sold"],
            "revenue": str(revenue_by_product.get(row["items__product_id"]) or 0),
        }
        for row in top_products
    ]

    # Dernières ventes
    recent_sales = [
        {
            "id": s.id,
            "number": s.number,
            "customer": s.customer.display_name if s.customer else None,
            "seller": s.seller.display_name,
            "total_amount": str(s.total_amount),
            "payment_method": s.get_payment_method_display(),
            "created_at": s.created_at.isoformat(),
        }
        for s in Sale.objects.select_related("customer", "seller")
        .order_by("-created_at")[:8]
    ]

    # Stock
    active_products = Product.objects.filter(is_archived=False)
    in_stock_count = active_products.filter(quantity__gt=0).count()
    low_stock = active_products.filter(quantity__gt=0, quantity__lte=F("low_stock_threshold"))
    out_of_stock_count = active_products.filter(quantity=0).count()
    stock_value = active_products.aggregate(
        value=Sum(F("quantity") * F("purchase_price"))
    )["value"] or Decimal("0")

    low_stock_alerts = [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "quantity": p.quantity,
            "low_stock_threshold": p.low_stock_threshold,
        }
        for p in low_stock.order_by("quantity")[:15]
    ]

    return Response(
        {
            "period": {
                "label": label,
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
            },
            "revenue": str(revenue),
            "sales_count": agg["sales_count"],
            "cost_of_goods_sold": str(cogs),
            "gross_profit": str(revenue - cogs),
            "currency": "FCFA",
            "products_in_stock": in_stock_count,
            "low_stock_count": low_stock.count(),
            "out_of_stock_count": out_of_stock_count,
            "stock_value_at_cost": str(stock_value),
            "sales_over_time": sales_over_time,
            "top_products": top_products_list,
            "recent_sales": recent_sales,
            "low_stock_alerts": low_stock_alerts,
        }
    )
