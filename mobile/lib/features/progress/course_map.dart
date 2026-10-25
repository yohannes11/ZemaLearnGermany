import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:path_drawing/path_drawing.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../ui/theme.dart';
import '../../ui/watch.dart';
import 'emblems.dart';
import 'progress.dart';

/// The course as a map, as on the website: one place per unit along a road, each unit's title and progress as its
/// place name, each place an engraved emblem of its unit's topic. The road is solid where the learner has travelled
/// and dashed ahead; the place to work on next is circled by hand and a passed unit test plants a pennant. A slim
/// band that scrolls sideways, so the lessons below start on the first screen; a tap on a place opens the unit.
class CourseMap extends StatefulWidget {
  const CourseMap({super.key});

  @override
  State<CourseMap> createState() => _CourseMapState();
}

const _height = 150.0;
const _spacing = 128.0; // between places, so every name has room on two lines
const _edge = 72.0; // half the widest name, so the first and last names are never cut off
// Hand-placed heights (share of the band), as the website's MAP_Y.
const _mapY = [0.42, 0.34, 0.40, 0.32, 0.42, 0.34, 0.42, 0.32, 0.40, 0.34];

class _CourseMapState extends State<CourseMap> {
  final _scroll = ScrollController();
  int? _centredOn;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _centre(double x, double width, {bool animate = false}) {
    if (!_scroll.hasClients) return;
    final target = (x - width / 2).clamp(0.0, _scroll.position.maxScrollExtent);
    animate ? _scroll.animateTo(target, duration: Motion.slow, curve: Motion.ease) : _scroll.jumpTo(target);
  }

  // Listens itself: it is built const, so its parent redrawing would not redraw it.
  @override
  Widget build(BuildContext context) => Watch(builder: _build);

  Widget _build(BuildContext context) {
    final c = context.c;
    final units = course.units;
    if (units.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(builder: (context, box) {
      final width = box.maxWidth;
      final n = units.length;
      final mapWidth = (_edge * 2 + (n - 1) * _spacing).clamp(width, double.infinity);
      final points = [
        for (var i = 0; i < n; i++)
          Offset(n > 1 ? _edge + i * (mapWidth - _edge * 2) / (n - 1) : mapWidth / 2, (_mapY[i % _mapY.length] * _height).roundToDouble() + 4),
      ];
      final next = nextSection();
      final here = next == null ? n - 1 : units.indexOf(next.unit).clamp(0, n - 1);
      final progress = [for (final u in units) unitProgress(u)];

      // Open on the place to work on next.
      if (_centredOn != here) {
        _centredOn = here;
        WidgetsBinding.instance.addPostFrameCallback((_) => _centre(points[here].dx, width));
      }

      return SizedBox(
        height: _height,
        child: Stack(children: [
          SingleChildScrollView(
            controller: _scroll,
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: mapWidth,
              height: _height,
              child: Stack(children: [
                Positioned.fill(
                  child: CustomPaint(painter: _MapPainter(units: units, points: points, here: here, progress: progress, c: c)),
                ),
                // Touch targets over each place and its name, for fingers and screen readers.
                for (var i = 0; i < n; i++)
                  Positioned(
                    left: points[i].dx - _spacing / 2,
                    top: points[i].dy - 40,
                    width: _spacing,
                    height: 104,
                    child: Semantics(
                      button: true,
                      label: '${course.unitName(units[i])}: ${course.t(units[i].title)}. '
                          '${progress[i].done} of ${progress[i].total} words learned'
                          '${progress[i].testPassed ? '. Unit test passed' : ''}${i == here ? '. You are here' : ''}',
                      excludeSemantics: true,
                      child: Material(
                        type: MaterialType.transparency,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(Radii.md),
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.push('/unit/${units[i].id}');
                          },
                        ),
                      ),
                    ),
                  ),
              ]),
            ),
          ),
          Positioned(
            right: Space.md,
            bottom: Space.sm,
            child: Tooltip(
              message: T('Show where I am'),
              child: Material(
                color: c.surface,
                shape: CircleBorder(side: BorderSide(color: c.border, width: 0.8)),
                elevation: 2,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () => _centre(points[here].dx, width, animate: true),
                  child: SizedBox(width: 40, height: 40, child: Icon(Icons.my_location_rounded, size: 20, color: c.text)),
                ),
              ),
            ),
          ),
        ]),
      );
    });
  }
}

