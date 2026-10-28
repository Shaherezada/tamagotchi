# -*- coding: utf-8 -*-
"""Диаграммы проектирования курсовой: компоненты, базы данных, классы, последовательности.

Образец – «Проектирование КП.drawio» из лекций (Lectures-Backend-II): компоненты UML со
стереотипами технологий и подписями протоколов, таблицы по базам с колонкой ключей и полем
«имя (ТИП)», классы каждого сервиса с полями, методами и связями.

Два файла. «Проектирование.drawio» – для записки: компоненты, базы, по листу классов на сервис
(основные классы полностью, остальные именем) и две диаграммы последовательности.
«Классы подробно.drawio» – все классы с полями и методами, по ним пишется код.

Оформление по Каневу: только элементы UML и ER из палитры draw.io, белый фон, чёрные линии,
у колонок типы с длиной и N у допускающих NULL. Размер под лист А4 с полями ГОСТ 7.32
(левое 30 мм, правое 15 мм): ширина 623 px = 16,5 см, высота не больше 900 px, чтобы рисунок
с подписью помещался на страницу. Arial 17 px на листе как Times New Roman 14 пт.

Связи между фигурами привязаны к фигурам: при перетаскивании в draw.io линии едут следом.
Перед записью файла скрипт проверяет, что текст помещается в фигуры, фигуры не наезжают друг
на друга, линии и подписи не идут через чужие фигуры и всё стоит в пределах листа.

Запуск: python make_diagrams.py  – пишет ../Проектирование.drawio и ../Классы подробно.drawio
"""
import html
import math
import pathlib
import re
import sys

from PIL import ImageFont

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
OUT = pathlib.Path(__file__).resolve().parent.parent / 'Проектирование.drawio'
DETAIL = OUT.parent / 'Классы подробно.drawio'

FONT = 17
LEADING = FONT * 1.2       # шаг строк в draw.io
REGULAR = 'C:/Windows/Fonts/arial.ttf'
BOLD = 'C:/Windows/Fonts/arialbd.ttf'
_measure = {False: ImageFont.truetype(REGULAR, FONT * 4), True: ImageFont.truetype(BOLD, FONT * 4)}

WIDTH = 623                # 16,5 см
MAX_H = 900
BW = 'strokeColor=#000000;fontColor=#000000;fontFamily=Arial;fontSize=%d;' % FONT


def text_width(text, bold=False):
    return _measure[bold].getlength(text) / 4


def widest(text, bold=False):
    return max(text_width(line, bold) for line in text.split('\n'))


def html_text(text):
    """Обычный текст в HTML подписи draw.io: экранирование и переносы строк."""
    return '<br>'.join(html.escape(line, quote=False) for line in text.split('\n'))


def attr(value):
    return html.escape(value, quote=True)


def overlap(a, b, gap=0):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw + gap and bx < ax + aw + gap and ay < by + bh + gap and by < ay + ah + gap


def segment_hits(p0, p1, box, inset=0.5):
    """Проходит ли горизонтальный или вертикальный отрезок через внутренность прямоугольника."""
    x, y, w, h = box
    x0, x1 = sorted((p0[0], p1[0]))
    y0, y1 = sorted((p0[1], p1[1]))
    return x0 < x + w - inset and x1 > x + inset and y0 < y + h - inset and y1 > y + inset


class Page:
    """Страница файла draw.io: ячейки XML и геометрия для проверок."""

    def __init__(self, name, pid):
        self.name, self.pid = name, pid
        self.cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
        self.box = {}          # id -> (x, y, w, h) в координатах листа
        self.parent = {}       # id -> id родителя ('1' – лист)
        self.solid = []        # фигуры, через которые не идут линии и чужие подписи: (id, box)
        self.lines = []        # (id линии, точки, id концов, стиль)
        self.texts = []        # (id, box) – подписи вне фигур

    # ------------------------------------------------------------ ячейки

    def vertex(self, cid, value, style, x, y, w, h, parent='1', solid=True):
        px, py = (0, 0) if parent == '1' else self.box[parent][:2]
        self.cells.append('<mxCell id="%s" value="%s" style="%s" vertex="1" parent="%s">'
                          '<mxGeometry x="%s" y="%s" width="%s" height="%s" as="geometry"/></mxCell>'
                          % (cid, value, style, parent, fmt(x - px), fmt(y - py), fmt(w), fmt(h)))
        self.box[cid] = (x, y, w, h)
        self.parent[cid] = parent
        if solid:
            self.solid.append((cid, (x, y, w, h)))

    def edge(self, eid, style, source, target, start, end, points=(), parent='1', ends=None):
        """Линия от точки start на source до точки end на target через points (всё в координатах листа).

        Точки на границе фигур переводятся в exitX/exitY и entryX/entryY, поэтому линия
        остаётся привязанной к фигуре. ends – свои exit/entry (для повёрнутых интерфейсов).
        """
        if ends is None:
            ends = self.anchor('exit', source, start) + self.anchor('entry', target, end)
        px, py = (0, 0) if parent == '1' else self.box[parent][:2]
        waypoints = ''
        if points:
            waypoints = '<Array as="points">%s</Array>' % ''.join(
                '<mxPoint x="%s" y="%s"/>' % (fmt(x - px), fmt(y - py)) for x, y in points)
        self.cells.append('<mxCell id="%s" value="" style="%s%s" edge="1" parent="%s" source="%s" target="%s">'
                          '<mxGeometry relative="1" as="geometry">%s</mxGeometry></mxCell>'
                          % (eid, style, ends, parent, source, target, waypoints))
        self.lines.append((eid, [start] + list(points) + [end], {source, target}, style))

    def edge_label(self, eid, text, end, side):
        """Подпись у конца линии (кратность): end – 'source' или 'target', side – куда от точки конца.

        Подпись – дочерняя ячейка линии с x = -1 или 1, поэтому едет вместе с линией.
        """
        line = [l for l in self.lines if l[0] == eid][0]
        px, py = line[1][0] if end == 'source' else line[1][-1]
        vertical, horizontal = side.split('-')            # above-right, below-left...
        dx, align = (5, 'left') if horizontal == 'right' else (-5, 'right')
        dy, valign = (-3, 'bottom') if vertical == 'above' else (3, 'top')
        lid = '%s_%s' % (eid, end)
        self.cells.append('<mxCell id="%s" value="%s" style="edgeLabel;resizable=0;html=1;align=%s;verticalAlign=%s;'
                          'labelBackgroundColor=none;%s" vertex="1" connectable="0" parent="%s">'
                          '<mxGeometry x="%d" relative="1" as="geometry"><mxPoint x="%d" y="%d" as="offset"/>'
                          '</mxGeometry></mxCell>' % (lid, attr(html_text(text)), align, valign, BW, eid,
                                                       -1 if end == 'source' else 1, dx, dy))
        w, h = text_width(text) + 4, LEADING + 2
        x = px + dx if align == 'left' else px + dx - w
        y = py + dy if valign == 'top' else py + dy - h
        self.text(eid + '#' + end, (x, y, w, h))

    def anchor(self, kind, cid, point):
        x, y, w, h = self.box[cid]
        fx, fy = (point[0] - x) / w, (point[1] - y) / h
        assert -1e-6 <= fx <= 1 + 1e-6 and -1e-6 <= fy <= 1 + 1e-6, 'точка %s вне фигуры %s' % (point, cid)
        assert min(fx, 1 - fx, fy, 1 - fy) < 1e-6, 'точка %s не на границе %s' % (point, cid)
        return '%sX=%.4f;%sY=%.4f;%sDx=0;%sDy=0;' % (kind, fx, kind, fy, kind, kind)

    def text(self, tid, box):
        self.texts.append((tid, box))

    # ------------------------------------------------------------ проверки

    def check(self, max_h=MAX_H):
        boxes = self.solid
        for cid, b in boxes + self.texts:
            x, y, w, h = b
            assert 0 <= x and x + w <= WIDTH and 0 <= y and y + h <= max_h, \
                '%s: %s за пределами листа %s x %s' % (self.name, cid, WIDTH, max_h)
        for i, (a, ba) in enumerate(boxes):
            for b, bb in boxes[i + 1:]:
                if self.parent[a] == self.parent[b]:
                    assert not overlap(ba, bb), '%s: наезжают %s и %s' % (self.name, a, b)
            p = self.parent[a]
            if p != '1':
                px, py, pw, ph = self.box[p]
                x, y, w, h = ba
                assert px <= x and x + w <= px + pw and py <= y and y + h <= py + ph, \
                    '%s: %s вылезает из %s' % (self.name, a, p)
        for tid, tb in self.texts:
            for cid, b in boxes:
                if not self.is_inside(cid, {tid.split('#')[0]}):
                    assert not overlap(tb, b), '%s: подпись %s наезжает на %s' % (self.name, tid, cid)
        for i, (a, ta) in enumerate(self.texts):
            for b, tb in self.texts[i + 1:]:
                assert not overlap(ta, tb), '%s: подписи %s и %s наезжают' % (self.name, a, b)
        for eid, points, own, _ in self.lines:
            for p0, p1 in zip(points, points[1:]):
                assert p0[0] == p1[0] or p0[1] == p1[1], '%s: косой отрезок у %s' % (self.name, eid)
                for cid, b in boxes:
                    if cid in own or self.is_inside(cid, own):
                        continue
                    assert not segment_hits(p0, p1, b), '%s: линия %s идёт через %s' % (self.name, eid, cid)
                for tid, tb in self.texts:
                    if tid.split('#')[0] in own:
                        continue
                    assert not segment_hits(p0, p1, tb), '%s: линия %s идёт через подпись %s' % (self.name, eid, tid)
        # линии между собой: пересечение – только с дугой-перескоком у верхней (позже нарисованной)
        # линии, общий отрезок – только у линий с общим концом (гребёнка от одного класса)
        segments = [(n, eid, p0, p1, own, style) for n, (eid, points, own, style) in enumerate(self.lines)
                    for p0, p1 in zip(points, points[1:])]
        for i, (n1, e1, a0, a1, own1, _) in enumerate(segments):
            for n2, e2, b0, b1, own2, style2 in segments[i + 1:]:
                if n1 == n2:
                    continue
                kind = crossing(a0, a1, b0, b1)
                assert kind != 'cross' or 'jumpStyle' in style2, (
                    '%s: %s пересекает %s без перескока' % (self.name, e2, e1))
                assert kind != 'overlap' or own1 & own2, '%s: %s и %s идут по одному отрезку' % (self.name, e1, e2)

    def is_inside(self, cid, own):
        """Лежит ли один из концов линии внутри фигуры cid (таблица в базе, класс в пакете)."""
        for o in own:
            while o in self.parent and o != '1':
                o = self.parent[o]
                if o == cid:
                    return True
        return False

    def xml(self, max_h=MAX_H):
        self.check(max_h)
        return ('<diagram name="%s" id="%s"><mxGraphModel dx="900" dy="700" grid="0" gridSize="10" guides="1" '
                'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" '
                'pageHeight="1169" math="0" shadow="0" background="#FFFFFF" adaptiveColors="none">'
                '<root>%s</root></mxGraphModel></diagram>' % (attr(self.name), self.pid, ''.join(self.cells)))


def crossing(a0, a1, b0, b1):
    """'cross' – отрезки пересекаются крестом, 'overlap' – лежат друг на друге, иначе None."""
    a_h, b_h = a0[1] == a1[1], b0[1] == b1[1]
    if a_h != b_h:
        (h0, h1), (v0, v1) = ((a0, a1), (b0, b1)) if a_h else ((b0, b1), (a0, a1))
        x0, x1 = sorted((h0[0], h1[0]))
        y0, y1 = sorted((v0[1], v1[1]))
        return 'cross' if x0 < v0[0] < x1 and y0 < h0[1] < y1 else None
    k = 1 if a_h else 0                       # общая координата: y у горизонтальных, x у вертикальных
    if a0[k] != b0[k]:
        return None
    lo, hi = sorted((a0[1 - k], a1[1 - k])), sorted((b0[1 - k], b1[1 - k]))
    return 'overlap' if min(lo[1], hi[1]) - max(lo[0], hi[0]) > 0.5 else None


def fmt(v):
    v = round(v, 2)
    return ('%d' % v) if v == int(v) else ('%s' % v)


# ======================================================================== компоненты

COMP_H = 76                # две строки текста внизу, значок компонента в правом верхнем углу
IFACE = 24                 # сторона фигуры Provided/Required Interface
LINE = 'endArrow=none;html=1;rounded=0;edgeStyle=orthogonalEdgeStyle;' + BW
JUMP = 'jumpStyle=arc;jumpSize=10;'


def component(page, cid, stereotype, name, x, y, w):
    """UML → Component: «стереотип» и имя, значок модуля в углу (как в палитре и в образце)."""
    assert text_width('«%s»' % stereotype) + 16 <= w and text_width(name, True) + 16 <= w, name
    value = attr('&laquo;%s&raquo;<br><b>%s</b>' % (html.escape(stereotype), html_text(name)))
    page.vertex(cid, value, 'html=1;dropTarget=0;whiteSpace=wrap;verticalAlign=bottom;spacingBottom=8;'
                'fillColor=#FFFFFF;' + BW, x, y, w, COMP_H)
    page.cells.append('<mxCell id="%s_icon" value="" style="shape=module;jettyWidth=8;jettyHeight=4;'
                      'fillColor=#FFFFFF;strokeColor=#000000;" vertex="1" parent="%s">'
                      '<mxGeometry x="1" width="20" height="20" relative="1" as="geometry">'
                      '<mxPoint x="-27" y="7" as="offset"/></mxGeometry></mxCell>' % (cid, cid))


# куда смотрят шарик и гнездо у повёрнутой фигуры интерфейса: точка (0; 0,5) – конец шарика,
# (1; 0,5) – конец гнезда; draw.io поворачивает их вместе с фигурой
BALL = {'east': (-1, 0), 'west': (1, 0), 'north': (0, 1), 'south': (0, -1)}


def interface(page, iid, label, center, direction, side):
    """UML → Provided/Required Interface: шарик (кто предоставляет) и гнездо (кто использует).

    direction – куда смотрит гнездо: east – вправо, west – влево, north – вверх, south – вниз.
    side – где подпись: top, bottom, left, right.
    """
    cx, cy = center
    position = {
        'top': 'verticalLabelPosition=top;verticalAlign=bottom;labelPosition=center;align=center;spacingBottom=1;',
        'bottom': 'verticalLabelPosition=bottom;verticalAlign=top;labelPosition=center;align=center;spacingTop=1;',
        'left': 'labelPosition=left;align=right;verticalLabelPosition=middle;verticalAlign=middle;spacingRight=3;',
        'right': 'labelPosition=right;align=left;verticalLabelPosition=middle;verticalAlign=middle;spacingLeft=3;',
    }[side]
    page.vertex(iid, attr(html_text(label)), 'shape=providedRequiredInterface;html=1;sketch=0;direction=%s;'
                'fillColor=#FFFFFF;%s%s' % (direction, BW, position), cx - IFACE / 2, cy - IFACE / 2, IFACE, IFACE)
    w, h = widest(label) + 4, (label.count('\n') + 1) * LEADING + 4
    half = IFACE / 2
    box = {'top': (cx - w / 2, cy - half - 4 - h, w, h), 'bottom': (cx - w / 2, cy + half + 4, w, h),
           'left': (cx - half - 6 - w, cy - h / 2, w, h), 'right': (cx + half + 6, cy - h / 2, w, h)}[side]
    page.text(iid + '#label', box)


def iface_end(page, iid, direction, ball):
    """Точка конца шарика (ball=True) или гнезда на листе."""
    x, y, w, h = page.box[iid]
    dx, dy = BALL[direction]
    if not ball:
        dx, dy = -dx, -dy
    return (x + w / 2 + dx * w / 2, y + h / 2 + dy * h / 2)


def provide(page, eid, comp, iid, direction, start, points=(), style=''):
    """Сплошная линия от компонента к шарику: компонент предоставляет интерфейс."""
    end = iface_end(page, iid, direction, True)
    page.edge(eid, LINE + style, comp, iid, start, end, points,
              ends=page.anchor('exit', comp, start) + 'entryX=0;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;')


def require(page, eid, comp, iid, direction, start, points=(), style=''):
    """Сплошная линия от компонента к гнезду: компонент использует интерфейс."""
    end = iface_end(page, iid, direction, False)
    page.edge(eid, LINE + style, comp, iid, start, end, points,
              ends=page.anchor('exit', comp, start) + 'entryX=1;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;')


