import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';

/// Every text in the app: a role from the type scale and a palette colour.
class Txt extends StatelessWidget {
  const Txt(this.text, {super.key, this.role = TextRole.body, this.colour, this.align, this.maxLines, this.style});

  final String text;
  final TextRole role;
  final Color? colour;
  final TextAlign? align;
  final int? maxLines;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final header = role == TextRole.display || role == TextRole.title || role == TextRole.heading;
    var s = textStyle(role).copyWith(color: colour ?? context.c.text).merge(style);
    if (role == TextRole.overline) {
      return Semantics(header: false, child: Text(text.toUpperCase(), style: s, textAlign: align, maxLines: maxLines));
    }
    return Semantics(
      header: header,
      child: Text(text, style: s, textAlign: align, maxLines: maxLines, overflow: maxLines == null ? null : TextOverflow.ellipsis),
    );
  }
}

/// Press feedback: a quick settle under the finger, then the Material ripple.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.scale = 0.97, this.radius = Radii.lg, this.semanticLabel, this.haptic = true});

  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final double radius;
  final String? semanticLabel;
  final bool haptic;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  var _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return Semantics(
      button: enabled,
      label: widget.semanticLabel,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: Motion.fast,
        curve: Motion.ease,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: BorderRadius.circular(widget.radius),
            onTap: enabled
                ? () {
                    if (widget.haptic) HapticFeedback.selectionClick();
                    widget.onTap!();
                  }
                : null,
            onHighlightChanged: enabled ? (down) => setState(() => _down = down) : null,
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

/// A card: outlined at rest, or raised on its shadow; an accent stripe on the left marks the section's colour
/// (vocabulary gold, lessons emerald).
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.onTap, this.accent, this.raised = false, this.padding, this.semanticLabel, this.colour});

  final Widget child;
  final VoidCallback? onTap;
  final Color? accent;
  final bool raised;
  final EdgeInsets? padding;
  final String? semanticLabel;
  final Color? colour;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final body = Container(
      padding: padding ?? const EdgeInsets.all(Space.md),
      decoration: BoxDecoration(
        border: accent != null ? Border(left: BorderSide(color: accent!, width: 4)) : null,
      ),
      child: child,
    );
    return Container(
      decoration: BoxDecoration(
        color: colour ?? c.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: raised ? null : Border.all(color: c.border, width: 0.8),
        boxShadow: raised ? elevation(context, 1) : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? body : Pressable(onTap: onTap, scale: 0.98, semanticLabel: semanticLabel, child: body),
    );
  }
}

enum ButtonKind { primary, gold, secondary, ghost, danger }

/// A chunky, game-like button: a solid face over a darker base that it presses into.
class AppButton extends StatefulWidget {
  const AppButton({super.key, required this.label, required this.onPressed, this.kind = ButtonKind.primary, this.icon, this.busy = false, this.expand = true});