class _MapPainter extends CustomPainter {
  _MapPainter({required this.units, required this.points, required this.here, required this.progress, required this.c});

  final List<Unit> units;
  final List<Offset> points;
  final int here;
  final List<({int done, int total, bool testPassed})> progress;
  final Palette c;

  /// A smooth road through the points (Catmull-Rom), one curve per leg.
  Path _road(int from, int to) {
    final path = Path()..moveTo(points[from].dx, points[from].dy);
    for (var i = from; i < to; i++) {
      final p0 = points[i > 0 ? i - 1 : i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2 < points.length ? i + 2 : i + 1];
      path.cubicTo(p1.dx + (p2.dx - p0.dx) / 6, p1.dy + (p2.dy - p0.dy) / 6, p2.dx - (p3.dx - p1.dx) / 6, p2.dy - (p3.dy - p1.dy) / 6, p2.dx, p2.dy);
    }
    return path;
  }

  void _land(Canvas canvas, Size size) {
    // Soft washes and a sea in the corner, stretched to the map (the website's MAP_BASE); decoration only.
    canvas.save();
    canvas.scale(size.width / 1000, size.height / 400);
    void wash(String d, Color colour, double opacity) =>
        canvas.drawPath(parseSvgPathData(d), Paint()..color = colour.withValues(alpha: opacity));
    wash('M-10 210C70 230 150 250 210 310S290 390 270 410H-10Z', c.goldBright, 0.12);
    wash('M270 410C310 330 350 280 430 262S570 244 630 284 670 364 650 410Z', c.brand, 0.07);
    wash('M650 410C670 300 630 220 710 160S870 60 1010 80V410Z', c.brand, 0.11);
    wash('M420 -10C440 60 520 92 600 82S700 22 720 -10Z', c.goldBright, 0.1);
    wash('M-10 -10H110C96 40 80 90 56 130S20 190 -10 200Z', c.brand, 0.13);
    canvas.restore();
  }

  void _emblem(Canvas canvas, Offset at, int id, bool big, bool flag) {
    final s = big ? 1.5 : 1.25;
    canvas.save();
    canvas.translate(at.dx - 12 * s, at.dy - 21 * s);
    canvas.scale(s);
    canvas.drawOval(Rect.fromCenter(center: const Offset(12, 20), width: 24, height: 5.2), Paint()..color = c.goldBright.withValues(alpha: 0.4));
    for (final part in emblems[id] ?? town) {
      final path = part.d != null
          ? parseSvgPathData(part.d!)
          : (Path()..addOval(Rect.fromCenter(center: Offset(part.ellipse!.$1, part.ellipse!.$2), width: part.ellipse!.$3 * 2, height: part.ellipse!.$4 * 2)));
      canvas.save();
      if (part.rotate != null) {
        canvas.translate(12, 6);
        canvas.rotate(part.rotate! * 3.141592653589793 / 180);
        canvas.translate(-12, -6);
      }
      final stroke = Paint()
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..color = c.text;
      switch (part.look) {
        case Look.fill:
          canvas.drawPath(path, Paint()..color = c.surface);
          canvas.drawPath(path, stroke..strokeWidth = 1.2);
        case Look.accent:
          canvas.drawPath(path, Paint()..color = c.goldBright.withValues(alpha: 0.5));
          canvas.drawPath(path, stroke..strokeWidth = 1);
        case Look.leaf:
          canvas.drawPath(path, Paint()..color = c.brand.withValues(alpha: 0.3));
          canvas.drawPath(path, stroke..strokeWidth = 1.1);
        case Look.line:
          canvas.drawPath(path, stroke..strokeWidth = 1);
        case Look.hatch:
          canvas.drawPath(path, stroke..strokeWidth = 0.6..color = c.text.withValues(alpha: 0.6));
        case Look.wave:
          canvas.drawPath(path, stroke..strokeWidth = 1.2..color = c.brand);
      }
      canvas.restore();
    }
    if (flag) {
      canvas.drawLine(const Offset(24, 4), const Offset(24, -9), Paint()..color = c.text..strokeWidth = 1.1);
      final pennant = Path()..moveTo(24, -9)..lineTo(30, -7)..lineTo(24, -5)..close();
      canvas.drawPath(pennant, Paint()..color = c.goldBright);
      canvas.drawPath(pennant, Paint()..style = PaintingStyle.stroke..strokeWidth = 0.6..color = c.text);
    }
    canvas.restore();
  }