def components_page():
    """Компоненты: базы слева, сервисы в колонке, шлюз сверху, брокер и Redis снизу.

    Стволы к брокеру идут по левому краю между базами и ни с чем не пересекаются; ствол к Redis
    пересекает ствол шлюза три раза (без пересечений граф «три узла на четыре сервиса» не
    нарисовать), там стоят дуги-перескоки, как в образце.
    """
    page = Page('Компоненты', 'components')
    db_w, svc_w, gap = 152, 188, 70
    x_pub, x_con = 8, 20                    # стволы публикации и потребления у левого края
    x_db = 30
    x_svc = x_db + db_w + gap
    x_mid = x_svc + svc_w / 2
    x_sql = x_db + db_w + gap / 2           # центр интерфейсов SQL
    x_http_if = x_svc + svc_w + gap / 2     # центр интерфейсов HTTP сервисов
    x_http = x_svc + svc_w + 92             # ствол HTTP от шлюза
    x_redis = x_http + 26                   # ствол к Redis
    top = 7
    y_users = 112
    y_pets = y_users + COMP_H + 56
    y_care = y_pets + COMP_H + 60           # между pets и care – gRPC
    y_silo = y_care + COMP_H + 54           # между care и Silo – S3
    y_notif = y_silo + COMP_H + 24
    rows = {'users': y_users, 'pets': y_pets, 'care': y_care, 'notifications': y_notif}

    component(page, 'client', 'Client', 'game-client', x_db, top, db_w)
    component(page, 'gateway', 'nginx', 'api-gateway', x_svc, top, svc_w)
    for svc, y in rows.items():
        component(page, svc, 'NestJS', svc + '-service', x_svc, y, svc_w)
        component(page, svc + '_db', 'PostgreSQL', svc + '_db', x_db, y, db_w)
    component(page, 'silo', 'Silo', 'object-storage', x_svc, y_silo, svc_w)

    # клиент – шлюз: шлюз предоставляет внешний HTTP API
    y_line = top + COMP_H - 22
    interface(page, 'if_gateway', 'HTTP\n(TCP)', (x_sql, y_line), 'west', 'top')
    provide(page, 'gateway_api', 'gateway', 'if_gateway', 'west', (x_svc, y_line))
    require(page, 'client_api', 'client', 'if_gateway', 'west', (x_db + db_w, y_line))

    y_gw = top + COMP_H / 2
    for svc, y in rows.items():
        y_line = y + 26
        # база предоставляет SQL, сервис использует
        interface(page, 'if_%s_db' % svc, 'SQL\n(TCP)', (x_sql, y_line), 'east', 'top')
        provide(page, '%s_db_sql' % svc, svc + '_db', 'if_%s_db' % svc, 'east', (x_db + db_w, y_line))
        require(page, '%s_sql' % svc, svc, 'if_%s_db' % svc, 'east', (x_svc, y_line))
        # сервис предоставляет HTTP API, шлюз передаёт ему запросы
        interface(page, 'if_%s_http' % svc, 'HTTP\n(TCP)', (x_http_if, y_line), 'east', 'top')
        provide(page, '%s_http' % svc, svc, 'if_%s_http' % svc, 'east', (x_svc + svc_w, y_line))
        require(page, 'gateway_%s' % svc, 'gateway', 'if_%s_http' % svc, 'east', (x_svc + svc_w, y_gw),
                [(x_http, y_gw), (x_http, y_line)])

    # care использует gRPC PetCare, который предоставляет pets
    y_grpc = y_pets + COMP_H + 30
    interface(page, 'if_pets_grpc', 'gRPC\n(TCP)', (x_mid, y_grpc), 'south', 'right')
    provide(page, 'pets_grpc', 'pets', 'if_pets_grpc', 'south', (x_mid, y_pets + COMP_H))
    require(page, 'care_grpc', 'care', 'if_pets_grpc', 'south', (x_mid, y_care))

    # care хранит иконки предметов в Silo по протоколу S3
    y_s3 = y_care + COMP_H + 30
    interface(page, 'if_silo', 'S3\n(HTTP)', (x_mid, y_s3), 'north', 'right')
    provide(page, 'silo_s3', 'silo', 'if_silo', 'north', (x_mid, y_silo))
    require(page, 'care_s3', 'care', 'if_silo', 'north', (x_mid, y_care + COMP_H))

    # брокер внизу слева: users и pets публикуют события, care и notifications потребляют
    y_bottom = y_notif + COMP_H
    y_turn_con, y_turn_pub = y_bottom + 26, y_bottom + 40
    y_if = y_bottom + 66
    y_mq = y_if + IFACE / 2 + 16
    x_pub_if, x_con_if = x_db + 30, x_db + 160
    component(page, 'broker', 'RabbitMQ', 'message-broker', x_db, y_mq, 186)
    interface(page, 'if_publish', 'Publishing\n(AMQP)', (x_pub_if, y_if), 'north', 'right')
    interface(page, 'if_consume', 'Consuming\n(AMQP)', (x_con_if, y_if), 'north', 'right')
    provide(page, 'broker_publish', 'broker', 'if_publish', 'north', (x_pub_if, y_mq))
    provide(page, 'broker_consume', 'broker', 'if_consume', 'north', (x_con_if, y_mq))
    for svc, trunk, iface, x_if, y_turn in (('users', x_pub, 'if_publish', x_pub_if, y_turn_pub),
                                            ('pets', x_pub, 'if_publish', x_pub_if, y_turn_pub),
                                            ('care', x_con, 'if_consume', x_con_if, y_turn_con),
                                            ('notifications', x_con, 'if_consume', x_con_if, y_turn_con)):
        y = rows[svc] + COMP_H
        x_exit = x_svc + 16
        require(page, '%s_amqp' % svc, svc, iface, 'north', (x_exit, y),
                [(x_exit, y + 12), (trunk, y + 12), (trunk, y_turn), (x_if, y_turn)])

    # Redis внизу справа: отзыв токенов во всех сервисах и кэш каталога в care
    redis_w = 120
    component(page, 'redis', 'Redis', 'cache', x_redis - redis_w / 2, y_mq, redis_w)
    interface(page, 'if_redis', 'RESP\n(TCP)', (x_redis, y_if), 'north', 'left')
    provide(page, 'redis_resp', 'redis', 'if_redis', 'north', (x_redis, y_mq))
    for svc, y in rows.items():
        x_exit = x_svc + svc_w - 12
        require(page, '%s_resp' % svc, svc, 'if_redis', 'north', (x_exit, y + COMP_H),
                [(x_exit, y + COMP_H + 12), (x_redis, y + COMP_H + 12)], JUMP)
    return page


# ======================================================================== базы данных

# колонки: (ключи, имя, тип); N – допускает NULL. Ссылки между базами – UUID без внешнего ключа
TIMESTAMP = 'TIMESTAMPTZ'
OUTBOX = [('PK', 'id', 'UUID'), ('', 'routing_key', 'VARCHAR(64)'), ('', 'payload', 'JSONB'),
          ('', 'created_at', TIMESTAMP), ('N', 'published_at', TIMESTAMP), ('', 'attempts', 'INTEGER'),
          ('N', 'last_error', 'VARCHAR(512)')]
INBOX = [('PK', 'event_id', 'UUID'), ('', 'routing_key', 'VARCHAR(64)'), ('', 'processed_at', TIMESTAMP)]
TABLES = {
    'users': [('PK', 'id', 'UUID'), ('UK', 'login', 'VARCHAR(32)'), ('', 'nickname', 'VARCHAR(32)'),
              ('', 'password_hash', 'VARCHAR(255)'), ('', 'role', 'VARCHAR(10)'), ('', 'created_at', TIMESTAMP),
              ('', 'updated_at', TIMESTAMP)],
    'pets': [('PK', 'id', 'UUID'), ('IX', 'owner_id', 'UUID'), ('', 'name', 'VARCHAR(24)'),
             ('', 'stage', 'VARCHAR(8)'), ('FK', 'form_code', 'VARCHAR(32)'), ('', 'hunger', 'SMALLINT'),
             ('', 'happiness', 'SMALLINT'), ('', 'discipline', 'SMALLINT'), ('', 'weight', 'SMALLINT'),
             ('', 'poop_count', 'SMALLINT'), ('', 'is_sick', 'BOOLEAN'), ('', 'is_sleeping', 'BOOLEAN'),
             ('N', 'attention', 'VARCHAR(12)'), ('N', 'attention_since', TIMESTAMP),
             ('', 'mistake_counted', 'BOOLEAN'), ('', 'care_mistakes', 'SMALLINT'),
             ('N', 'starving_since', TIMESTAMP), ('', 'born_at', TIMESTAMP), ('', 'stage_since', TIMESTAMP),
             ('', 'simulated_at', TIMESTAMP), ('IX', 'next_tick_at', TIMESTAMP), ('N', 'died_at', TIMESTAMP),
             ('N', 'death_cause', 'VARCHAR(10)'), ('', 'created_at', TIMESTAMP), ('', 'updated_at', TIMESTAMP)],
    'pet_forms': [('PK', 'code', 'VARCHAR(32)'), ('', 'stage', 'VARCHAR(8)'), ('', 'title', 'VARCHAR(32)'),
                  ('', 'description', 'VARCHAR(256)'), ('', 'image_key', 'VARCHAR(128)')],
    'pet_events': [('PK', 'id', 'BIGSERIAL'), ('FK', 'pet_id', 'UUID'), ('', 'type', 'VARCHAR(16)'),
                   ('', 'details', 'JSONB'), ('', 'occurred_at', TIMESTAMP)],
    'applied_care_actions': [('PK', 'action_id', 'UUID'), ('FK', 'pet_id', 'UUID'), ('', 'type', 'VARCHAR(12)'),
                             ('', 'result', 'JSONB'), ('', 'applied_at', TIMESTAMP)],
    'items': [('PK', 'id', 'UUID'), ('UK', 'code', 'VARCHAR(32)'), ('', 'title', 'VARCHAR(64)'),
              ('', 'description', 'VARCHAR(256)'), ('', 'category', 'VARCHAR(10)'), ('', 'price', 'INTEGER'),
              ('', 'is_consumable', 'BOOLEAN'), ('', 'hunger_delta', 'SMALLINT'),
              ('', 'happiness_delta', 'SMALLINT'), ('', 'weight_delta', 'SMALLINT'),
              ('', 'cures_sickness', 'BOOLEAN'), ('N', 'icon_key', 'VARCHAR(128)'), ('', 'is_active', 'BOOLEAN'),
              ('', 'created_at', TIMESTAMP), ('', 'updated_at', TIMESTAMP)],
    'wallets': [('PK', 'user_id', 'UUID'), ('', 'balance', 'INTEGER'), ('', 'updated_at', TIMESTAMP)],
    'wallet_transactions': [('PK', 'id', 'BIGSERIAL'), ('FK', 'user_id', 'UUID'), ('', 'amount', 'INTEGER'),
                            ('', 'balance_after', 'INTEGER'), ('', 'reason', 'VARCHAR(20)'),
                            ('N', 'reference_id', 'UUID'), ('', 'created_at', TIMESTAMP)],
    'inventory_items': [('PK', 'user_id', 'UUID'), ('PK,FK', 'item_id', 'UUID'), ('', 'quantity', 'INTEGER'),
                        ('', 'updated_at', TIMESTAMP)],
    'purchases': [('PK', 'id', 'UUID'), ('IX', 'user_id', 'UUID'), ('FK', 'item_id', 'UUID'),
                  ('', 'quantity', 'SMALLINT'), ('', 'unit_price', 'INTEGER'), ('', 'total_price', 'INTEGER'),
                  ('', 'created_at', TIMESTAMP)],
    'care_actions': [('PK', 'id', 'UUID'), ('IX', 'user_id', 'UUID'), ('IX', 'pet_id', 'UUID'),
                     ('', 'type', 'VARCHAR(12)'), ('FK,N', 'item_id', 'UUID'), ('', 'status', 'VARCHAR(10)'),
                     ('', 'attempts', 'SMALLINT'), ('N', 'result', 'JSONB'), ('N', 'reject_reason', 'VARCHAR(32)'),
                     ('', 'created_at', TIMESTAMP), ('N', 'completed_at', TIMESTAMP)],
    'notifications': [('PK', 'id', 'UUID'), ('IX', 'user_id', 'UUID'), ('', 'type', 'VARCHAR(16)'),
                      ('', 'title', 'VARCHAR(96)'), ('', 'body', 'VARCHAR(512)'), ('N', 'pet_id', 'UUID'),
                      ('', 'is_read', 'BOOLEAN'), ('', 'created_at', TIMESTAMP), ('N', 'read_at', TIMESTAMP)],
    'notification_settings': [('PK', 'user_id', 'UUID'), ('', 'pet_hungry', 'BOOLEAN'),
                              ('', 'pet_sick', 'BOOLEAN'), ('', 'pet_evolved', 'BOOLEAN'),
                              ('', 'pet_died', 'BOOLEAN'), ('', 'updated_at', TIMESTAMP)],
}

T_HEAD = 30                # строка с именем таблицы
T_ROW = 24
DB_HEAD = 30               # заголовок базы
DB_PAD = 4                 # поля базы по бокам
DB_IN = 8                  # отступ таблиц от заголовка и от низа базы
T_GAP = 32                 # между колонками таблиц – место под связи


def table_size(name, columns):
    """Ширины колонки ключей и колонки «имя (ТИП)», высота таблицы.

    У подписи draw.io свой отступ 2 px с каждой стороны (spacing), у поля ещё 4 px слева;
    запас 4 px, чтобы строка не перенеслась и не обрезалась при другой отрисовке шрифта.
    """
    rows = columns if isinstance(columns, list) else TABLES[columns]
    key_w = max(32, math.ceil(max(text_width(k) for k, _, _ in rows) + 8))
    field_w = math.ceil(max(text_width('%s (%s)' % (n, t)) for _, n, t in rows) + 2 + 4 + 2 + 4)
    return key_w, field_w, T_HEAD + T_ROW * len(rows)


def table_width(name, columns=None):
    key_w, field_w, _ = table_size(name, columns or name)
    return max(key_w + field_w, math.ceil(text_width(name, True) + 16))


def table(page, tid, name, columns, x, y, w, parent):
    """ER → Table из палитры: заголовок, строки «ключи | имя (ТИП)», черта под первичным ключом."""
    key_w, field_w, h = table_size(name, columns)
    assert key_w + field_w <= w and text_width(name, True) + 16 <= w, name
    page.vertex(tid, attr(html_text(name)), 'shape=table;startSize=%d;container=1;collapsible=0;'
                'childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;html=1;'
                'fillColor=#FFFFFF;swimlaneFillColor=#FFFFFF;%s' % (T_HEAD, BW), x, y, w, h, parent)
    last_pk = max(i for i, (k, _, _) in enumerate(columns) if 'PK' in k)
    for i, (keys, field, kind) in enumerate(columns):
        rid = '%s_%s' % (tid, field)
        ry = y + T_HEAD + T_ROW * i
        page.vertex(rid, '', 'shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;'
                    'collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;top=0;left=0;'
                    'right=0;bottom=%d;strokeColor=#000000;' % (i == last_pk), x, ry, w, T_ROW, tid, solid=False)
        pk = 'PK' in keys
        cell = 'shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;overflow=hidden;' \
               'whiteSpace=wrap;html=1;' + BW
        page.vertex(rid + '_k', attr(html_text(keys)), cell + 'fontStyle=%d;' % (1 if pk else 0),
                    x, ry, key_w, T_ROW, rid, solid=False)
        page.vertex(rid + '_f', attr(html_text('%s (%s)' % (field, kind))),
                    cell + 'align=left;spacingLeft=4;fontStyle=%d;' % (5 if pk else 0),
                    x + key_w, ry, w - key_w, T_ROW, rid, solid=False)


def database(page, sid, name, x, y, w, h):
    """База – контейнер с именем, как в образце."""
    assert text_width(name, True) + 16 <= w
    page.vertex(sid, attr(html_text(name)), 'swimlane;whiteSpace=wrap;html=1;startSize=%d;fontStyle=1;collapsible=0;'
                'fillColor=#FFFFFF;swimlaneFillColor=#FFFFFF;%s' % (DB_HEAD, BW), x, y, w, h)


ER = 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=ERzeroToMany;endFill=0;startFill=0;' \
     'strokeColor=#000000;'


def relation(page, swim, parent_t, child_t, field, exit_y=None):
    """Связь «один ко многим»: от границы родительской таблицы к строке внешнего ключа.

    Две черты у родителя («ровно один»), кружок с лапкой у потомка («ноль или много»);
    если внешний ключ допускает NULL, у родителя кружок с чертой («ноль или один»).
    Линия прямая, когда строка внешнего ключа лежит напротив родителя, иначе с изломом
    посередине зазора между колонками.
    """
    row = '%s_%s' % (child_t, field)
    keys = [k for k, n, _ in TABLES[child_t] if n == field][0]
    px, py, pw, ph = page.box[parent_t]
    rx, ry, rw, rh = page.box[row]
    y_row = ry + rh / 2
    to_right = rx > px
    start_x = px + pw if to_right else px
    end_x = rx if to_right else rx + rw
    exit_y = y_row if exit_y is None else exit_y
    points = []
    if exit_y != y_row:
        x_mid = round((start_x + end_x) / 2)
        points = [(x_mid, exit_y), (x_mid, y_row)]
    start = 'startArrow=%s;' % ('ERzeroToOne' if 'N' in keys.split(',') else 'ERmandOne')
    page.edge('rel_%s_%s' % (child_t, field), ER + start, parent_t, row, (start_x, exit_y), (end_x, y_row),
              points, parent=swim)


def stack(page, swim, names, x, y, w, gap=10):
    """Таблицы колонкой одна под другой; возвращает низ колонки."""
    for name in names:
        table(page, name, name, TABLES[name], x, y, w, swim)
        y += table_size(name, name)[2] + gap
    return y - gap


