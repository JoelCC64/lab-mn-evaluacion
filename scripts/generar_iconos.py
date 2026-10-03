"""Genera los íconos de la app (péndulo blanco sobre el azul del Excel del semestre).

Uso:  .venv/bin/python scripts/generar_iconos.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "icons"
AZUL = (31, 58, 95, 255)
AZUL_CLARO = (120, 170, 230, 255)
BLANCO = (255, 255, 255, 255)
N = 1024  # se dibuja grande y se reduce (bordes suaves)


def dibujar(escala_contenido=1.0, redondeado=False):
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if redondeado:
        d.rounded_rectangle([0, 0, N - 1, N - 1], radius=int(N * 0.22), fill=AZUL)
    else:
        d.rectangle([0, 0, N, N], fill=AZUL)

    c = N / 2
    s = escala_contenido
    pivote = (c - 30 * s, c - 265 * s)
    largo = 520 * s
    # Soporte
    d.rounded_rectangle([c - 230 * s, pivote[1] - 34 * s, c + 230 * s, pivote[1]], radius=int(14 * s), fill=BLANCO)
    # Arco de la oscilación (punteado)
    for k in range(-26, 27, 4):
        a = math.radians(k)
        x = pivote[0] + largo * math.sin(a)
        y = pivote[1] + largo * math.cos(a)
        r = 9 * s
        d.ellipse([x - r, y - r, x + r, y + r], fill=AZUL_CLARO)
    # Hilo y masa, desplazados 22°
    a = math.radians(22)
    masa = (pivote[0] + largo * math.sin(a), pivote[1] + largo * math.cos(a))
    d.line([pivote, masa], fill=BLANCO, width=int(22 * s))
    r = 96 * s
    d.ellipse([masa[0] - r, masa[1] - r, masa[0] + r, masa[1] + r], fill=BLANCO)
    r2 = 30 * s
    d.ellipse([pivote[0] - r2, pivote[1] - r2, pivote[0] + r2, pivote[1] + r2], fill=BLANCO)
    return img


def guardar(img, nombre, lado):
    img.resize((lado, lado), Image.LANCZOS).save(DESTINO / nombre, optimize=True)
    print("icons/" + nombre)


def main():
    DESTINO.mkdir(exist_ok=True)
    normal = dibujar(1.0)
    guardar(normal, "icono-192.png", 192)
    guardar(normal, "icono-512.png", 512)
    guardar(normal.convert("RGB"), "apple-touch-icon.png", 180)
    # Zona segura de los íconos «maskable»: el contenido cabe en el 80 % central.
    guardar(dibujar(0.78), "icono-maskable-512.png", 512)


if __name__ == "__main__":
    main()
