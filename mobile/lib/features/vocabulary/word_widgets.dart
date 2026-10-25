import 'package:flutter/material.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../core/settings.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../progress/progress.dart';
import 'word_picture.dart';

/// A word in a list: its picture, the German and its meaning (tap to reveal, which counts it as learned, as on the
/// website's word grid), and a play button.
class WordRow extends StatefulWidget {
  const WordRow({super.key, required this.word, required this.learned, this.open = false});
  final Word word;
  final bool learned;

  /// Shown with its meaning from the start ("Reveal all").
  final bool open;

  @override
  State<WordRow> createState() => _WordRowState();
}

class _WordRowState extends State<WordRow> {
  late bool _open = widget.open;

  @override
  void didUpdateWidget(WordRow old) {
    super.didUpdateWidget(old);
    if (widget.open != old.open) _open = widget.open;
  }

  void _toggle() {
    setState(() => _open = !_open);
    if (_open) learnWord(widget.word.german);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final word = widget.word;
    final meaning = course.meaning(word);
    return Container(
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: c.border, width: 0.8)),
      clipBehavior: Clip.antiAlias,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: _toggle,
          child: Padding(
            padding: const EdgeInsets.all(Space.sm + 4),
            child: Row(children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(Radii.md)),
                alignment: Alignment.center,
                child: word.pic.isNotEmpty ? WordPicture(codes: word.pic.take(1).toList(), size: 28) : Icon(Icons.abc_rounded, color: c.subtle),
              ),
              const SizedBox(width: Space.md),
              Expanded(
                child: Semantics(
                  label: '${word.german}${_open ? ', $meaning' : ''}${widget.learned ? ', learned' : ''}',
                  hint: _open ? null : T('Show meaning'),
                  excludeSemantics: true,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Txt(word.german, role: TextRole.bodyStrong),
                    AnimatedCrossFade(
                      duration: Motion.base,
                      crossFadeState: _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                      firstChild: Row(children: [
                        Icon(Icons.visibility_outlined, size: 15, color: c.subtle),
                        const SizedBox(width: Space.xs),
                        Txt(T('Show meaning'), role: TextRole.caption, colour: c.subtle),
                      ]),
                      secondChild: Txt(meaning, role: TextRole.caption, colour: c.muted),
                    ),
                  ]),
                ),
              ),
              if (widget.learned) Icon(Icons.check_circle_rounded, size: 20, color: c.green),
              if (audio.hasClip(word.german)) ...[
                const SizedBox(width: Space.sm),
                RoundIconButton(icon: Icons.volume_up_rounded, label: 'Listen to ${word.german}', onPressed: () => audio.play(word.german)),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

/// Saves a unit's recordings on the phone (in the chosen voice and speed), so its words and exercises play
/// without a connection.
class OfflineCard extends StatefulWidget {
  const OfflineCard({super.key, required this.unit});
  final Unit unit;

  @override
  State<OfflineCard> createState() => _OfflineCardState();
}

class _OfflineCardState extends State<OfflineCard> {
  late var _count = audio.savedCount(widget.unit);
  var _busy = false;

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await audio.saveUnit(widget.unit, (done, total) {
        if (mounted) setState(() => _count = (done: done, total: total));
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Download paused. Check your connection and try again; saved recordings are kept.')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) {
        if (!_busy) _count = audio.savedCount(widget.unit);
        final ready = _count.total > 0 && _count.done == _count.total;
        return Container(
          padding: const EdgeInsets.all(Space.sm + 4),
          decoration: BoxDecoration(color: ready ? c.greenSoft : c.surface2, borderRadius: BorderRadius.circular(Radii.lg)),
          child: Column(children: [
            Row(children: [
              Icon(ready ? Icons.cloud_done_outlined : Icons.cloud_download_outlined, color: ready ? c.green : c.muted),
              const SizedBox(width: Space.sm),
              Expanded(
                child: Txt(
                  ready ? 'Recordings saved for offline use' : (_busy ? 'Saving ${_count.done} of ${_count.total}…' : 'Save this unit for offline use'),
                  role: TextRole.label,
                  colour: ready ? c.green : c.muted,
                ),
              ),
              if (!ready) AppButton(label: _busy ? 'Saving' : 'Save', kind: ButtonKind.secondary, busy: _busy, expand: false, onPressed: _save),
            ]),
            if (_busy) ...[const SizedBox(height: Space.sm), Bar(value: _count.total == 0 ? 0 : _count.done / _count.total, colour: c.green, height: 6)],
          ]),
        );
      },
    );
  }
}