def db_users_notifications_page():
    """Две небольшие базы на одном листе: слева основные таблицы, справа служебные."""
    page = Page('БД users_db и notifications_db', 'db-users-notifications')
    x0, w = 1, WIDTH - 2
    lw = max(table_width('users'), table_width('notifications'))
    rw = max(table_width('outbox_messages', OUTBOX), table_width('notification_settings'),
             table_width('processed_events', INBOX))
    assert 2 * DB_PAD + lw + rw + 20 <= w, 'users/notifications не влезают по ширине'
    lx, rx = x0 + DB_PAD, x0 + w - DB_PAD - rw
    # users_db: пользователи и outbox рядом
    top = 1 + DB_HEAD + DB_IN
    h = max(table_size('users', 'users')[2], T_HEAD + T_ROW * len(OUTBOX))
    database(page, 'users_db', 'users_db', x0, 1, w, DB_HEAD + DB_IN + h + DB_IN)
    stack(page, 'users_db', ['users'], lx, top, lw)
    table(page, 'users_outbox', 'outbox_messages', OUTBOX, rx, top, rw, 'users_db')
    # notifications_db: уведомления слева, настройки и inbox справа
    y_n = 1 + DB_HEAD + DB_IN + h + DB_IN + 16
    top = y_n + DB_HEAD + DB_IN
    settings_h = table_size('notification_settings', 'notification_settings')[2]
    h = max(table_size('notifications', 'notifications')[2], settings_h + 10 + T_HEAD + T_ROW * len(INBOX))
    database(page, 'notifications_db', 'notifications_db', x0, y_n, w, DB_HEAD + DB_IN + h + DB_IN)
    stack(page, 'notifications_db', ['notifications'], lx, top, lw)
    stack(page, 'notifications_db', ['notification_settings'], rx, top, rw)
    table(page, 'notifications_inbox', 'processed_events', INBOX, rx, top + settings_h + 10, rw, 'notifications_db')
    return page


def db_pets_page():
    """pets слева; справа справочник форм напротив form_code, хронология и уход напротив pets."""
    page = Page('БД pets_db', 'db-pets')
    x0, w = 1, WIDTH - 2
    top = 1 + DB_HEAD + DB_IN
    lw = table_width('pets')
    rw = max(table_width('pet_forms'), table_width('pet_events'), table_width('applied_care_actions'),
             table_width('outbox_messages', OUTBOX))
    assert DB_PAD + lw + T_GAP + rw + DB_PAD <= w, 'pets_db не влезает по ширине'
    rx = x0 + w - DB_PAD - rw
    form_row = [n for _, n, _ in TABLES['pets']].index('form_code')
    y_forms = top + T_ROW * form_row          # строка PK справочника напротив form_code
    bottom = max(top + table_size('pets', 'pets')[2],
                 y_forms + sum(table_size(n, n)[2] + 10 for n in ('pet_forms', 'pet_events', 'applied_care_actions'))
                 + T_HEAD + T_ROW * len(OUTBOX))
    database(page, 'pets_db', 'pets_db', x0, 1, w, bottom + DB_IN - 1)
    stack(page, 'pets_db', ['pets'], x0 + DB_PAD, top, lw)
    y = stack(page, 'pets_db', ['pet_forms', 'pet_events', 'applied_care_actions'], rx, y_forms, rw)
    table(page, 'pets_outbox', 'outbox_messages', OUTBOX, rx, y + 10, rw, 'pets_db')
    relation(page, 'pets_db', 'pet_forms', 'pets', 'form_code')
    relation(page, 'pets_db', 'pets', 'pet_events', 'pet_id')
    relation(page, 'pets_db', 'pets', 'applied_care_actions', 'pet_id')
    return page


def db_care_page():
    """items слева, его потомки справа напротив; кошелёк справа, журнал слева напротив."""
    page = Page('БД care_db', 'db-care')
    x0, w = 1, WIDTH - 2
    top = 1 + DB_HEAD + DB_IN
    right = ['inventory_items', 'purchases', 'care_actions', 'wallets']
    lw = max(table_width('items'), table_width('processed_events', INBOX), table_width('wallet_transactions'))
    rw = max(table_width(n) for n in right)
    assert DB_PAD + lw + T_GAP + rw + DB_PAD <= w, 'care_db не влезает по ширине: %d' % (lw + rw + T_GAP + 2 * DB_PAD)
    lx, rx = x0 + DB_PAD, x0 + w - DB_PAD - rw
    height = dict((n, table_size(n, n)[2]) for n in right + ['items', 'wallet_transactions'])
    y_wallets = top + sum(height[n] + 10 for n in right[:-1])
    items_bottom = top + height['items']
    # журнал кошелька: его строка user_id (вторая) напротив первичного ключа кошелька
    y_tx = y_wallets - T_ROW
    assert y_tx >= items_bottom + 10 + T_HEAD + T_ROW * len(INBOX) + 10, 'журнал кошелька наезжает на inbox'
    bottom = max(y_wallets + height['wallets'], y_tx + height['wallet_transactions'])
    database(page, 'care_db', 'care_db', x0, 1, w, bottom + DB_IN - 1)
    stack(page, 'care_db', right, rx, top, rw)
    stack(page, 'care_db', ['items'], lx, top, lw)
    table(page, 'care_inbox', 'processed_events', INBOX, lx, items_bottom + 10, lw, 'care_db')
    stack(page, 'care_db', ['wallet_transactions'], lx, y_tx, lw)
    relation(page, 'care_db', 'items', 'inventory_items', 'item_id')
    relation(page, 'care_db', 'items', 'purchases', 'item_id')
    relation(page, 'care_db', 'items', 'care_actions', 'item_id', exit_y=items_bottom - T_ROW / 2)
    relation(page, 'care_db', 'wallets', 'wallet_transactions', 'user_id')
    return page


# ======================================================================== классы

# имя -> (стереотип, поля, методы). Сигнатуры как в образце: у DTO и сущностей в параметрах только
# тип, у строк и чисел ещё имя; у асинхронных методов тип результата без Promise<> (в образце без
# Task<>), текущий пользователь в методах контроллеров не указан (его даёт guard). У перечисления
# вместо полей – литералы
MODEL = {}


def model(name, fields=(), methods=(), stereotype=None):
    MODEL[name] = (stereotype, list(fields), list(methods))


ASYNC_HANDLE = '+ handle(EventEnvelope, EntityManager): void'

# --- libs/common: доступ и ошибки
model('JwtAuthGuard', ['- jwt: JwtService', '- revocation: TokenRevocationService', '- reflector: Reflector'],
      ['+ canActivate(ExecutionContext): boolean'])
model('RolesGuard', ['- reflector: Reflector'], ['+ canActivate(ExecutionContext): boolean'])
model('TokenRevocationService', ['- redis: Redis'],
      ['+ revoke(JwtUser): void', '+ isRevoked(jti: string): boolean'])
model('JwtUser', ['+ sub: string', '+ role: Role', '+ jti: string', '+ exp: number'])
model('Role', ['PLAYER', 'ADMIN'], stereotype='enumeration')
model('ProblemDetailsFilter', ['- logger: Logger'], ['+ catch(unknown, ArgumentsHost): void'])
model('ProblemException', ['+ problem: ProblemDetails'])
model('ProblemDetails', ['+ type: string', '+ title: string', '+ status: number', '+ detail?: string',
                         '+ instance: string', '+ requestId: string', '+ errors?: FieldError[]'])
model('FieldError', ['+ field: string', '+ message: string'])

# --- libs/common: события
model('OutboxService', [], ['+ add(EntityManager, EventEnvelope): void'])
model('OutboxRelay', ['- dataSource: DataSource', '- publisher: RabbitPublisher'], ['+ relay(): void'])
model('OutboxMessage', ['+ id: string', '+ routingKey: string', '+ payload: EventEnvelope', '+ createdAt: Date',
                        '+ publishedAt: Date | null', '+ attempts: number', '+ lastError: string | null'])
model('RabbitPublisher', ['- channel: ChannelWrapper'], ['+ publish(OutboxMessage): void'])
model('RabbitConsumer', ['- channel: ChannelWrapper', '- inbox: InboxService', '- handlers: EventHandler[]'],
      ['+ onModuleInit(): void', '- dispatch(ConsumeMessage): void'])
model('EventHandler', ['+ routingKeys: string[]'], [ASYNC_HANDLE], stereotype='interface')
model('InboxService', ['- dataSource: DataSource'], ['+ process(EventEnvelope, EventHandler): void'])
model('ProcessedEvent', ['+ eventId: string', '+ routingKey: string', '+ processedAt: Date'])

# --- libs/contracts: события и gRPC
model('EventEnvelope<T>', ['+ eventId: string', '+ type: string', '+ version: number', '+ occurredAt: string',
                           '+ payload: T'])
model('UserRegistered', ['+ userId: string', '+ login: string', '+ nickname: string', '+ registeredAt: string'])
PET_EVENT = ['+ petId: string', '+ ownerId: string', '+ petName: string']
model('PetHungry', PET_EVENT + ['+ since: string'])
model('PetSick', PET_EVENT + ['+ cause: string'])
model('PetEvolved', PET_EVENT + ['+ fromStage: string', '+ toStage: string', '+ formCode: string',
                                 '+ careMistakes: number'])
model('PetDied', PET_EVENT + ['+ cause: string', '+ ageDays: number'])
model('PetCare', [], ['+ applyCareAction(ApplyCareActionRequest): PetSnapshot',
                      '+ getPetSnapshot(GetPetSnapshotRequest): PetSnapshot'], stereotype='interface')
model('ApplyCareActionRequest', ['+ actionId: string', '+ petId: string', '+ ownerId: string', '+ type: string',
                                 '+ hungerDelta: number', '+ happinessDelta: number', '+ weightDelta: number',
                                 '+ curesSickness: boolean'])
model('GetPetSnapshotRequest', ['+ petId: string', '+ ownerId: string'])
model('PetSnapshot', ['+ petId: string', '+ name: string', '+ stage: string', '+ formCode: string',
                      '+ hunger: number', '+ happiness: number', '+ discipline: number', '+ weight: number',
                      '+ poopCount: number', '+ isSick: boolean', '+ isSleeping: boolean', '+ careMistakes: number',
                      '+ careMistakeMade: boolean'])

# --- users-service
model('AuthController', ['- auth: AuthService'],
      ['+ register(RegisterDto): AuthTokenDto', '+ login(LoginDto): AuthTokenDto',
       '+ logout(): void'])
model('UsersController', ['- users: UsersService'],
      ['+ getMe(): UserDto', '+ updateMe(UpdateUserDto): UserDto',
       '+ changePassword(ChangePasswordDto): void'])
model('RegisterDto', ['+ login: string', '+ nickname: string', '+ password: string'])
model('LoginDto', ['+ login: string', '+ password: string'])
model('AuthTokenDto', ['+ userId: string', '+ accessToken: string', '+ expiresIn: number'])
model('UserDto', ['+ id: string', '+ login: string', '+ nickname: string', '+ role: Role', '+ createdAt: Date'])
model('UpdateUserDto', ['+ nickname: string'])
model('ChangePasswordDto', ['+ currentPassword: string', '+ newPassword: string'])
model('AuthService', ['- users: Repository<User>', '- outbox: OutboxService', '- dataSource: DataSource',
                      '- tokens: JwtTokenService', '- revocation: TokenRevocationService',
                      '- hasher: PasswordHasher'],
      ['+ register(RegisterDto): AuthTokenDto', '+ login(LoginDto): AuthTokenDto',
       '+ logout(JwtUser): void'])
model('UsersService', ['- users: Repository<User>', '- hasher: PasswordHasher'],
      ['+ getMe(userId: string): UserDto', '+ updateMe(userId: string, UpdateUserDto): UserDto',
       '+ changePassword(userId: string, ChangePasswordDto): void'])
model('JwtTokenService', ['- jwt: JwtService'], ['+ issue(User): AuthTokenDto'])
HASHER = ['+ hash(password: string): string', '+ verify(hash: string, password: string): boolean']
model('PasswordHasher', [], HASHER, stereotype='interface')
model('Argon2PasswordHasher', [], HASHER)
model('User', ['+ id: string', '+ login: string', '+ nickname: string', '+ passwordHash: string', '+ role: Role',
               '+ createdAt: Date', '+ updatedAt: Date'])

# --- pets-service
model('PetsController', ['- pets: PetsService'],
      ['+ create(CreatePetDto): PetDto', '+ list(PetsQuery): PetDto[]',
       '+ get(petId: string): PetDto',
       '+ rename(petId: string, RenamePetDto): PetDto',
       '+ history(petId: string): PetEventDto[]'])
model('AdminPetsController', ['- lifecycle: LifecycleService'],
      ['+ timeTravel(petId: string, TimeTravelDto): PetDto'])
model('CreatePetDto', ['+ name: string'])
model('RenamePetDto', ['+ name: string'])
model('PetsQuery', ["+ status: 'alive' | 'dead'"])
model('TimeTravelDto', ['+ gameMinutes: number'])
model('PetDto', ['+ id: string', '+ name: string', '+ stage: Stage', '+ form: PetFormDto', '+ hunger: number',
                 '+ happiness: number', '+ discipline: number', '+ weight: number', '+ poopCount: number',
                 '+ isSick: boolean', '+ isSleeping: boolean', '+ attention: Attention | null',
                 '+ careMistakes: number', '+ bornAt: Date', '+ diedAt: Date | null',
                 '+ deathCause: DeathCause | null'])
model('PetFormDto', ['+ code: string', '+ title: string', '+ description: string', '+ imageUrl: string'])
model('PetEventDto', ['+ type: string', '+ details: object', '+ occurredAt: Date'])
model('PetsService', ['- pets: Repository<Pet>', '- forms: Repository<PetForm>', '- events: Repository<PetEvent>'],
      ['+ create(ownerId: string, CreatePetDto): PetDto',
       '+ list(ownerId: string, PetsQuery): PetDto[]',
       '+ get(ownerId: string, petId: string): PetDto',
       '+ rename(ownerId: string, petId: string, RenamePetDto): PetDto',
       '+ history(ownerId: string, petId: string): PetEventDto[]'])
model('LifecycleScheduler', ['- lifecycle: LifecycleService'], ['+ tick(): void'])
model('LifecycleService', ['- dataSource: DataSource', '- outbox: OutboxService', '- rules: GameRules'],
      ['+ processDue(limit: number): number',
       '+ timeTravel(petId: string, minutes: number): PetDto'])
model('Simulation', [], ['+ simulate(Pet, now: Date, GameRules, Rng): SimulationResult'], stereotype='utility')
model('SimulationResult', ['+ pet: Pet', '+ history: PetEvent[]', '+ events: EventEnvelope[]'])
model('GameRules', ['+ gameSpeed: number', '+ stageMinutes: Record<Stage, number>', '+ decayMinutes: number',
                    '+ callMinutes: number', '+ neglectHours: number'])
model('PetCareGrpcController', ['- care: PetCareService'],
      ['+ applyCareAction(ApplyCareActionRequest): PetSnapshot',
       '+ getPetSnapshot(GetPetSnapshotRequest): PetSnapshot'])
model('PetCareService', ['- dataSource: DataSource', '- rules: GameRules'],
      ['+ apply(ApplyCareActionRequest): PetSnapshot',
       '+ snapshot(GetPetSnapshotRequest): PetSnapshot'])
model('CareRules', [], ['+ applyCare(Pet, ApplyCareActionRequest, now: Date): CareOutcome'], stereotype='utility')
model('CareOutcome', ['+ pet: Pet', '+ mistake: boolean', '+ history: PetEvent[]'])
model('Pet', ['+ id: string', '+ ownerId: string', '+ name: string', '+ stage: Stage', '+ form: PetForm',
              '+ hunger: number', '+ happiness: number', '+ discipline: number', '+ weight: number',
              '+ poopCount: number', '+ isSick: boolean', '+ isSleeping: boolean', '+ attention: Attention | null',
              '+ attentionSince: Date | null', '+ mistakeCounted: boolean', '+ careMistakes: number',
              '+ starvingSince: Date | null', '+ bornAt: Date', '+ stageSince: Date', '+ simulatedAt: Date',
              '+ nextTickAt: Date', '+ diedAt: Date | null', '+ deathCause: DeathCause | null',
              '+ createdAt: Date', '+ updatedAt: Date'])
model('PetForm', ['+ code: string', '+ stage: Stage', '+ title: string', '+ description: string',
                  '+ imageKey: string'])
model('PetEvent', ['+ id: string', '+ pet: Pet', '+ type: string', '+ details: object', '+ occurredAt: Date'])
model('AppliedCareAction', ['+ actionId: string', '+ pet: Pet', '+ type: string', '+ result: PetSnapshot',
                            '+ appliedAt: Date'])
model('Stage', ['EGG', 'BABY', 'CHILD', 'TEEN', 'ADULT', 'ELDER'], stereotype='enumeration')
model('Attention', ['HUNGRY', 'UNHAPPY', 'DIRTY', 'SICK', 'MISBEHAVING'], stereotype='enumeration')
model('DeathCause', ['NEGLECT', 'OLD_AGE'], stereotype='enumeration')

