import argparse
import json
from html import escape
from pathlib import Path
from string import Template

HERE = Path(__file__).resolve().parent
GROUPS = {"all": "Все", "tea": "Чай", "ware": "Посуда", "accessories": "Аксессуары"}
LEGACY = {"tea", "jasmine", "hibiscus"}
HEART = """<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="{}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 5.7a5 5 0 0 0-7.1 0L12 7.1l-1.5-1.4a5 5 0 0 0-7.1 7.1L12 21l8.6-8.2a5 5 0 0 0 0-7.1Z"/></svg>"""


def rubles(value):
    return f"{value:,}".replace(",", " ") + " ₽"


def item_count(n):
    if 11 <= n % 100 <= 14:
        word = "товаров"
    elif n % 10 == 1:
        word = "товар"
    elif 2 <= n % 10 <= 4:
        word = "товара"
    else:
        word = "товаров"
    return f"{n} {word}"


def product_fields(product):
    fields = {k: escape(v) for k, v in product.items() if isinstance(v, str)}
    slug = product["id"]
    fields["detail"] = slug if slug in LEGACY else f"item-{slug}"
    fields["amount"] = rubles(product["price"])
    return fields


def category_frame(group):
    return "catalog" if group == "all" else f"catalog-{group}"


def category_tabs(active):
    buttons = []
    for group, label in GROUPS.items():
        if group == active:
            attributes = 'aria-current="true"'
        else:
            attributes = f'data-doop-on="click" data-doop-action="navigate:{category_frame(group)}"'
        buttons.append(f'<button type="button" {attributes}>{label}</button>')
    return "\n".join(buttons)


def render(output):
    output.mkdir(parents=True, exist_ok=True)
    products = json.loads((HERE / "products.json").read_text())
    templates = {p.stem: Template(p.read_text()) for p in HERE.glob("*.html")}
    catalog = Template((HERE.parent / "catalog.html").read_text())
    frames = []

    def emit(key, name, html):
        filename = key + ".html"
        (output / filename).write_text(html)
        frames.append({"id": key, "name": name, "file": filename})

    for group, label in GROUPS.items():
        title = "Каталог" if group == "all" else label
        selection = [p for p in products if group == "all" or p["group"] == group]
        tiles = []
        featured = ""
        for product in selection:
            fields = product_fields(product)
            if group == "all" and product["id"] == "tea":
                hero = templates["featured"].substitute(fields)
                featured = f'<div class="catalog-feature">{hero}</div>'
            else:
                separator = "/" if product["group"] == "tea" else "·"
                tiles.append(templates["tile"].substitute(fields, separator=separator))
        emit(category_frame(group), title, catalog.substitute(
            title=title, count=item_count(len(selection)), tabs=category_tabs(group),
            featured=featured, tiles="\n".join(tiles),
        ))

    def screen(key, title, body, active):
        tabs = {tab: "page" if active == tab else "false" for tab in ("catalog", "favorites", "cart")}
        target = ""
        if active in ("favorites", "cart"):
            prop = "favoritestarget" if active == "favorites" else "carttarget"
            target = f'{prop}="navigate:{key}"'
        html = templates["screen"].substitute(title=escape(title), content=body, target=target, **tabs)
        emit(key, title, html)

    for product in products:
        slug = product["id"]
        if slug in LEGACY:
            continue
        title = product["name"]
        fields = product_fields(product)
        unit = product["unit"]
        if unit.endswith(("мл", " л")):
            unit_label = "Объём"
        elif product["group"] == "tea":
            unit_label = "Фасовка"
        elif unit.endswith("шт.") and unit != "1 шт.":
            unit_label = "В упаковке"
        else:
            unit_label = "Количество"
        detail = templates["item"].substitute(fields, unit_label=unit_label, heart=HEART.format("none"))
        screen("item-" + slug, title, detail, "catalog")
        saved = templates["saved"].substitute(fields, heart=HEART.format("currentColor"))
        screen("saved-" + slug, "Избранное · " + title, saved, "favorites")
        for quantity, prefix in ((1, "bag"), (2, "pair")):
            decrease = "cart-empty" if quantity == 1 else "bag-" + slug
            if quantity == 1:
                increase = f'<button type="button" class="step" aria-label="Увеличить количество" data-doop-on="click" data-doop-action="navigate:pair-{slug}">+</button>'
            else:
                increase = '<button type="button" class="step limit" aria-label="Максимум две единицы" disabled>+</button>'
            bag = templates["bag"].substitute(fields, quantity=quantity, total=rubles(product["price"] * quantity),
                                              decrease=decrease, increase=increase)
            screen(f"{prefix}-{slug}", f"Корзина · {title} × {quantity}", bag, "cart")

    for key, title in (("cart-empty", "Корзина · пусто"), ("favorites-empty", "Избранное · пусто")):
        emit(key, title, (HERE.parent / (key + ".html")).read_text())
    (output / "frames.json").write_text(json.dumps(frames, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Собрать HTML-фреймы Doop из каталога ПРОЧАЙ")
    parser.add_argument("directory", type=Path)
    render(parser.parse_args().directory)
