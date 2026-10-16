"""Rapports et exportations CSV (protection anti-injection de formules)."""

import csv
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import Product, Sale
from ..permissions import IsSellerOrAdmin
from .dashboard import _parse_period

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value):
    """Évite l'injection de formules dans les fichiers CSV (Excel / LibreOffice)."""
    text = str(value) if value is not None else ""
    if text.startswith(FORMULA_PREFIXES):
        return "'" + text
    return text


@api_view(["GET"])
@permission_classes([IsSellerOrAdmin])
def reports_view(request):
    date_from, date_to, label = _parse_period(request)
    group = request.query_params.get("group", "day")  # day | week | month

    sales_qs = Sale.objects.filter(status=Sale.Status.COMPLETED)
    if date_from:
        sales_qs = sales_qs.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)

    trunc = {"day": TruncDay, "week": TruncWeek, "month": TruncMonth}.get(group, TruncDay)
    by_period = (
        sales_qs.annotate(period=trunc("created_at"))
        .values("period")
        .annotate(
            revenue=Sum("total_amount"),
            cogs=Sum("cost_amount"),
            count=Count("id"),
            items=Sum("items__quantity"),
        )
        .order_by("period")
    )
    sales_by_period = [
        {
            "period": row["period"].date().isoformat()
            if hasattr(row["period"], "date")
            else str(row["period"]),
            "revenue": str(row["revenue"] or 0),
            "cogs": str(row["cogs"] or 0),
            "gross_profit": str((row["revenue"] or 0) - (row["cogs"] or 0)),
            "sales_count": row["count"],
            "items_sold": row["items"] or 0,
        }
        for row in by_period
    ]

    # Répartition par mode de paiement
    by_payment = (
        sales_qs.values("payment_method")
        .annotate(revenue=Sum("total_amount"), count=Count("id"))
        .order_by("-revenue")
    )
    payment_breakdown = [
        {
            "payment_method": row["payment_method"],
            "label": dict(Sale.PaymentMethod.choices).get(row["payment_method"], row["payment_method"]),
            "revenue": str(row["revenue"] or 0),
            "count": row["count"],
        }
        for row in by_payment
    ]

    # Produits les plus vendus
    top_products = (
        sales_qs.values("items__product_id", "items__product_name", "items__product_sku")
        .annotate(quantity_sold=Sum("items__quantity"))
        .order_by("-quantity_sold")[:15]
    )
    top_products_list = [
        {
            "product_id": row["items__product_id"],
            "sku": row["items__product_sku"],
            "name": row["items__product_name"],
            "quantity_sold": row["quantity_sold"],
        }
        for row in top_products
    ]

    # Valeur du stock au coût d'achat
    stock_value = (
        Product.objects.filter(is_archived=False)
        .aggregate(value=Sum(F("quantity") * F("purchase_price")))["value"]
        or Decimal("0")
    )

    totals = sales_qs.aggregate(
        revenue=Sum("total_amount"), cogs=Sum("cost_amount"), count=Count("id")
    )
    revenue = totals["revenue"] or Decimal("0")
    cogs = totals["cogs"] or Decimal("0")

    return Response(
        {
            "period": {
                "label": label,
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
            },
            "group": group,
            "sales_by_period": sales_by_period,
            "payment_breakdown": payment_breakdown,
            "top_products": top_products_list,
            "stock_value_at_cost": str(stock_value),
            "totals": {
                "revenue": str(revenue),
                "cost_of_goods_sold": str(cogs),
                "gross_profit": str(revenue - cogs),
                "sales_count": totals["count"],
            },
            "currency": "FCFA",
        }
    )


@api_view(["GET"])
@permission_classes([IsSellerOrAdmin])
def reports_sales_csv(request):
    """Export CSV des ventes de la période (en-têtes + cellules assainies)."""
    date_from, date_to, label = _parse_period(request)
    sales_qs = Sale.objects.select_related("customer", "seller").prefetch_related("items")
    if date_from:
        sales_qs = sales_qs.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="ventes.csv"'
    response.write("\ufeff")  # BOM UTF-8 pour Excel

    writer = csv.writer(response)
    writer.writerow(
        ["Numéro", "Date", "Client", "Vendeur", "Paiement", "Statut",
         "Remise", "Total", "Coût", "Bénéfice brut"]
    )
    for sale in sales_qs.order_by("-created_at"):
        writer.writerow(
            [
                sanitize_csv_cell(sale.number),
                sanitize_csv_cell(timezone.localtime(sale.created_at).strftime("%Y-%m-%d %H:%M")),
                sanitize_csv_cell(sale.customer.display_name if sale.customer else ""),
                sanitize_csv_cell(sale.seller.display_name),
                sanitize_csv_cell(sale.get_payment_method_display()),
                sanitize_csv_cell(sale.get_status_display()),
                sanitize_csv_cell(sale.discount),
                sanitize_csv_cell(sale.total_amount),
                sanitize_csv_cell(sale.cost_amount),
                sanitize_csv_cell(sale.gross_profit),
            ]
        )
    return response