# --- care-service
ITEM_FIELDS = ['+ code: string', '+ title: string', '+ description: string', '+ category: Category',
               '+ price: number', '+ isConsumable: boolean', '+ hungerDelta: number', '+ happinessDelta: number',
               '+ weightDelta: number', '+ curesSickness: boolean']
ITEM_API = ['+ list(ItemsQuery): ItemDto[]', '+ get(itemId: string): ItemDto',
            '+ create(CreateItemDto): ItemDto', '+ update(itemId: string, UpdateItemDto): ItemDto',
            '+ uploadIcon(itemId: string, Express.Multer.File): IconDto']
model('ItemsController', ['- items: ItemsService'], ITEM_API)
model('ItemsService', ['- items: Repository<Item>', '- cache: ItemCatalogCache', '- icons: IconStorage'], ITEM_API)
model('ItemCatalogCache', ['- redis: Redis'],
      ['+ get(category: string): ItemDto[] | null', '+ set(category: string, ItemDto[]): void',
       '+ invalidate(): void'])
model('IconStorage', ['- client: Minio.Client', '- bucket: string'],
      ['+ put(key: string, Buffer, type: string): void', '+ url(key: string): string'])
model('ItemsQuery', ['+ category?: Category'])
model('ItemDto', ['+ id: string'] + ITEM_FIELDS + ['+ iconUrl: string | null'])
model('CreateItemDto', ITEM_FIELDS)
model('UpdateItemDto', ['+ isActive?: boolean'])
model('IconDto', ['+ iconUrl: string'])
model('Category', ['FOOD', 'SNACK', 'MEDICINE', 'TOY'], stereotype='enumeration')
model('PurchasesController', ['- shop: ShopService'], ['+ buy(PurchaseDto): PurchaseResultDto'])
model('WalletController', ['- wallet: WalletService'], ['+ get(WalletQuery): WalletDto'])
model('InventoryController', ['- inventory: InventoryService'], ['+ list(): InventoryItemDto[]'])
model('ShopService', ['- dataSource: DataSource', '- wallet: WalletService', '- inventory: InventoryService'],
      ['+ buy(userId: string, PurchaseDto): PurchaseResultDto'])
model('WalletService', ['- wallets: Repository<Wallet>', '- journal: Repository<WalletTransaction>'],
      ['+ get(userId: string, limit: number): WalletDto',
       '+ credit(EntityManager, WalletChange): number',
       '+ debit(EntityManager, WalletChange): number'])
model('InventoryService', ['- inventory: Repository<InventoryItem>'],
      ['+ list(userId: string): InventoryItemDto[]', '+ add(EntityManager, InventoryChange): void',
       '+ take(EntityManager, InventoryChange): void'])
model('PurchaseDto', ['+ itemId: string', '+ quantity: number'])
model('PurchaseResultDto', ['+ purchaseId: string', '+ itemId: string', '+ quantity: number',
                            '+ totalPrice: number', '+ balance: number'])
model('WalletQuery', ['+ limit: number'])
model('WalletDto', ['+ balance: number', '+ transactions: WalletTransactionDto[]'])
model('WalletTransactionDto', ['+ amount: number', '+ balanceAfter: number', '+ reason: Reason',
                               '+ createdAt: Date'])
model('InventoryItemDto', ['+ item: ItemDto', '+ quantity: number'])
model('WalletChange', ['+ userId: string', '+ amount: number', '+ reason: Reason', '+ referenceId?: string'])
model('InventoryChange', ['+ userId: string', '+ itemId: string', '+ quantity: number'])
model('Reason', ['STARTER_KIT', 'PURCHASE', 'PLAY_REWARD', 'EVOLUTION_REWARD'], stereotype='enumeration')
model('CareActionsController', ['- careActions: CareActionsService'],
      ['+ create(CreateCareActionDto): CareResultDto',
       '+ list(CareActionsQuery): CareActionDto[]'])
model('CareActionsService', ['- dataSource: DataSource', '- inventory: InventoryService',
                             '- wallet: WalletService', '- pets: PetCareClient'],
      ['+ perform(userId: string, CreateCareActionDto): CareResultDto',
       '+ list(userId: string, CareActionsQuery): CareActionDto[]', '+ retry(CareAction): void'])
model('CareActionRetrier', ['- careActions: CareActionsService', '- actions: Repository<CareAction>'],
      ['+ retryPending(): void'])
model('PetCareClient', ['- client: ClientGrpc', '- policy: IPolicy'],
      ['+ apply(ApplyCareActionRequest): PetSnapshot'])
model('CreateCareActionDto', ['+ petId: string', '+ type: CareType', '+ itemId?: string'])
model('CareActionDto', ['+ id: string', '+ petId: string', '+ type: CareType', '+ itemId: string | null',
                        '+ status: CareStatus', '+ rejectReason: string | null', '+ createdAt: Date'])
model('CareResultDto', ['+ action: CareActionDto', '+ pet: PetSnapshot'])
model('CareActionsQuery', ['+ petId?: string', '+ limit: number'])
model('StarterKitHandler', ['+ routingKeys: string[]', '- wallet: WalletService', '- inventory: InventoryService'],
      [ASYNC_HANDLE])
model('EvolutionRewardHandler', ['+ routingKeys: string[]', '- wallet: WalletService'], [ASYNC_HANDLE])
model('CareType', ['FEED', 'SNACK', 'PLAY', 'CLEAN', 'HEAL', 'SCOLD', 'LIGHTS_OFF', 'LIGHTS_ON'],
      stereotype='enumeration')
model('CareStatus', ['PENDING', 'APPLIED', 'REJECTED'], stereotype='enumeration')
model('Item', ['+ id: string'] + ITEM_FIELDS + ['+ iconKey: string | null', '+ isActive: boolean',
                                                '+ createdAt: Date', '+ updatedAt: Date'])
model('Wallet', ['+ userId: string', '+ balance: number', '+ updatedAt: Date'])
model('WalletTransaction', ['+ id: string', '+ wallet: Wallet', '+ amount: number', '+ balanceAfter: number',
                            '+ reason: Reason', '+ referenceId: string | null', '+ createdAt: Date'])
model('InventoryItem', ['+ userId: string', '+ item: Item', '+ quantity: number', '+ updatedAt: Date'])
model('Purchase', ['+ id: string', '+ userId: string', '+ item: Item', '+ quantity: number', '+ unitPrice: number',
                   '+ totalPrice: number', '+ createdAt: Date'])
model('CareAction', ['+ id: string', '+ userId: string', '+ petId: string', '+ type: CareType',
                     '+ item: Item | null', '+ status: CareStatus', '+ attempts: number',
                     '+ result: PetSnapshot | null', '+ rejectReason: string | null', '+ createdAt: Date',
                     '+ completedAt: Date | null'])

# --- notifications-service
model('NotificationsController', ['- notifications: NotificationsService', '- stream: NotificationStream'],
      ['+ list(NotificationsQuery): NotificationPageDto',
       '+ unreadCount(): UnreadCountDto', '+ markRead(id: string): NotificationDto',
       '+ readAll(): void', '+ remove(id: string): void',
       '+ stream(): Observable<MessageEvent>', '+ getSettings(): SettingsDto',
       '+ updateSettings(SettingsDto): SettingsDto'])
model('NotificationsService', ['- notifications: Repository<Notification>',
                               '- settings: Repository<NotificationSettings>', '- stream: NotificationStream'],
      ['+ list(userId: string, NotificationsQuery): NotificationPageDto',
       '+ unreadCount(userId: string): UnreadCountDto',
       '+ markRead(userId: string, id: string): NotificationDto',
       '+ readAll(userId: string): void', '+ remove(userId: string, id: string): void',
       '+ getSettings(userId: string): SettingsDto',
       '+ updateSettings(userId: string, SettingsDto): SettingsDto',
       '+ notify(EntityManager, NewNotification): void'])
model('NotificationStream', ['- streams: Map<string, Subject<MessageEvent>>'],
      ['+ subscribe(userId: string): Observable<MessageEvent>', '+ push(userId: string, NotificationDto): void'])
model('NotificationsQuery', ['+ unreadOnly?: boolean', '+ cursor?: string', '+ limit: number'])
model('NotificationDto', ['+ id: string', '+ type: NotificationType', '+ title: string', '+ body: string',
                          '+ petId: string | null', '+ isRead: boolean', '+ createdAt: Date'])
model('NotificationPageDto', ['+ items: NotificationDto[]', '+ nextCursor: string | null'])
model('UnreadCountDto', ['+ count: number'])
model('SettingsDto', ['+ petHungry: boolean', '+ petSick: boolean', '+ petEvolved: boolean', '+ petDied: boolean'])
model('WelcomeHandler', ['+ routingKeys: string[]', '- notifications: NotificationsService'], [ASYNC_HANDLE])
model('PetEventsHandler', ['+ routingKeys: string[]', '- notifications: NotificationsService'], [ASYNC_HANDLE])
model('NotificationTexts', [], ['+ welcome(UserRegistered): NewNotification',
                                '+ forPet(EventEnvelope): NewNotification'], stereotype='utility')
model('NewNotification', ['+ userId: string', '+ type: NotificationType', '+ title: string', '+ body: string',
                          '+ petId?: string'])
model('Notification', ['+ id: string', '+ userId: string', '+ type: NotificationType', '+ title: string',
                       '+ body: string', '+ petId: string | null', '+ isRead: boolean', '+ createdAt: Date',
                       '+ readAt: Date | null'])
model('NotificationSettings', ['+ userId: string', '+ petHungry: boolean', '+ petSick: boolean',
                               '+ petEvolved: boolean', '+ petDied: boolean', '+ updatedAt: Date'])
model('NotificationType', ['WELCOME', 'PET_HUNGRY', 'PET_SICK', 'PET_EVOLVED', 'PET_DIED'],
      stereotype='enumeration')

ROW = 24                   # строка поля или метода
HEAD = 30                  # имя класса
HEAD2 = 52                 # «стереотип» и имя
EMPTY = 4                  # пустое отделение (нет полей или методов)
DIVIDER = 8
ROW_PAD = 18               # spacingLeft 6 + spacingRight 4 + spacing 2 с двух сторон + запас 4


def class_rows(name):
    stereotype, fields, methods = MODEL[name]
    return stereotype, fields, methods, stereotype == 'enumeration'


def class_size(name):
    """Ширина по самой длинной строке и высота класса из палитры UML (Class)."""
    stereotype, fields, methods, enum = class_rows(name)
    w = max([text_width(name, True) + 16] + [text_width(r) + ROW_PAD for r in fields + methods]
            + ([text_width('«%s»' % stereotype) + 16] if stereotype else []))
    head = HEAD2 if stereotype else HEAD
    if enum:
        return math.ceil(w), head + ROW * len(fields)
    return math.ceil(w), head + (ROW * len(fields) or EMPTY) + DIVIDER + (ROW * len(methods) or EMPTY)


CLASS = ('swimlane;fontStyle=%d;align=center;verticalAlign=middle;childLayout=stackLayout;horizontal=1;'
         'startSize=%d;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;'
         'marginBottom=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;swimlaneFillColor=#FFFFFF;' + BW)
ROW_STYLE = ('text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=6;spacingRight=4;'
             'overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;whiteSpace=wrap;'
             'html=1;fontColor=#000000;fontFamily=Arial;fontSize=%d;' % FONT)
RULE = ('line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;'
        'spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;strokeColor=#000000;')
REF = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;fontStyle=1;' + BW
EDGE = 'html=1;rounded=0;edgeStyle=orthogonalEdgeStyle;' + BW
ASSOC = EDGE + 'endArrow=open;endSize=12;'                  # поле-ссылка: направленная ассоциация
DEP = EDGE + 'endArrow=open;endSize=12;dashed=1;'           # зависимость: параметр, результат, создание
REAL = EDGE + 'endArrow=block;endFill=0;endSize=12;dashed=1;'   # реализация интерфейса
GEN = EDGE + 'endArrow=block;endFill=0;endSize=12;'         # наследование


def cid_of(name):
    return re.sub(r'\W', '_', name)


def uml_class(page, name, x, y, w=None):
    """UML → Class: имя (со «стереотипом»), поля, черта, методы. У «utility» методы статические."""
    cid = cid_of(name)
    stereotype, fields, methods, enum = class_rows(name)
    natural, h = class_size(name)
    w = w or natural
    assert natural <= w, '%s: нужно %d, дано %d' % (name, natural, w)
    head = HEAD2 if stereotype else HEAD
    if stereotype:
        title, bold = '&laquo;%s&raquo;<br><b>%s</b>' % (stereotype, html.escape(name)), 0
    else:
        title, bold = html.escape(name), 1
    page.vertex(cid, attr(title), CLASS % (bold, head), x, y, w, h)
    top = [y + head]

    def compartment(rows, suffix, underline=False):
        if not rows:
            page.vertex(cid + suffix, '', ROW_STYLE, x, top[0], w, EMPTY, cid, solid=False)
            top[0] += EMPTY
        for i, text in enumerate(rows):
            value = html.escape(text)
            page.vertex('%s%s%d' % (cid, suffix, i), attr('<u>%s</u>' % value if underline else value),
                        ROW_STYLE, x, top[0], w, ROW, cid, solid=False)
            top[0] += ROW

    compartment(fields, '_f')
    if not enum:
        page.vertex(cid + '_rule', '', RULE, x, top[0], w, DIVIDER, cid, solid=False)
        top[0] += DIVIDER
        compartment(methods, '_m', stereotype == 'utility')
    assert top[0] == y + h
    return page.box[cid]


def ref_class(page, name, x, y, stereotype=None):
    """Класс, подробно показанный на другом листе: только имя (отделения скрыты)."""
    w = math.ceil(max(text_width(name, True), text_width('«%s»' % stereotype) if stereotype else 0) + 16)
    if stereotype:
        value, h = '&laquo;%s&raquo;<br><b>%s</b>' % (stereotype, html.escape(name)), HEAD2
    else:
        value, h = '<b>%s</b>' % html.escape(name), HEAD
    page.vertex(cid_of(name), attr(value), REF.replace('fontStyle=1;', 'fontStyle=0;'), x, y, w, h)
    return page.box[cid_of(name)]


def ref_width(name):
    return math.ceil(text_width(name, True) + 16)


def box(page, name):
    return page.box[cid_of(name)]


def arrow(page, style, src, dst, points, label=None, src_label=None):
    """Линия от класса src к классу dst по точкам (первая – на границе src, последняя – на границе dst).

    label – кратность у конца dst, src_label – у конца src: (текст, сторона), сторона как в Page.edge_label.
    """
    eid = 'e%d_%s_%s' % (len(page.lines), cid_of(src), cid_of(dst))
    page.edge(eid, style, cid_of(src), cid_of(dst), points[0], points[-1], points[1:-1])
    if label:
        page.edge_label(eid, label[0], 'target', label[1])
    if src_label:
        page.edge_label(eid, src_label[0], 'source', src_label[1])
    return eid


def vline(page, style, src, dst, x, label=None, src_label=None):
    """Вертикальная линия между классами один над другим."""
    sx, sy, sw, sh = box(page, src)
    dx, dy, dw, dh = box(page, dst)
    points = [(x, sy + sh), (x, dy)] if sy < dy else [(x, sy), (x, dy + dh)]
    return arrow(page, style, src, dst, points, label, src_label)


def hline(page, style, src, dst, y, label=None, src_label=None):
    """Горизонтальная линия между классами рядом."""
    sx, sy, sw, sh = box(page, src)
    dx, dy, dw, dh = box(page, dst)
    points = [(sx + sw, y), (dx, y)] if sx < dx else [(sx, y), (dx + dw, y)]
    return arrow(page, style, src, dst, points, label, src_label)


def bus_up(page, style, src, names, x_trunk, y_bus):
    """Гребёнка от верха src к классам над ним: общий ствол x_trunk и шина y_bus под ними."""
    sy = box(page, src)[1]
    for name in names:
        bx, by, bw, bh = box(page, name)
        x_to = bx + bw / 2
        points = [(x_trunk, sy), (x_trunk, by + bh)] if abs(x_to - x_trunk) < 1 else \
            [(x_trunk, sy), (x_trunk, y_bus), (x_to, y_bus), (x_to, by + bh)]
        arrow(page, style, src, name, points)


def field_y(page, name, k):
    """Середина k-й строки полей класса (с нуля): к ней подводится линия поля-ссылки."""
    return box(page, name)[1] + (HEAD2 if MODEL[name][0] else HEAD) + k * ROW + ROW / 2


def method_y(page, name, k):
    """Середина k-й строки методов класса (с нуля): от неё идёт зависимость, которую создаёт метод."""
    stereotype, fields, methods = MODEL[name]
    return box(page, name)[1] + (HEAD2 if stereotype else HEAD) + (ROW * len(fields) or EMPTY) + DIVIDER \
        + k * ROW + ROW / 2


def right_edge(page, name):
    x, y, w, h = box(page, name)
    return x + w


def bottom_edge(page, name):
    x, y, w, h = box(page, name)
    return y + h


GAP = 40                   # между рядами классов: место под стрелку