  /// You are here: a ring drawn by hand around the place.
  void _inkRing(Canvas canvas, Offset p) {
    final x = p.dx, y = p.dy;
    final d = 'M${x + 10} ${y - 34}C${x - 4} ${y - 40} ${x - 26} ${y - 36} ${x - 30} ${y - 22}S${x - 18} ${y + 2} $x ${y}S${x + 28} ${y - 12} ${x + 25} ${y - 25}S${x + 10} ${y - 38} ${x - 4} ${y - 35}';
    canvas.drawPath(parseSvgPathData(d), Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..color = c.brand);
  }

  void _label(Canvas canvas, Offset p, String title, String meta, bool active) {
    // A halo of the page colour under the name keeps it readable over the road and washes.
    TextPainter painter(String text, TextStyle style, {bool halo = false}) => TextPainter(
          text: TextSpan(
            text: text,
            style: halo
                ? style.copyWith(
                    foreground: Paint()
                      ..style = PaintingStyle.stroke
                      ..strokeWidth = 4
                      ..strokeJoin = StrokeJoin.round
                      ..color = c.bg)
                : style,
          ),
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.center,
          maxLines: 2,
          ellipsis: '…',
        )..layout(minWidth: _spacing - 10, maxWidth: _spacing - 10);
    final titleStyle = TextStyle(fontFamily: serif, fontWeight: FontWeight.w700, fontSize: active ? 14 : 12.5, height: 1.1, color: active ? c.brandDeep : c.text);
    final metaStyle = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: active ? c.brand : c.muted);
    var y = p.dy + 10;
    for (final (text, style) in [(title, titleStyle), (meta, metaStyle)]) {
      final halo = painter(text, style, halo: true);
      final ink = painter(text, style);
      // Each line centred under the place.
      final at = Offset(p.dx - (_spacing - 10) / 2, y);
      halo.paint(canvas, at);
      ink.paint(canvas, at);
      y += ink.height;
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    _land(canvas, size);
    final n = points.length;
    if (here < n - 1) {
      final ahead = dashPath(_road(here, n - 1), dashArray: CircularIntervalList<double>([7, 6]));
      canvas.drawPath(ahead, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = c.muted.withValues(alpha: 0.7));
    }
    if (here > 0) {
      canvas.drawPath(_road(0, here), Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = c.brand);
    }
    for (var i = 0; i < n; i++) {
      final u = units[i];
      final p = progress[i];
      _emblem(canvas, points[i], u.id, i == n - 1, p.testPassed);
      if (i == here) _inkRing(canvas, points[i]);
      final pct = p.total == 0 ? 0 : (p.done / p.total * 100).round();
      _label(canvas, points[i], course.t(u.title), '${course.unitName(u)} · $pct%${p.testPassed ? ' ✓' : ''}', i == here);
    }
  }

  @override
  bool shouldRepaint(_MapPainter old) => true;
}