  final String label;
  final VoidCallback? onPressed;
  final ButtonKind kind;
  final IconData? icon;
  final bool busy;
  final bool expand;

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> {
  var _down = false;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final (face, base, ink) = switch (widget.kind) {
      ButtonKind.primary => (c.brand, c.brandDeep, c.brandInk),
      ButtonKind.gold => (c.goldBright, c.gold, const Color(0xFF1F1300)),
      ButtonKind.secondary => (c.surface, c.borderStrong, c.text),
      ButtonKind.ghost => (Colors.transparent, Colors.transparent, c.brand),
      ButtonKind.danger => (c.redSoft, c.red, c.red),
    };
    final off = widget.onPressed == null || widget.busy;
    final ghost = widget.kind == ButtonKind.ghost;
    final depth = ghost ? 0.0 : (_down ? 1.0 : 4.0);
    final content = widget.busy
        ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: ink))
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[Icon(widget.icon, size: 20, color: ink), const SizedBox(width: Space.sm)],
              Flexible(
                child: Text(widget.label,
                    textAlign: TextAlign.center,
                    style: textStyle(TextRole.label).copyWith(fontSize: 16, letterSpacing: 0.3, color: ink)),
              ),
            ],
          );
    return Semantics(
      button: true,
      enabled: !off,
      label: widget.label,
      excludeSemantics: true,
      child: Opacity(
        opacity: off && !widget.busy ? 0.45 : 1,
        child: GestureDetector(
          onTapDown: off ? null : (_) => setState(() => _down = true),
          onTapUp: off ? null : (_) => setState(() => _down = false),
          onTapCancel: off ? null : () => setState(() => _down = false),
          onTap: off
              ? null
              : () {
                  HapticFeedback.lightImpact();
                  widget.onPressed!();
                },
          child: Padding(
            padding: EdgeInsets.only(top: 4 - depth),
            child: ChunkyBox(
              face: face,
              base: base,
              edge: widget.kind == ButtonKind.secondary ? c.border : null,
              depth: depth,
              radius: Radii.pill,
              child: Container(
                constraints: BoxConstraints(minHeight: (ghost ? 44 : 52) - depth, minWidth: widget.expand ? double.infinity : 0),
                padding: const EdgeInsets.symmetric(horizontal: Space.lg, vertical: Space.sm),
                alignment: widget.expand ? Alignment.center : null,
                child: content,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The game-like look of buttons, choices and tiles: a face resting on a darker base that shows below it.
/// (Drawn as two rounded layers: Flutter can't round a border whose sides differ in colour.)
class ChunkyBox extends StatelessWidget {
  const ChunkyBox({super.key, required this.face, required this.base, this.edge, this.depth = 4, this.radius = Radii.lg, this.edgeWidth = 1.5, required this.child});

  final Color face;
  final Color base;

  /// An outline around the face, if any.
  final Color? edge;
  final double depth;
  final double radius;
  final double edgeWidth;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(radius)),
        padding: EdgeInsets.only(bottom: depth),
        child: Container(
          decoration: BoxDecoration(
            color: face,
            borderRadius: BorderRadius.circular(radius),
            border: edge == null ? null : Border.all(color: edge!, width: edgeWidth),
          ),
          clipBehavior: Clip.antiAlias,
          child: child,
        ),
      );
}

/// A round icon button on a soft ground: play, close, locate.
class RoundIconButton extends StatelessWidget {
  const RoundIconButton({super.key, required this.icon, required this.label, required this.onPressed, this.colour, this.size = 44});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final Color? colour;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: Material(
          color: context.c.surface2,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () {
              HapticFeedback.selectionClick();
              onPressed();
            },
            child: SizedBox(width: size, height: size, child: Icon(icon, color: colour ?? context.c.brand, size: size * 0.5)),
          ),
        ),
      ),
    );
  }
}

/// A small stat in a pill: the XP, the level, a count.
class Chip2 extends StatelessWidget {
  const Chip2({super.key, required this.icon, required this.value, required this.colour, required this.background, required this.label});

  final IconData icon;
  final String value;
  final Color colour;
  final Color background;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(Radii.pill)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 18, color: colour),
          const SizedBox(width: Space.xs),
          Text(value, style: textStyle(TextRole.label).copyWith(color: colour)),
        ]),
      ),
    );
  }
}

/// A thin bar that fills smoothly as progress is made.
class Bar extends StatelessWidget {
  const Bar({super.key, required this.value, this.colour, this.height = 8});

  final double value;
  final Color? colour;
  final double height;

  @override
  Widget build(BuildContext context) {
    final share = value.isFinite ? value.clamp(0.0, 1.0) : 0.0;
    return Semantics(
      value: '${(share * 100).round()}%',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Radii.pill),
        child: Container(
          height: height,
          color: context.c.surface2,
          alignment: Alignment.centerLeft,
          child: TweenAnimationBuilder<double>(
            tween: Tween(end: share),
            duration: Motion.slow,
            curve: Motion.ease,
            builder: (context, v, _) => FractionallySizedBox(
              widthFactor: v,
              child: Container(decoration: BoxDecoration(color: colour ?? context.c.brand, borderRadius: BorderRadius.circular(Radii.pill))),
            ),
          ),
        ),
      ),
    );
  }
}