def common_access_page():
    """libs/common: проверка токена, роли, отзыв токена и единый формат ошибок."""
    page = Page('Классы: libs/common – доступ и ошибки', 'cls-common-access')
    uml_class(page, 'JwtAuthGuard', 1, 1)
    trs_w = class_size('TokenRevocationService')[0]
    uml_class(page, 'TokenRevocationService', WIDTH - 1 - trs_w, 1)
    hline(page, ASSOC, 'JwtAuthGuard', 'TokenRevocationService', 40)
    uml_class(page, 'RolesGuard', 1, bottom_edge(page, 'JwtAuthGuard') + GAP)
    y_user = bottom_edge(page, 'JwtAuthGuard') + GAP
    uml_class(page, 'JwtUser', 420, y_user)
    vline(page, DEP, 'TokenRevocationService', 'JwtUser', 484)
    x_turn = 390
    arrow(page, DEP, 'JwtAuthGuard', 'JwtUser', [(right_edge(page, 'JwtAuthGuard'), 122), (x_turn, 122),
                                                 (x_turn, y_user + 25), (420, y_user + 25)])
    hline(page, DEP, 'RolesGuard', 'JwtUser', y_user + 60)
    uml_class(page, 'Role', 420, bottom_edge(page, 'JwtUser') + GAP)
    vline(page, ASSOC, 'JwtUser', 'Role', 484)
    y_role = box(page, 'Role')[1] + 50
    arrow(page, DEP, 'RolesGuard', 'Role', [(300, bottom_edge(page, 'RolesGuard')), (300, y_role), (420, y_role)])

    y_err = bottom_edge(page, 'Role') + GAP
    uml_class(page, 'ProblemDetailsFilter', 1, y_err)
    y_exc = bottom_edge(page, 'ProblemDetailsFilter') + GAP
    uml_class(page, 'ProblemException', 1, y_exc)
    vline(page, DEP, 'ProblemDetailsFilter', 'ProblemException', 110)
    ref_class(page, 'HttpException', 1, bottom_edge(page, 'ProblemException') + GAP)
    vline(page, GEN, 'ProblemException', 'HttpException', 1 + ref_width('HttpException') / 2)
    uml_class(page, 'ProblemDetails', 300, y_exc)
    hline(page, ASSOC, 'ProblemException', 'ProblemDetails', y_exc + 33)
    vline(page, DEP, 'ProblemDetailsFilter', 'ProblemDetails', 311)
    fe_w = class_size('FieldError')[0]
    uml_class(page, 'FieldError', WIDTH - 1 - fe_w, y_err)
    vline(page, ASSOC, 'ProblemDetails', 'FieldError', right_edge(page, 'ProblemDetails') - 7,
          ('0..*', 'below-right'))
    return page


def common_events_page():
    """libs/common: outbox и ретранслятор у отправителя, inbox и обработчики у получателя."""
    page = Page('Классы: libs/common – события', 'cls-common-events')
    uml_class(page, 'OutboxService', 1, 1)
    y = bottom_edge(page, 'OutboxService') + GAP
    uml_class(page, 'OutboxMessage', 1, y)
    vline(page, DEP, 'OutboxService', 'OutboxMessage', 110)
    relay_w = class_size('OutboxRelay')[0]
    uml_class(page, 'OutboxRelay', WIDTH - 1 - relay_w, y)
    hline(page, DEP, 'OutboxRelay', 'OutboxMessage', y + 53)
    pub_w = class_size('RabbitPublisher')[0]
    uml_class(page, 'RabbitPublisher', WIDTH - 1 - pub_w, bottom_edge(page, 'OutboxRelay') + GAP)
    vline(page, ASSOC, 'OutboxRelay', 'RabbitPublisher', WIDTH - 1 - relay_w / 2)
    hline(page, DEP, 'RabbitPublisher', 'OutboxMessage', box(page, 'RabbitPublisher')[1] + 43)

    x0 = 41                                   # слева коридор для линии к обработчикам
    uml_class(page, 'RabbitConsumer', x0, bottom_edge(page, 'RabbitPublisher') + GAP)
    uml_class(page, 'InboxService', x0, bottom_edge(page, 'RabbitConsumer') + GAP)
    vline(page, ASSOC, 'RabbitConsumer', 'InboxService', 180)
    uml_class(page, 'EventHandler', x0, bottom_edge(page, 'InboxService') + GAP)
    vline(page, DEP, 'InboxService', 'EventHandler', 230)
    y_from = box(page, 'RabbitConsumer')[1] + 117
    y_to = box(page, 'EventHandler')[1] + 53
    arrow(page, ASSOC, 'RabbitConsumer', 'EventHandler', [(x0, y_from), (20, y_from), (20, y_to), (x0, y_to)],
          ('0..*', 'below-left'))
    pe_w = class_size('ProcessedEvent')[0]
    uml_class(page, 'ProcessedEvent', WIDTH - 1 - pe_w, box(page, 'InboxService')[1])
    hline(page, DEP, 'InboxService', 'ProcessedEvent', box(page, 'InboxService')[1] + 43)
    return page


def contracts_events_page():
    """libs/contracts: конверт события и данные пяти событий; конверт несёт одно из них."""
    page = Page('Классы: libs/contracts – события', 'cls-contracts-events')
    uml_class(page, 'EventEnvelope<T>', 1, 1)
    env_x, env_y, env_w, env_h = box(page, 'EventEnvelope<T>')
    x = env_x + env_w + 40
    for name in ('UserRegistered', 'PetHungry'):
        uml_class(page, name, x, 1)
        x = right_edge(page, name) + 30
    y_bus = env_y + env_h + 20
    y2 = y_bus + GAP
    x = 1
    for name in ('PetSick', 'PetEvolved', 'PetDied'):
        uml_class(page, name, x, y2)
        x = right_edge(page, name) + 30
    x_from = env_x + env_w / 2
    for name in ('UserRegistered', 'PetHungry', 'PetSick', 'PetEvolved', 'PetDied'):
        bx, by, bw, bh = box(page, name)
        x_to = bx + bw / 2
        end = (x_to, by + bh) if by < y_bus else (x_to, by)
        if abs(x_to - x_from) < 1:
            points = [(x_from, env_y + env_h), end]
        else:
            points = [(x_from, env_y + env_h), (x_from, y_bus), (x_to, y_bus), end]
        arrow(page, ASSOC, 'EventEnvelope<T>', name, points)
    return page


def grpc_contract_page():
    """gRPC PetCare: контракт из pets.proto, сервер в pets-service и клиент в care-service."""
    page = Page('Классы: gRPC PetCare – контракт, сервер, клиент', 'cls-grpc')
    uml_class(page, 'PetCareGrpcController', 1, 1)
    uml_class(page, 'PetCare', 1, bottom_edge(page, 'PetCareGrpcController') + GAP)
    vline(page, REAL, 'PetCareGrpcController', 'PetCare', 200)
    uml_class(page, 'PetCareClient', 1, bottom_edge(page, 'PetCare') + GAP)
    vline(page, ASSOC, 'PetCareClient', 'PetCare', 200)
    # сообщения внизу; ствол от интерфейса идёт справа от клиента к шине над ними
    y_bus = bottom_edge(page, 'PetCareClient') + 20
    y = y_bus + 20
    uml_class(page, 'ApplyCareActionRequest', 1, y)
    uml_class(page, 'GetPetSnapshotRequest', 1, bottom_edge(page, 'ApplyCareActionRequest') + 30)
    snap_w = class_size('PetSnapshot')[0]
    uml_class(page, 'PetSnapshot', WIDTH - 1 - snap_w, y)
    px, py, pw, ph = box(page, 'PetCare')
    x_trunk = right_edge(page, 'PetCareClient') + 50
    sx = box(page, 'PetSnapshot')[0]
    arrow(page, DEP, 'PetCare', 'PetSnapshot', [(x_trunk, py + ph), (x_trunk, y)])
    ax, ay, aw, ah = box(page, 'ApplyCareActionRequest')
    arrow(page, DEP, 'PetCare', 'ApplyCareActionRequest', [(x_trunk, py + ph), (x_trunk, y_bus),
                                                          (ax + aw / 2, y_bus), (ax + aw / 2, y)])
    gx, gy, gw, gh = box(page, 'GetPetSnapshotRequest')
    x_side = (ax + aw + sx) / 2
    arrow(page, DEP, 'PetCare', 'GetPetSnapshotRequest', [(x_trunk, py + ph), (x_trunk, y_bus), (x_side, y_bus),
                                                         (x_side, gy + gh / 2), (gx + gw, gy + gh / 2)])
    return page


def users_auth_page():
    """users-service: регистрация, вход, выход."""
    page = Page('Классы: users-service – регистрация и вход', 'cls-users-auth')
    uml_class(page, 'AuthController', 1, 1)
    w_dto = max(class_size(n)[0] for n in ('RegisterDto', 'LoginDto', 'AuthTokenDto'))
    x_dto = WIDTH - 1 - w_dto
    y = 1
    for name in ('RegisterDto', 'LoginDto', 'AuthTokenDto'):
        uml_class(page, name, x_dto, y, w_dto)
        y = bottom_edge(page, name) + 12
    ax, ay, aw, ah = box(page, 'AuthController')
    y0 = box(page, 'RegisterDto')[1] + class_size('RegisterDto')[1] / 2
    x_trunk = (ax + aw + x_dto) / 2
    for name in ('RegisterDto', 'LoginDto', 'AuthTokenDto'):
        bx, by, bw, bh = box(page, name)
        y_to = by + bh / 2
        points = [(ax + aw, y0), (x_dto, y0)] if y_to == y0 else \
            [(ax + aw, y0), (x_trunk, y0), (x_trunk, y_to), (x_dto, y_to)]
        arrow(page, DEP, 'AuthController', name, points)
    uml_class(page, 'AuthService', 1, ay + ah + GAP, aw)
    vline(page, ASSOC, 'AuthController', 'AuthService', aw / 2)
    sx, sy, sw, sh = box(page, 'AuthService')
    # событие и сущность – справа от сервиса, под колонкой DTO
    ref_class(page, 'User', x_dto, sy + sh - 10 - HEAD / 2)
    ref_class(page, 'UserRegistered', x_dto, box(page, 'User')[1] - 10 - HEAD)
    hline(page, DEP, 'AuthService', 'UserRegistered', box(page, 'UserRegistered')[1] + HEAD / 2)
    hline(page, DEP, 'AuthService', 'User', box(page, 'User')[1] + HEAD / 2)
    uml_class(page, 'JwtTokenService', 1, sy + sh + GAP)
    vline(page, ASSOC, 'AuthService', 'JwtTokenService', 120)
    jx, jy, jw, jh = box(page, 'JwtTokenService')
    ux, uy, uw, uh = box(page, 'User')
    arrow(page, DEP, 'JwtTokenService', 'User', [(jx + jw, jy + jh / 2), (ux + uw / 2, jy + jh / 2),
                                                 (ux + uw / 2, uy + uh)])
    uml_class(page, 'PasswordHasher', 1, jy + jh + GAP)
    vline(page, ASSOC + JUMP, 'AuthService', 'PasswordHasher', jx + jw + 40)
    uml_class(page, 'Argon2PasswordHasher', 1, bottom_edge(page, 'PasswordHasher') + GAP)
    vline(page, REAL, 'Argon2PasswordHasher', 'PasswordHasher', 190)
    return page


def users_profile_page():
    """users-service: профиль игрока и смена пароля."""
    page = Page('Классы: users-service – профиль', 'cls-users-profile')
    x = 1
    for name in ('UserDto', 'UpdateUserDto', 'ChangePasswordDto'):
        uml_class(page, name, x, 1)
        x = right_edge(page, name) + 40
    # DTO над контроллером: общий ствол вверх и шина под самым высоким DTO
    y_bus = bottom_edge(page, 'UserDto') + 20
    uml_class(page, 'UsersController', 1, y_bus + 20)
    bus_up(page, DEP, 'UsersController', ('UserDto', 'UpdateUserDto', 'ChangePasswordDto'), 190, y_bus)
    uml_class(page, 'UsersService', 1, bottom_edge(page, 'UsersController') + GAP)
    vline(page, ASSOC, 'UsersController', 'UsersService', 150)
    y = bottom_edge(page, 'UsersService') + GAP
    uml_class(page, 'User', 1, y)
    vline(page, DEP, 'UsersService', 'User', 100)
    ref_class(page, 'PasswordHasher', 300, y, 'interface')
    vline(page, ASSOC, 'UsersService', 'PasswordHasher', 300 + 60)
    return page


def pets_api_page():
    """pets-service: питомцы игрока – запросы, контроллер, ответы."""
    page = Page('Классы: pets-service – API питомцев', 'cls-pets-api')
    requests = ('CreatePetDto', 'RenamePetDto', 'PetsQuery')
    x = 1
    for name in requests:
        uml_class(page, name, x, 1)
        x = right_edge(page, name) + 40
    y_bus = bottom_edge(page, 'CreatePetDto') + 20
    uml_class(page, 'PetsController', 1, y_bus + 20)
    bus_up(page, DEP, 'PetsController', requests, 190, y_bus)
    cx, cy, cw, ch = box(page, 'PetsController')
    y_field = field_y(page, 'PetsController', 0)
    ref_class(page, 'PetsService', cx + cw + 60, y_field - HEAD / 2)
    hline(page, ASSOC, 'PetsController', 'PetsService', y_field)
    uml_class(page, 'PetDto', 1, cy + ch + GAP)
    vline(page, DEP, 'PetsController', 'PetDto', 136)
    dx, dy, dw, dh = box(page, 'PetDto')
    y_form = field_y(page, 'PetDto', 3)
    uml_class(page, 'PetFormDto', dx + dw + 40, y_form - class_size('PetFormDto')[1] / 2)
    hline(page, ASSOC, 'PetDto', 'PetFormDto', y_form)
    # хронология – справа внизу, линия к ней обходит PetFormDto справа
    uml_class(page, 'PetEventDto', WIDTH - 1 - class_size('PetEventDto')[0], bottom_edge(page, 'PetFormDto') + GAP)
    ex, ey, ew, eh = box(page, 'PetEventDto')
    y_turn = cy + ch + 20
    arrow(page, DEP, 'PetsController', 'PetEventDto', [(350, cy + ch), (350, y_turn), (ex + ew / 2, y_turn),
                                                       (ex + ew / 2, ey)])
    return page


def pets_services_page():
    """pets-service: применение ухода по gRPC и сервис питомцев игрока."""
    page = Page('Классы: pets-service – уход и питомцы игрока', 'cls-pets-services')
    uml_class(page, 'PetCareService', 1, 1)
    sx, sy, sw, sh = box(page, 'PetCareService')
    y_rules = field_y(page, 'PetCareService', 1)
    ref_class(page, 'GameRules', sx + sw + 60, y_rules - HEAD / 2)
    hline(page, ASSOC, 'PetCareService', 'GameRules', y_rules)
    y_applied = sy + sh - 15
    ref_class(page, 'AppliedCareAction', WIDTH - 1 - ref_width('AppliedCareAction'), y_applied - HEAD / 2)
    hline(page, DEP, 'PetCareService', 'AppliedCareAction', y_applied)
    uml_class(page, 'CareRules', 1, sy + sh + GAP)
    vline(page, DEP, 'PetCareService', 'CareRules', 200)
    uml_class(page, 'CareOutcome', 1, bottom_edge(page, 'CareRules') + GAP)
    vline(page, DEP, 'CareRules', 'CareOutcome', 50)
    ox, oy, ow, oh = box(page, 'CareOutcome')
    y_pet = field_y(page, 'CareOutcome', 0)
    ref_class(page, 'Pet', ox + ow + 60, y_pet - HEAD / 2)
    hline(page, ASSOC, 'CareOutcome', 'Pet', y_pet)
    x_event = 76
    ref_class(page, 'PetEvent', x_event, oy + oh + GAP)
    vline(page, ASSOC, 'CareOutcome', 'PetEvent', x_event + ref_width('PetEvent') / 2, ('0..*', 'above-right'))
    x_form = 311
    ref_class(page, 'PetForm', x_form, oy + oh + GAP)
    # сервис питомцев внизу: зависимости вверх к сущностям
    uml_class(page, 'PetsService', 1, bottom_edge(page, 'PetEvent') + GAP)
    px, py, pw, ph = box(page, 'Pet')
    vline(page, DEP, 'PetsService', 'Pet', px + pw / 2)
    vline(page, DEP, 'PetsService', 'PetEvent', x_event + ref_width('PetEvent') / 2)
    vline(page, DEP, 'PetsService', 'PetForm', x_form + ref_width('PetForm') / 2)
    return page


def pets_lifecycle_page():
    """pets-service: планировщик тиков, перемотка времени и чистая функция simulate."""
    page = Page('Классы: pets-service – жизненный цикл', 'cls-pets-lifecycle')
    uml_class(page, 'TimeTravelDto', 1, 1)
    x_dto = 264
    ref_class(page, 'PetDto', x_dto, 19)
    uml_class(page, 'LifecycleScheduler', WIDTH - 1 - class_size('LifecycleScheduler')[0], 1)
    uml_class(page, 'AdminPetsController', 1, bottom_edge(page, 'TimeTravelDto') + GAP)
    vline(page, DEP, 'AdminPetsController', 'TimeTravelDto', 100)
    vline(page, DEP, 'AdminPetsController', 'PetDto', x_dto + ref_width('PetDto') / 2)
    uml_class(page, 'LifecycleService', 1, bottom_edge(page, 'AdminPetsController') + GAP)
    vline(page, ASSOC, 'AdminPetsController', 'LifecycleService', 200)
    lx, ly, lw, lh = box(page, 'LifecycleService')
    hx, hy, hw, hh = box(page, 'LifecycleScheduler')
    arrow(page, ASSOC, 'LifecycleScheduler', 'LifecycleService', [(hx + hw / 2, hy + hh), (hx + hw / 2, ly + 15),
                                                                  (lx + lw, ly + 15)])
    uml_class(page, 'Simulation', 1, ly + lh + GAP)
    vline(page, DEP, 'LifecycleService', 'Simulation', 100)
    mx, my, mw, mh = box(page, 'Simulation')
    uml_class(page, 'SimulationResult', 1, my + mh + GAP)
    vline(page, DEP, 'Simulation', 'SimulationResult', 160)
    uml_class(page, 'GameRules', WIDTH - 1 - class_size('GameRules')[0], my + mh + GAP)
    vline(page, DEP, 'Simulation', 'GameRules', 400)
    y_rules = field_y(page, 'LifecycleService', 2)
    gx, gy, gw, gh = box(page, 'GameRules')
    arrow(page, ASSOC, 'LifecycleService', 'GameRules', [(lx + lw, y_rules), (580, y_rules), (580, gy)])
    # результат симуляции: питомец, строки хронологии и события для outbox
    y_refs = gy + gh + GAP
    ref_class(page, 'Pet', 1, y_refs)
    vline(page, ASSOC, 'SimulationResult', 'Pet', 1 + ref_width('Pet') / 2)
    x_event = 84
    ref_class(page, 'PetEvent', x_event, y_refs)
    vline(page, ASSOC, 'SimulationResult', 'PetEvent', x_event + ref_width('PetEvent') / 2, ('0..*', 'above-right'))
    ex, ey, ew, eh = ref_class(page, 'EventEnvelope<T>', 213, y_refs)
    rx, ry, rw, rh = box(page, 'SimulationResult')
    y_turn = y_refs - 20
    arrow(page, ASSOC, 'SimulationResult', 'EventEnvelope<T>', [(200, ry + rh), (200, y_turn), (ex + ew / 2, y_turn),
                                                                (ex + ew / 2, ey)], ('0..*', 'above-right'))
    return page


def pets_entities_page():
    """pets-service: сущности TypeORM, связи с кратностями и перечисления."""
    page = Page('Классы: pets-service – сущности', 'cls-pets-entities')
    uml_class(page, 'Pet', 1, 1)
    px, py, pw, ph = box(page, 'Pet')
    x_right = px + pw + 40
    y_form = field_y(page, 'Pet', 4)
    uml_class(page, 'PetForm', x_right, y_form - class_size('PetForm')[1] / 2)
    hline(page, ASSOC, 'Pet', 'PetForm', y_form, ('1', 'below-left'), ('0..*', 'above-right'))
    for name, above in (('PetEvent', 'PetForm'), ('AppliedCareAction', 'PetEvent')):
        uml_class(page, name, x_right, bottom_edge(page, above) + GAP)
        hline(page, ASSOC, name, 'Pet', field_y(page, name, 1), ('1', 'below-right'), ('0..*', 'above-left'))
    # перечисления под питомцем
    y_enum = py + ph + GAP
    uml_class(page, 'Attention', 1, y_enum)
    vline(page, ASSOC, 'Pet', 'Attention', 1 + class_size('Attention')[0] / 2, ('0..1', 'above-right'))
    x_death = 177
    uml_class(page, 'DeathCause', x_death, y_enum)
    vline(page, ASSOC, 'Pet', 'DeathCause', x_death + class_size('DeathCause')[0] / 2, ('0..1', 'above-left'))
    x_stage = 347
    uml_class(page, 'Stage', x_stage, y_enum)
    sx, sy, sw, sh = box(page, 'Stage')
    arrow(page, ASSOC, 'Pet', 'Stage', [(260, py + ph), (260, y_enum - 20), (sx + sw / 2, y_enum - 20),
                                        (sx + sw / 2, sy)])
    fx, fy, fw, fh = box(page, 'PetForm')
    y_stage = field_y(page, 'PetForm', 1)
    arrow(page, ASSOC, 'PetForm', 'Stage', [(fx + fw, y_stage), (560, y_stage), (560, sy + 97), (sx + sw, sy + 97)])
    return page


def care_catalog_api_page():
    """care-service: каталог предметов – запросы, контроллер, ответы."""
    page = Page('Классы: care-service – каталог: API', 'cls-care-catalog-api')
    requests = ('ItemsQuery', 'IconDto')
    x = 1
    for name in requests:
        uml_class(page, name, x, 1)
        x = right_edge(page, name) + 40
    y_bus = bottom_edge(page, 'ItemsQuery') + 20
    uml_class(page, 'ItemsController', 1, y_bus + 20)
    bus_up(page, DEP, 'ItemsController', requests, 190, y_bus)
    cx, cy, cw, ch = box(page, 'ItemsController')
    y_field = field_y(page, 'ItemsController', 0)
    ref_class(page, 'ItemsService', cx + cw + 40, y_field - HEAD / 2)
    hline(page, ASSOC, 'ItemsController', 'ItemsService', y_field)
    y = cy + ch + GAP
    uml_class(page, 'CreateItemDto', 1, y)
    vline(page, DEP, 'ItemsController', 'CreateItemDto', 110)
    uml_class(page, 'ItemDto', right_edge(page, 'CreateItemDto') + 40, y)
    vline(page, DEP, 'ItemsController', 'ItemDto', 368)
    # изменение: поля нового предмета, все необязательные (PartialType), и признак isActive
    kx, ky, kw, kh = box(page, 'CreateItemDto')
    uw = class_size('UpdateItemDto')[0]
    uml_class(page, 'UpdateItemDto', kx + (kw - uw) / 2, ky + kh + GAP)
    ux, uy, uw, uh = box(page, 'UpdateItemDto')
    vline(page, GEN, 'UpdateItemDto', 'CreateItemDto', 80)
    x_gap = (kx + kw + box(page, 'ItemDto')[0]) / 2
    arrow(page, DEP, 'ItemsController', 'UpdateItemDto', [(x_gap, cy + ch), (x_gap, uy + uh / 2), (ux + uw, uy + uh / 2)])
    return page


def care_catalog_service_page():
    """care-service: сервис каталога, кэш в Redis и иконки в Silo."""
    page = Page('Классы: care-service – каталог: сервис, кэш, хранилище', 'cls-care-catalog-service')
    uml_class(page, 'ItemsService', 1, 1)
    sx, sy, sw, sh = box(page, 'ItemsService')
    y_items = field_y(page, 'ItemsService', 0)
    ref_class(page, 'Item', sx + sw + 60, y_items - HEAD / 2)
    hline(page, DEP, 'ItemsService', 'Item', y_items)
    x0 = 41                                   # слева коридор для линии к хранилищу
    uml_class(page, 'ItemCatalogCache', x0, sy + sh + GAP)
    vline(page, ASSOC, 'ItemsService', 'ItemCatalogCache', 150)
    uml_class(page, 'IconStorage', x0, bottom_edge(page, 'ItemCatalogCache') + GAP)
    ix, iy, iw, ih = box(page, 'IconStorage')
    arrow(page, ASSOC, 'ItemsService', 'IconStorage', [(20, sy + sh), (20, iy + ih / 2), (x0, iy + ih / 2)])
    kx, ky, kw, kh = box(page, 'ItemCatalogCache')
    ref_class(page, 'ItemDto', 405, ky + kh / 2 - HEAD / 2)
    hline(page, DEP, 'ItemCatalogCache', 'ItemDto', ky + kh / 2)
    vline(page, DEP, 'ItemsService', 'ItemDto', 445)
    return page


def care_shop_api_page():
    """care-service: покупка, кошелёк и инвентарь – контроллеры и DTO."""
    page = Page('Классы: care-service – магазин, кошелёк, инвентарь: API', 'cls-care-shop-api')
    ref_class(page, 'ShopService', 1, 1)
    x_inv = WIDTH - 1 - class_size('InventoryController')[0]
    ref_class(page, 'InventoryService', x_inv, 1)
    y = HEAD + GAP + 1
    uml_class(page, 'PurchasesController', 1, y)
    vline(page, ASSOC, 'PurchasesController', 'ShopService', 1 + ref_width('ShopService') / 2)
    uml_class(page, 'InventoryController', x_inv, y)
    vline(page, ASSOC, 'InventoryController', 'InventoryService', x_inv + ref_width('InventoryService') / 2)
    y = bottom_edge(page, 'PurchasesController') + GAP
    uml_class(page, 'PurchaseDto', 1, y)
    vline(page, DEP, 'PurchasesController', 'PurchaseDto', 120)
    uml_class(page, 'PurchaseResultDto', 201, y)
    vline(page, DEP, 'PurchasesController', 'PurchaseResultDto', 288)
    uml_class(page, 'InventoryItemDto', 422, y)
    vline(page, DEP, 'InventoryController', 'InventoryItemDto', 560)
    x_item = 462
    ref_class(page, 'ItemDto', x_item, bottom_edge(page, 'InventoryItemDto') + GAP)
    vline(page, ASSOC, 'InventoryItemDto', 'ItemDto', x_item + ref_width('ItemDto') / 2)
    # кошелёк
    y = max(bottom_edge(page, 'PurchaseResultDto'), bottom_edge(page, 'ItemDto')) + GAP
    uml_class(page, 'WalletController', 1, y)
    y_field = field_y(page, 'WalletController', 0)
    ref_class(page, 'WalletService', 276, y_field - HEAD / 2)
    hline(page, ASSOC, 'WalletController', 'WalletService', y_field)
    uml_class(page, 'WalletTransactionDto', WIDTH - 1 - class_size('WalletTransactionDto')[0], y)
    y = bottom_edge(page, 'WalletTransactionDto') + GAP
    uml_class(page, 'WalletQuery', 1, y)
    vline(page, DEP, 'WalletController', 'WalletQuery', 66)
    uml_class(page, 'WalletDto', 172, y)
    vline(page, DEP, 'WalletController', 'WalletDto', 209)
    vline(page, ASSOC, 'WalletDto', 'WalletTransactionDto', 452, ('0..*', 'below-right'))
    return page


def care_shop_services_page():
    """care-service: покупка одной транзакцией, кошелёк с журналом, инвентарь."""
    page = Page('Классы: care-service – магазин, кошелёк, инвентарь: сервисы', 'cls-care-shop-services')
    uml_class(page, 'ShopService', 1, 1)
    sx, sy, sw, sh = box(page, 'ShopService')
    y_field = field_y(page, 'ShopService', 0)
    ref_class(page, 'Purchase', sx + sw + 40, y_field - HEAD / 2)
    hline(page, DEP, 'ShopService', 'Purchase', y_field)
    uml_class(page, 'InventoryService', 1, sy + sh + GAP)
    vline(page, ASSOC, 'ShopService', 'InventoryService', 100)
    ix, iy, iw, ih = box(page, 'InventoryService')
    x_right = 428
    ref_class(page, 'InventoryItem', x_right, iy)
    hline(page, DEP, 'InventoryService', 'InventoryItem', iy + HEAD / 2)
    uml_class(page, 'InventoryChange', x_right, iy + HEAD + 20)
    hline(page, DEP, 'InventoryService', 'InventoryChange', field_y(page, 'InventoryChange', 1))
    uml_class(page, 'WalletService', 1, iy + ih + GAP)
    wx, wy, ww, wh = box(page, 'WalletService')
    # к кошельку – по коридору справа, мимо инвентаря
    y_wallet = field_y(page, 'WalletService', 2) + 7
    arrow(page, ASSOC, 'ShopService', 'WalletService', [(sx + sw, sy + sh - 15), (600, sy + sh - 15),
                                                         (600, y_wallet), (wx + ww, y_wallet)])
    y = wy + wh + GAP
    uml_class(page, 'WalletChange', 1, y)
    vline(page, DEP, 'WalletService', 'WalletChange', 90)
    x_wallet = 221
    ref_class(page, 'Wallet', x_wallet, y)
    vline(page, DEP, 'WalletService', 'Wallet', x_wallet + ref_width('Wallet') / 2)
    tx, ty, tw, th = ref_class(page, 'WalletTransaction', 328, y)
    arrow(page, DEP, 'WalletService', 'WalletTransaction', [(360, wy + wh), (360, y - 20), (tx + tw / 2, y - 20),
                                                            (tx + tw / 2, ty)])
    return page


def care_actions_api_page():
    """care-service: действия ухода – запросы, контроллер, ответы."""
    page = Page('Классы: care-service – действия ухода: API', 'cls-care-actions-api')
    requests = ('CreateCareActionDto', 'CareActionsQuery')
    x = 1
    for name in requests:
        uml_class(page, name, x, 1)
        x = right_edge(page, name) + 40
    y_bus = bottom_edge(page, 'CreateCareActionDto') + 20
    uml_class(page, 'CareActionsController', 1, y_bus + 20)
    bus_up(page, DEP, 'CareActionsController', requests, 190, y_bus)
    cx, cy, cw, ch = box(page, 'CareActionsController')
    y_field = field_y(page, 'CareActionsController', 0)
    ref_class(page, 'CareActionsService', cx + cw + 40, y_field - HEAD / 2)
    hline(page, ASSOC, 'CareActionsController', 'CareActionsService', y_field)
    y = cy + ch + GAP
    uml_class(page, 'CareResultDto', 1, y)
    vline(page, DEP, 'CareActionsController', 'CareResultDto', 100)
    uml_class(page, 'CareActionDto', 280, y)
    vline(page, DEP, 'CareActionsController', 'CareActionDto', 330)
    hline(page, ASSOC, 'CareResultDto', 'CareActionDto', field_y(page, 'CareResultDto', 0))
    ref_class(page, 'PetSnapshot', 1, bottom_edge(page, 'CareResultDto') + GAP)
    vline(page, ASSOC, 'CareResultDto', 'PetSnapshot', 1 + ref_width('PetSnapshot') / 2)
    return page


def care_actions_service_page():
    """care-service: сага ухода, досылка зависших действий, сущность действия."""
    page = Page('Классы: care-service – действия ухода: сервис и данные', 'cls-care-actions-service')
    uml_class(page, 'CareActionRetrier', 1, 1)
    uml_class(page, 'CareActionsService', 1, bottom_edge(page, 'CareActionRetrier') + GAP)
    vline(page, ASSOC, 'CareActionRetrier', 'CareActionsService', 200)
    sx, sy, sw, sh = box(page, 'CareActionsService')
    y_refs = sy + sh + GAP
    x = 1
    for name in ('InventoryService', 'WalletService', 'PetCareClient'):
        ref_class(page, name, x, y_refs)
        vline(page, ASSOC, 'CareActionsService', name, x + ref_width(name) / 2)
        x += ref_width(name) + 40
    uml_class(page, 'CareAction', 1, y_refs + HEAD + GAP)
    # между ссылками на инвентарь и кошелёк
    vline(page, DEP, 'CareActionsService', 'CareAction', 1 + ref_width('InventoryService') + 20)
    ax, ay, aw, ah = box(page, 'CareAction')
    # перечисления – напротив своих полей: статус ближе, тип дальше, линия к типу проходит над статусом
    y_type, y_status = field_y(page, 'CareAction', 3), field_y(page, 'CareAction', 5)
    uml_class(page, 'CareStatus', ax + aw + 40, y_type + ROW)
    hline(page, ASSOC, 'CareAction', 'CareStatus', y_status)
    uml_class(page, 'CareType', right_edge(page, 'CareStatus') + 40, y_type - HEAD2 / 2)
    hline(page, ASSOC, 'CareAction', 'CareType', y_type)
    rx, ry, rw, rh = box(page, 'CareActionRetrier')
    y_back = ay + HEAD / 2
    arrow(page, DEP, 'CareActionRetrier', 'CareAction', [(rx + rw, field_y(page, 'CareActionRetrier', 1)),
                                                         (600, field_y(page, 'CareActionRetrier', 1)),
                                                         (600, y_back), (ax + aw, y_back)])
    return page