/// A round badge with an icon, for list rows and section headers.
class Badge2 extends StatelessWidget {
  const Badge2({super.key, required this.icon, required this.colour, required this.background, this.size = 44});

  final IconData icon;
  final Color colour;
  final Color background;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: background, shape: BoxShape.circle),
        child: Icon(icon, size: size * 0.5, color: colour),
      );
}

/// A heading over a group, with an optional detail on the right.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.detail, this.kicker, this.kickerColour});

  final String title;
  final String? detail;
  final String? kicker;
  final Color? kickerColour;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: Space.sm),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (kicker != null) Txt(kicker!, role: TextRole.overline, colour: kickerColour ?? context.c.brand),
          Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
            Expanded(child: Txt(title, role: TextRole.heading)),
            if (detail != null) Txt(detail!, role: TextRole.caption, colour: context.c.muted),
          ]),
        ]),
      );
}

/// A row in a list card: badge, title and detail, and a chevron.
class ListRow extends StatelessWidget {
  const ListRow({super.key, this.leading, required this.title, this.kicker, this.kickerColour, this.detail, this.trailing, this.below});

  final Widget? leading;
  final String title;
  final String? kicker;
  final Color? kickerColour;
  final String? detail;
  final Widget? trailing;
  final Widget? below;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(children: [
      if (leading != null) ...[leading!, const SizedBox(width: Space.md)],
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (kicker != null) Txt(kicker!, role: TextRole.overline, colour: kickerColour ?? c.brand),
          Txt(title, role: TextRole.bodyStrong),
          if (detail != null) Txt(detail!, role: TextRole.caption, colour: c.muted),
          if (below != null) ...[const SizedBox(height: Space.xs), below!],
        ]),
      ),
      if (trailing != null) ...[const SizedBox(width: Space.sm), trailing!],
      const SizedBox(width: Space.xs),
      Icon(Icons.chevron_right_rounded, color: c.subtle),
    ]);
  }
}

/// A row of choices where one is on: daily goal, language, voice, speed, direction.
class Segmented<T> extends StatelessWidget {
  const Segmented({super.key, required this.value, required this.options, required this.onChanged, required this.label});

  final T value;
  final List<(T, String)> options;
  final ValueChanged<T> onChanged;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      label: label,
      container: true,
      child: Container(
        padding: const EdgeInsets.all(Space.xs),
        decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(Radii.md)),
        child: Row(children: [
          for (final (option, name) in options)
            Expanded(
              child: Semantics(
                inMutuallyExclusiveGroup: true,
                checked: option == value,
                child: Material(
                  color: option == value ? c.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(Radii.sm),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(Radii.sm),
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onChanged(option);
                    },
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 40),
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(vertical: Space.sm, horizontal: 2),
                      child: Txt(name,
                          role: option == value ? TextRole.label : TextRole.caption,
                          colour: option == value ? c.text : c.muted,
                          align: TextAlign.center),
                    ),
                  ),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

/// Space between the children of a column, the way `gap` does it on the web.
List<Widget> gapped(List<Widget> children, [double gap = Space.md]) => [
      for (var i = 0; i < children.length; i++) ...[if (i > 0) SizedBox(height: gap), children[i]],
    ];

/// A page's scrolling content, at most 720 wide on tablets.
class PageList extends StatelessWidget {
  const PageList({super.key, required this.children, this.gap = Space.md, this.padding});

  final List<Widget> children;
  final double gap;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) => ListView(
        padding: padding ?? const EdgeInsets.fromLTRB(Space.md, Space.md, Space.md, Space.xxl * 2),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped(children, gap)),
            ),
          ),
        ],
      );
}