def care_handlers_page():
    """care-service: стартовый набор и награда за эволюцию по событиям из брокера."""
    page = Page('Классы: care-service – обработчики событий', 'cls-care-handlers')
    ref_class(page, 'UserRegistered', 1, 1)
    x_inv = 250
    ref_class(page, 'InventoryService', x_inv, 1)
    uml_class(page, 'StarterKitHandler', 1, HEAD + GAP + 1)
    vline(page, DEP, 'StarterKitHandler', 'UserRegistered', 1 + ref_width('UserRegistered') / 2)
    vline(page, ASSOC, 'StarterKitHandler', 'InventoryService', x_inv + ref_width('InventoryService') / 2)
    hx, hy, hw, hh = ref_class(page, 'EventHandler', 121, bottom_edge(page, 'StarterKitHandler') + GAP, 'interface')
    vline(page, REAL, 'StarterKitHandler', 'EventHandler', hx + hw / 2)
    uml_class(page, 'EvolutionRewardHandler', 1, hy + hh + GAP)
    vline(page, REAL, 'EvolutionRewardHandler', 'EventHandler', hx + hw / 2)
    ref_class(page, 'PetEvolved', 1, bottom_edge(page, 'EvolutionRewardHandler') + GAP)
    vline(page, DEP, 'EvolutionRewardHandler', 'PetEvolved', 1 + ref_width('PetEvolved') / 2)
    # кошелёк – справа между обработчиками
    wx, wy, ww, wh = ref_class(page, 'WalletService', WIDTH - 1 - ref_width('WalletService'), hy + hh / 2 - HEAD / 2)
    for name in ('StarterKitHandler', 'EvolutionRewardHandler'):
        nx, ny, nw, nh = box(page, name)
        y_field = field_y(page, name, 1)
        end = (wx + ww / 2, wy) if ny < wy else (wx + ww / 2, wy + wh)
        arrow(page, ASSOC, name, 'WalletService', [(nx + nw, y_field), (wx + ww / 2, y_field), end])
    return page


def care_entities_page():
    """care-service: сущности TypeORM, связи с кратностями и перечисления (кроме действия ухода)."""
    page = Page('Классы: care-service – сущности', 'cls-care-entities')
    uml_class(page, 'Item', 1, 1)
    uml_class(page, 'Category', 1, bottom_edge(page, 'Item') + GAP)
    vline(page, ASSOC, 'Item', 'Category', 66)
    x_right = right_edge(page, 'Item') + 40
    uml_class(page, 'InventoryItem', x_right, 1)
    hline(page, ASSOC, 'InventoryItem', 'Item', field_y(page, 'InventoryItem', 1), ('1', 'below-right'),
          ('0..*', 'above-left'))
    uml_class(page, 'Purchase', x_right, bottom_edge(page, 'InventoryItem') + GAP)
    hline(page, ASSOC, 'Purchase', 'Item', field_y(page, 'Purchase', 2), ('1', 'below-right'), ('0..*', 'above-left'))
    uml_class(page, 'Wallet', WIDTH - 1 - class_size('Wallet')[0], 1)
    uml_class(page, 'WalletTransaction', WIDTH - 1 - class_size('WalletTransaction')[0],
              bottom_edge(page, 'Purchase') + GAP)
    vline(page, ASSOC, 'WalletTransaction', 'Wallet', 542, ('1', 'below-right'), ('0..*', 'above-right'))
    tx, ty, tw, th = box(page, 'WalletTransaction')
    rw = class_size('Reason')[0]
    uml_class(page, 'Reason', WIDTH - 1 - rw, ty + th + GAP)
    vline(page, ASSOC, 'WalletTransaction', 'Reason', WIDTH - 1 - rw / 2)
    return page


def notifications_api_page():
    """notifications-service: уведомления игрока, счётчик, настройки и поток SSE."""
    page = Page('Классы: notifications-service – API и поток', 'cls-notif-api')
    uml_class(page, 'NotificationsController', 1, 1)
    cx, cy, cw, ch = box(page, 'NotificationsController')
    y_field = field_y(page, 'NotificationsController', 0)
    ref_class(page, 'NotificationsService', cx + cw + 40, y_field - HEAD / 2)
    hline(page, ASSOC, 'NotificationsController', 'NotificationsService', y_field)
    x_dto = WIDTH - 1 - class_size('SettingsDto')[0]
    uml_class(page, 'SettingsDto', x_dto, y_field + HEAD / 2 + 20)
    hline(page, DEP, 'NotificationsController', 'SettingsDto', field_y(page, 'SettingsDto', 1))
    uml_class(page, 'UnreadCountDto', x_dto, bottom_edge(page, 'SettingsDto') + 20)
    ux, uy, uw, uh = box(page, 'UnreadCountDto')
    hline(page, DEP, 'NotificationsController', 'UnreadCountDto', uy + 9)
    x0 = 41                                   # слева коридор для линии к потоку
    y = max(cy + ch, uy + uh) + GAP
    uml_class(page, 'NotificationsQuery', x0, y)
    vline(page, DEP, 'NotificationsController', 'NotificationsQuery', 100)
    x_page = right_edge(page, 'NotificationsQuery') + 40
    uml_class(page, 'NotificationPageDto', x_page, y)
    vline(page, DEP, 'NotificationsController', 'NotificationPageDto', 300)
    uml_class(page, 'NotificationDto', x_page, bottom_edge(page, 'NotificationPageDto') + GAP)
    vline(page, ASSOC, 'NotificationPageDto', 'NotificationDto', 400, ('0..*', 'above-right'))
    nx, ny, nw, nh = box(page, 'NotificationDto')
    x_gap = (right_edge(page, 'NotificationsQuery') + x_page) / 2
    arrow(page, DEP, 'NotificationsController', 'NotificationDto', [(x_gap, cy + ch), (x_gap, ny + nh / 2),
                                                                    (nx, ny + nh / 2)])
    uml_class(page, 'NotificationStream', 1, ny + nh + GAP)
    sx, sy, sw, sh = box(page, 'NotificationStream')
    arrow(page, ASSOC, 'NotificationsController', 'NotificationStream', [(20, cy + ch), (20, sy)])
    vline(page, DEP, 'NotificationStream', 'NotificationDto', 340)
    return page


def notifications_handlers_page():
    """notifications-service: приветствие и уведомления о питомце по событиям из брокера."""
    page = Page('Классы: notifications-service – обработчики событий', 'cls-notif-handlers')
    x0 = 41                                   # слева коридор для линии к текстам
    uml_class(page, 'WelcomeHandler', x0, 1)
    hx, hy, hw, hh = ref_class(page, 'EventHandler', 141, bottom_edge(page, 'WelcomeHandler') + GAP, 'interface')
    vline(page, REAL, 'WelcomeHandler', 'EventHandler', hx + hw / 2)
    uml_class(page, 'PetEventsHandler', x0, hy + hh + GAP)
    vline(page, REAL, 'PetEventsHandler', 'EventHandler', hx + hw / 2)
    nx, ny, nw, nh = ref_class(page, 'NotificationsService', WIDTH - 1 - ref_width('NotificationsService'),
                               hy + hh / 2 - HEAD / 2)
    for name in ('WelcomeHandler', 'PetEventsHandler'):
        bx, by, bw, bh = box(page, name)
        y_field = field_y(page, name, 1)
        end = (nx + nw / 2, ny) if by < ny else (nx + nw / 2, ny + nh)
        arrow(page, ASSOC, name, 'NotificationsService', [(bx + bw, y_field), (nx + nw / 2, y_field), end])
    uml_class(page, 'NotificationTexts', x0, bottom_edge(page, 'PetEventsHandler') + GAP)
    vline(page, DEP, 'PetEventsHandler', 'NotificationTexts', 100)
    tx, ty, tw, th = box(page, 'NotificationTexts')
    wx, wy, ww, wh = box(page, 'WelcomeHandler')
    y_from = wy + wh - 12
    arrow(page, DEP, 'WelcomeHandler', 'NotificationTexts', [(x0, y_from), (20, y_from), (20, ty + th / 2),
                                                             (x0, ty + th / 2)])
    uml_class(page, 'NewNotification', WIDTH - 1 - class_size('NewNotification')[0], ty)
    hline(page, DEP, 'NotificationTexts', 'NewNotification', ty + th / 2)
    vline(page, DEP, 'NotificationsService', 'NewNotification', 600)
    return page


def notifications_data_page():
    """notifications-service: сервис уведомлений, сущности и тип уведомления."""
    page = Page('Классы: notifications-service – сервис и данные', 'cls-notif-data')
    uml_class(page, 'NotificationsService', 1, 1)
    sx, sy, sw, sh = box(page, 'NotificationsService')
    y = sy + sh + GAP
    uml_class(page, 'Notification', 1, y)
    vline(page, DEP, 'NotificationsService', 'Notification', 100)
    uml_class(page, 'NotificationSettings', 238, y)
    vline(page, DEP, 'NotificationsService', 'NotificationSettings', 332)
    tx, ty, tw, th = ref_class(page, 'NotificationStream', WIDTH - 1 - ref_width('NotificationStream'), y)
    arrow(page, ASSOC, 'NotificationsService', 'NotificationStream', [(460, sy + sh), (460, y - 20),
                                                                      (tx + tw / 2, y - 20), (tx + tw / 2, ty)])
    kx, ky, kw, kh = ref_class(page, 'NewNotification', WIDTH - 1 - ref_width('NewNotification'), y + HEAD + GAP)
    arrow(page, DEP, 'NotificationsService', 'NewNotification', [(440, sy + sh), (440, ky + kh / 2), (kx, ky + kh / 2)])
    uml_class(page, 'NotificationType', 1, bottom_edge(page, 'Notification') + GAP)
    vline(page, ASSOC, 'Notification', 'NotificationType', 76)
    return page


# ======================================================================== классы: лист на сервис
# Для записки: основные классы сервиса с полями и методами, остальные только именем (полностью
# они на листах «Классы подробно.drawio»). DTO и перечисления – в API-контрактах и на подробных листах.

def users_page():
    """users-service: контроллеры, сервисы и User полностью; токены, хэш пароля и событие – именем."""
    page = Page('Классы: users-service', 'cls-users')
    uml_class(page, 'AuthController', 1, 1)
    ax, ay, aw, ah = box(page, 'AuthController')
    uml_class(page, 'AuthService', 1, ay + ah + GAP, aw)
    vline(page, ASSOC, 'AuthController', 'AuthService', aw / 2)
    sx, sy, sw, sh = box(page, 'AuthService')
    uml_class(page, 'UsersController', 1, sy + sh + GAP)
    cx, cy, cw, ch = box(page, 'UsersController')
    uml_class(page, 'UsersService', 1, cy + ch + GAP)
    vline(page, ASSOC, 'UsersController', 'UsersService', aw / 2)
    ux, uy, uw, uh = box(page, 'UsersService')
    # User справа сверху; от AuthService вправо – по строкам его полей
    uml_class(page, 'User', WIDTH - 1 - class_size('User')[0], 1)
    ex, ey, ew, eh = box(page, 'User')
    hline(page, DEP, 'AuthService', 'User', sy + HEAD / 2)
    y_outbox = field_y(page, 'AuthService', 1)
    ref_class(page, 'UserRegistered', sx + sw + 40, y_outbox - HEAD / 2)
    hline(page, DEP, 'AuthService', 'UserRegistered', y_outbox)
    y_tokens = field_y(page, 'AuthService', 3)
    ref_class(page, 'JwtTokenService', ex - 45, y_tokens - HEAD / 2)
    hline(page, ASSOC, 'AuthService', 'JwtTokenService', y_tokens)
    vline(page, DEP, 'JwtTokenService', 'User', right_edge(page, 'UserRegistered') + 22)
    # хэш пароля – справа от UsersController: к нему AuthService сверху, UsersService снизу
    hx, hy, hw, hh = ref_class(page, 'PasswordHasher', ex, cy + (ch - HEAD2) / 2, 'interface')
    y_hasher = field_y(page, 'AuthService', 5)
    x_down = hx + round(hw * 3 / 4)
    arrow(page, ASSOC, 'AuthService', 'PasswordHasher', [(sx + sw, y_hasher), (x_down, y_hasher), (x_down, hy)])
    vline(page, ASSOC, 'UsersService', 'PasswordHasher', hx + 30)
    x_side = WIDTH - 23
    y_users = field_y(page, 'UsersService', 0)
    arrow(page, DEP, 'UsersService', 'User', [(ux + uw, y_users), (x_side, y_users), (x_side, ey + eh)])
    return page


def pets_page():
    """pets-service: три сервиса полностью – питомцы игрока, уход по gRPC, жизненный цикл."""
    page = Page('Классы: pets-service', 'cls-pets')
    ref_class(page, 'PetsController', 1, 1)
    ref_class(page, 'PetForm', 175, 1)
    ref_class(page, 'PetEvent', 300, 1)
    ref_class(page, 'Pet', WIDTH - 1 - ref_width('Pet'), 1)
    uml_class(page, 'PetsService', 1, 1 + HEAD + GAP)
    px, py, pw, ph = box(page, 'PetsService')
    vline(page, ASSOC, 'PetsController', 'PetsService', 68)
    for name in ('PetForm', 'PetEvent'):
        bx, by, bw, bh = box(page, name)
        vline(page, DEP, 'PetsService', name, round(bx + bw / 2))
    # все три сервиса работают с Pet: общий ствол по правому краю
    x_pet = WIDTH - 23

    def to_pet(name, y):
        x, _, w, _ = box(page, name)
        arrow(page, DEP, name, 'Pet', [(x + w, y), (x_pet, y), (x_pet, 1 + HEAD)])

    to_pet('PetsService', field_y(page, 'PetsService', 0))
    # уход по gRPC
    y = py + ph + GAP
    ref_class(page, 'PetCare', 243, y, 'interface')
    y_mid = y + HEAD2 / 2
    ref_class(page, 'PetCareGrpcController', 1, y_mid - HEAD / 2)
    ref_class(page, 'AppliedCareAction', 384, y_mid - HEAD / 2)
    hline(page, REAL, 'PetCareGrpcController', 'PetCare', y_mid)
    uml_class(page, 'PetCareService', 1, y + HEAD2 + GAP)
    cx, cy, cw, ch = box(page, 'PetCareService')
    vline(page, ASSOC, 'PetCareGrpcController', 'PetCareService', 100)
    vline(page, DEP, 'PetCareService', 'AppliedCareAction', cx + cw - 13)
    y_apply = method_y(page, 'PetCareService', 0)
    ref_class(page, 'CareRules', cx + cw + 40, y_apply - HEAD2 / 2, 'utility')
    hline(page, DEP, 'PetCareService', 'CareRules', y_apply)
    to_pet('PetCareService', cy + HEAD / 2)
    # жизненный цикл: тик по расписанию и перемотка времени для проверки
    y = cy + ch + GAP
    ref_class(page, 'LifecycleScheduler', 1, y)
    ref_class(page, 'AdminPetsController', 213, y)
    uml_class(page, 'LifecycleService', 1, y + HEAD + GAP)
    lx, ly, lw, lh = box(page, 'LifecycleService')
    vline(page, ASSOC, 'LifecycleScheduler', 'LifecycleService', 87)
    vline(page, ASSOC, 'AdminPetsController', 'LifecycleService', 306)
    y_due = method_y(page, 'LifecycleService', 0)
    ref_class(page, 'Simulation', lx + lw + 40, y_due - HEAD2 / 2, 'utility')
    hline(page, DEP, 'LifecycleService', 'Simulation', y_due)
    to_pet('LifecycleService', ly + HEAD / 2)
    return page


def care_page():
    """care-service: сервис действий ухода (сага) полностью; кошелёк, инвентарь, магазин, каталог –
    именем. К кошельку и инвентарю от обработчиков событий и магазина идут общие стволы."""
    page = Page('Классы: care-service', 'cls-care')
    ref_class(page, 'CareActionsController', 1, 1)
    ref_class(page, 'CareActionRetrier', 239, 1)
    ref_class(page, 'CareAction', 441, 1)
    uml_class(page, 'CareActionsService', 1, 1 + HEAD + GAP)
    ax, ay, aw, ah = box(page, 'CareActionsService')
    vline(page, ASSOC, 'CareActionsController', 'CareActionsService', 100)
    vline(page, ASSOC, 'CareActionRetrier', 'CareActionsService', 320)
    vline(page, DEP, 'CareActionsService', 'CareAction', 468)
    y = ay + ah + GAP
    ref_class(page, 'PetCareClient', 1, y)
    ref_class(page, 'InventoryService', 169, y)
    ref_class(page, 'WalletService', 363, y)
    ref_class(page, 'Wallet', 530, y)
    vline(page, ASSOC, 'CareActionsService', 'PetCareClient', 65)
    vline(page, ASSOC, 'CareActionsService', 'InventoryService', 250)
    vline(page, ASSOC, 'CareActionsService', 'WalletService', 380)
    hline(page, DEP, 'WalletService', 'Wallet', y + HEAD / 2)
    y_row = y + HEAD + GAP
    ref_class(page, 'InventoryItem', 246, y_row)
    ref_class(page, 'WalletTransaction', WIDTH - 1 - ref_width('WalletTransaction'), y_row)
    vline(page, DEP, 'InventoryService', 'InventoryItem', 310)
    vline(page, DEP, 'WalletService', 'WalletTransaction', 475)
    vline(page, ASSOC, 'WalletTransaction', 'Wallet', 565)
    x_inv, x_wallet, y_hub = 200, 420, y + HEAD

    def to_hubs(name):
        bx, by, bw, bh = box(page, name)
        yc = by + bh / 2
        arrow(page, ASSOC, name, 'InventoryService', [(bx, yc), (x_inv, yc), (x_inv, y_hub)])
        arrow(page, ASSOC, name, 'WalletService', [(bx + bw, yc), (x_wallet, yc), (x_wallet, y_hub)])

    y_row += HEAD + GAP
    ref_class(page, 'StarterKitHandler', 232, y_row)
    to_hubs('StarterKitHandler')
    y_row += HEAD + GAP
    sx, sy, sw, sh = ref_class(page, 'ShopService', 250, y_row)
    to_hubs('ShopService')
    y_row += HEAD + GAP
    ref_class(page, 'PurchasesController', 1, y_row)
    ref_class(page, 'Purchase', 290, y_row)
    y_turn = sy + sh + 20
    arrow(page, ASSOC, 'PurchasesController', 'ShopService', [(150, y_row), (150, y_turn), (265, y_turn),
                                                              (265, sy + sh)])
    vline(page, DEP, 'ShopService', 'Purchase', 330)
    y_row += HEAD + GAP
    ref_class(page, 'EvolutionRewardHandler', 311, y_row)
    arrow(page, ASSOC, 'EvolutionRewardHandler', 'WalletService', [(x_wallet, y_row), (x_wallet, y_hub)])
    # каталог: кэш в Redis, иконки в Silo
    y_row += HEAD + GAP
    ref_class(page, 'ItemsController', 1, y_row)
    ref_class(page, 'ItemsService', 183, y_row)
    ref_class(page, 'Item', 344, y_row)
    hline(page, ASSOC, 'ItemsController', 'ItemsService', y_row + HEAD / 2)
    hline(page, DEP, 'ItemsService', 'Item', y_row + HEAD / 2)
    y_row += HEAD + GAP
    ref_class(page, 'ItemCatalogCache', 70, y_row)
    ref_class(page, 'IconStorage', 275, y_row)
    vline(page, ASSOC, 'ItemsService', 'ItemCatalogCache', 200)
    vline(page, ASSOC, 'ItemsService', 'IconStorage', 290)
    return page


def notifications_page():
    """notifications-service: сервис, сущности и поток SSE полностью; обработчики и контроллер – именем."""
    page = Page('Классы: notifications-service', 'cls-notifications')
    ref_class(page, 'WelcomeHandler', 1, 1)
    ref_class(page, 'PetEventsHandler', 196, 1)
    ref_class(page, 'NotificationsController', 398, 1)
    uml_class(page, 'NotificationsService', 1, 1 + HEAD + GAP)
    nx, ny, nw, nh = box(page, 'NotificationsService')
    vline(page, ASSOC, 'WelcomeHandler', 'NotificationsService', 78)
    vline(page, ASSOC, 'PetEventsHandler', 'NotificationsService', 277)
    vline(page, ASSOC, 'NotificationsController', 'NotificationsService', 436)
    y = ny + nh + GAP
    uml_class(page, 'Notification', 1, y)
    uml_class(page, 'NotificationSettings', right_edge(page, 'Notification') + 40, y)
    sx, sy, sw, sh = box(page, 'NotificationSettings')
    vline(page, DEP, 'NotificationsService', 'Notification', 100)
    vline(page, DEP, 'NotificationsService', 'NotificationSettings', round(sx + sw / 2))
    uml_class(page, 'NotificationStream', 1, max(bottom_edge(page, 'Notification'), sy + sh) + GAP)
    tx, ty, tw, th = box(page, 'NotificationStream')
    vline(page, ASSOC, 'NotificationsService', 'NotificationStream', (right_edge(page, 'Notification') + sx) / 2)
    x_side = 580
    arrow(page, ASSOC, 'NotificationsController', 'NotificationStream',
          [(x_side, 1 + HEAD), (x_side, ty + th / 2), (tx + tw, ty + th / 2)])
    return page


# ======================================================================== последовательности
# Стили – из палитры UML draw.io, как в ЛР4: Lifeline, Activation Bar, сообщения, фрагмент alt.
# Полосы активации – дочерние элементы линий жизни, сообщения привязаны к полосам.

SEQ_HEAD = 52              # голова линии жизни
BAR = 10                   # ширина полосы активации
DY = 5                     # продление полосы за первое и последнее сообщение
LOOP = 24                  # петля вызова самого себя: вынос вправо от полосы
LOOP_H = 22                # и высота
PENT_W, PENT_H = 50, 26    # пятиугольник с оператором фрагмента
NEW_EDGE = ('newEdgeStyle={&quot;edgeStyle&quot;:&quot;sequenceEdgeStyle&quot;,&quot;libavoidRouting&quot;:0,'
            '&quot;curved&quot;:0,&quot;rounded&quot;:0};')
LIFELINE = ('shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=1;dropTarget=0;'
            'collapsible=0;recursiveResize=0;outlineConnect=0;portConstraint=eastwest;' + NEW_EDGE
            + 'size=%d;fillColor=#FFFFFF;' % SEQ_HEAD + BW)
ACTIVATION = ('html=1;points=[[0,0,0,0,5],[0,1,0,0,-5],[1,0,0,0,5],[1,1,0,0,-5]];perimeter=orthogonalPerimeter;'
              'outlineConnect=0;targetShapes=umlLifeline;portConstraint=eastwest;' + NEW_EDGE
              + 'fillColor=#FFFFFF;' + BW)
MESSAGE = ('html=1;verticalAlign=bottom;edgeStyle=sequenceEdgeStyle;libavoidRouting=0;curved=0;rounded=0;'
           'labelBackgroundColor=none;' + BW)
SYNC = MESSAGE + 'endArrow=block;endFill=1;'                # синхронный вызов
ASYNC = MESSAGE + 'endArrow=open;endSize=8;'                # асинхронное сообщение
REPLY = MESSAGE + 'endArrow=open;endSize=8;dashed=1;'       # ответ
SELF = ('html=1;align=left;verticalAlign=middle;spacingLeft=4;endArrow=block;endFill=1;rounded=0;'
        'edgeStyle=orthogonalEdgeStyle;curved=0;labelBackgroundColor=none;' + BW)
FRAME = ('shape=umlFrame;whiteSpace=wrap;html=1;pointerEvents=0;recursiveResize=0;container=0;collapsible=0;'
         'width=%d;height=%d;fillColor=none;' % (PENT_W, PENT_H) + BW)
OPERAND = 'line;strokeWidth=1;dashed=1;fillColor=none;rotatable=0;points=[];strokeColor=#000000;'
GUARD = ('text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacing=0;'
         'fontColor=#000000;fontFamily=Arial;fontSize=%d;' % FONT)


def text_lines(text):
    return text.count('\n') + 1


class Sequence:
    """Сценарий сверху вниз: сообщения, вызовы самого себя, фрагмент alt; render() – ячейки листа.

    Подпись сообщения стоит над линией в промежутке между отправителем и соседней линией жизни
    в сторону получателя, подпись вызова самого себя – справа от петли.
    """

    def __init__(self, page, lifelines):
        self.page = page
        self.ll = {lid: (cx, math.ceil(widest(name) + 16), name) for lid, name, cx in lifelines}
        self.order = [lid for lid, _, _ in lifelines]
        self.y = 1 + SEQ_HEAD
        self.messages = []        # (отправитель, получатель, стиль, текст, y, y петли или None)
        self.spans = []           # полосы активации: (линия, верх, низ, вложенная)
        self.frames = []          # [x0, x1, верх, низ, x условий, [(y, условие)]]

    def message(self, src, dst, style, text):
        self.y += text_lines(text) * LEADING + 14
        self.messages.append((src, dst, style, text, self.y, None))
        return self.y

    def self_call(self, lid, text):
        """Петля с полосы на вложенную полосу; подпись по центру петли."""
        h = text_lines(text) * LEADING
        top = self.y + 8
        y_a = top + h / 2 - LOOP_H / 2
        y_b = y_a + LOOP_H
        self.messages.append((lid, lid, SELF, text, y_a, y_b))
        self.spans.append((lid, y_b - DY, y_b + 3 * DY, True))
        self.y = max(y_b + 3 * DY, top + h)

    def activate(self, lid, y_first, y_last):
        self.spans.append((lid, y_first - DY, y_last + DY, False))

    def alt(self, guard, x0, x1, x_guard):
        top = self.y + 12
        self.frames.append([x0, x1, top, None, x_guard, [(top, guard)]])
        self.y = top + PENT_H + 4

    def alt_else(self, guard):
        y = self.y + 12
        self.frames[-1][5].append((y, guard))
        self.y = y + LEADING + 8

    def alt_end(self):
        self.y += 14
        self.frames[-1][3] = self.y

    def render(self):
        page = self.page
        bottom = self.y + 25
        for n, (x0, x1, top, low, x_guard, operands) in enumerate(self.frames):
            fid = 'frame%d' % n
            page.vertex(fid, 'alt', FRAME, x0, top, x1 - x0, low - top, solid=False)
            page.text(fid + '#op', (x0, top, PENT_W, PENT_H))
            for k, (y, guard) in enumerate(operands):
                if k:
                    page.vertex('%s_sep%d' % (fid, k), '', OPERAND, x0, y - 4, x1 - x0, 8, solid=False)
                gid = '%s_guard%d' % (fid, k)
                g = (x_guard, y + 3, math.ceil(text_width(guard)) + 4, LEADING)
                page.vertex(gid, attr(html_text(guard)), GUARD, *g, solid=False)
                page.text(gid, g)
        for lid in self.order:
            cx, w, name = self.ll[lid]
            page.vertex(lid, attr(html_text(name)), LIFELINE, cx - w / 2, 1, w, bottom - 1, solid=False)
            page.solid.append(('head_' + lid, (cx - w / 2, 1, w, SEQ_HEAD)))
            page.parent['head_' + lid] = '1'
        bars = []
        for n, (lid, y0, y1, nested) in enumerate(self.spans):
            bid = '%s_bar%d' % (lid, n)
            x = self.ll[lid][0] - BAR / 2 + (BAR / 2 if nested else 0)
            page.vertex(bid, '', ACTIVATION, x, y0, BAR, y1 - y0, lid, solid=not nested)
            bars.append((bid, lid, y0, y1, nested))

        def bar_at(lid, y, nested=False):
            found = [b for b, l, y0, y1, nest in bars if l == lid and y0 < y < y1 and nest == nested]
            assert len(found) == 1, '%s: у %s на y=%.0f полос %d' % (page.name, lid, y, len(found))
            return found[0]

        for n, (src, dst, style, text, y, y_b) in enumerate(self.messages):
            eid = 'msg%d' % (n + 1)
            w, h = math.ceil(widest(text)) + 4, text_lines(text) * LEADING
            cs = self.ll[src][0]
            if y_b is None:
                sb, db = bar_at(src, y), bar_at(dst, y)
                sign = 1 if self.ll[dst][0] > cs else -1
                start, end = (cs + sign * BAR / 2, y), (self.ll[dst][0] - sign * BAR / 2, y)
                points = []
                # подпись – между отправителем и соседней линией жизни в сторону получателя
                lc = (cs + self.ll[self.order[self.order.index(src) + sign]][0]) / 2
                rel = (lc - (start[0] + end[0]) / 2) / (abs(end[0] - start[0]) / 2) * sign
                label = (lc - w / 2, y - 3 - h, w, h)
            else:
                sb, db = bar_at(src, y), bar_at(src, y_b, nested=True)
                x_loop = cs + BAR / 2 + LOOP
                start, end = (cs + BAR / 2, y), (cs + BAR, y_b)
                points = [(x_loop, y), (x_loop, y_b)]
                # подпись – у середины вертикального отрезка петли
                total = (x_loop - start[0]) + (y_b - y) + (x_loop - end[0])
                rel = 2 * ((x_loop - start[0]) + (y_b - y) / 2) / total - 1
                label = (x_loop + 4, (y + y_b) / 2 - h / 2, w, h)
            waypoints = ''
            if points:
                waypoints = '<Array as="points">%s</Array>' % ''.join(
                    '<mxPoint x="%s" y="%s"/>' % (fmt(px), fmt(py)) for px, py in points)
            page.cells.append('<mxCell id="%s" value="%s" style="%s%s%s" edge="1" parent="1" source="%s" target="%s">'
                              '<mxGeometry x="%.4f" relative="1" as="geometry">%s<mxPoint as="offset"/>'
                              '</mxGeometry></mxCell>'
                              % (eid, attr(html_text(text)), style, page.anchor('exit', sb, start),
                                 page.anchor('entry', db, end), sb, db, rel, waypoints))
            page.lines.append((eid, [start] + points + [end], {sb, db}, style))
            page.text(eid + '#label', label)
        # подписи не заходят на пунктир линий жизни и не пересекают рамку фрагмента
        for tid, (x, y, w, h) in page.texts:
            for lid in self.order:
                cx = self.ll[lid][0]
                assert not x < cx < x + w, '%s: подпись %s на линии жизни %s' % (page.name, tid, lid)
            for x0, x1, top, low, _, operands in self.frames:
                if tid.startswith('frame'):
                    continue
                for yb in [top, low] + [yo for yo, _ in operands[1:]]:
                    assert not (y < yb < y + h and x < x1 and x + w > x0), \
                        '%s: подпись %s на границе фрагмента' % (page.name, tid)
                for xb in (x0, x1):
                    assert not (x < xb < x + w and y < low and y + h > top), \
                        '%s: подпись %s на боковой стороне фрагмента' % (page.name, tid)
        return page


def seq_registration_page():
    """Регистрация: пользователь и событие в одной транзакции, затем стартовый набор через брокер."""
    page = Page('Последовательность: регистрация и стартовый набор', 'seq-register')
    seq = Sequence(page, [('client', ': game-client', 58), ('users', ': users-service', 218),
                          ('care', ': care-service', 383), ('broker', ': message-broker', 547)])
    y1 = seq.message('client', 'users', SYNC, '1: POST\n/api/auth/register\n(login, nickname,\npassword)')
    seq.self_call('users', '2: сохранить\nпользователя\nи событие\nв outbox')
    y3 = seq.message('users', 'client', REPLY, '3: 201 (userId,\naccessToken)')
    seq.activate('client', y1, y3)
    seq.activate('users', y1, y3)
    # событие из outbox публикуется отдельно от запроса
    y4 = seq.message('users', 'broker', ASYNC, '4: user.registered')
    seq.activate('users', y4, y4 + 10)
    y5 = seq.message('broker', 'care', ASYNC, '5: user.registered')
    seq.self_call('care', '6: выдать\nмонеты\nи предметы')
    y7 = seq.message('care', 'broker', ASYNC, '7: ack')
    seq.activate('broker', y4, y7)
    seq.activate('care', y5, y7)
    return seq.render()


def seq_care_page():
    """Уход за питомцем: сага care-service – pets-service с компенсацией."""
    page = Page('Последовательность: уход за питомцем', 'seq-care')
    c_client, c_care, c_pets = 62, 279, 529
    seq = Sequence(page, [('client', ': game-client', c_client), ('care', ': care-service', c_care),
                          ('pets', ': pets-service', c_pets)])
    y1 = seq.message('client', 'care', SYNC, '1: POST /api/care-actions\n(petId, type, itemId)')
    seq.self_call('care', '2: списать предмет,\nзаписать PENDING')
    y3 = seq.message('care', 'pets', SYNC, '3: ApplyCareAction\n(actionId, petId,\nownerId, эффект)')
    seq.alt('[уход принят]', 1, c_pets + 40, c_care + BAR / 2 + 6)
    seq.message('pets', 'care', REPLY, '4: PetSnapshot')
    seq.self_call('care', '5: APPLIED,\nначислить награду')
    seq.message('care', 'client', REPLY, '6: 200 (action, pet)')
    seq.alt_else('[отказ]')
    y7 = seq.message('pets', 'care', REPLY, '7: FAILED_PRECONDITION\nили NOT_FOUND')
    seq.self_call('care', '8: вернуть предмет,\nREJECTED')
    seq.message('care', 'client', REPLY, '9: 409 / 404')
    seq.alt_else('[pets-service недоступен]')
    y10 = seq.message('care', 'client', REPLY, '10: 503, действие\nPENDING')
    seq.alt_end()
    seq.activate('client', y1, y10)
    seq.activate('care', y1, y10)
    seq.activate('pets', y3, y7)
    return seq.render()


# ======================================================================== файлы

def write(path, pages):
    xml = '<mxfile host="app.diagrams.net">' + ''.join(p.xml() for p in pages) + '</mxfile>'
    path.write_text(xml, encoding='utf-8')
    print(path.name)
    for p in pages:
        bottom = max(b[1] + b[3] for _, b in p.solid + p.texts)
        print('  %-52s %d x %d px = %.1f x %.1f см' % (p.name, WIDTH, bottom, WIDTH * 2.54 / 96, bottom * 2.54 / 96))


def main():
    write(OUT, [components_page(), db_users_notifications_page(), db_pets_page(), db_care_page(),
                users_page(), pets_page(), care_page(), notifications_page(),
                seq_registration_page(), seq_care_page()])
    write(DETAIL, [common_access_page(), common_events_page(), contracts_events_page(), grpc_contract_page(),
                   users_auth_page(), users_profile_page(),
                   pets_api_page(), pets_services_page(), pets_lifecycle_page(), pets_entities_page(),
                   care_catalog_api_page(), care_catalog_service_page(), care_shop_api_page(),
                   care_shop_services_page(), care_actions_api_page(), care_actions_service_page(),
                   care_handlers_page(), care_entities_page(),
                   notifications_api_page(), notifications_handlers_page(), notifications_data_page()])


if __name__ == '__main__':
    main()
