"""Clocks for every time the course teaches: a clock face at the exact time, beside the German that says it.

Rule: the clock shows the hour as it is said, never shifted (vier Uhr is 4:00, not 10:00, and the Amharic
says the same hour: አራት ሰዓት). `times(text)` reads the times in a German text ("Es ist fünf vor halb zehn."
-> 9:25, "von 9 bis 17 Uhr" -> 9:00 and 17:00, "9:30 → Es ist halb zehn." -> 9:30); course_content.py
writes one SVG per time, static/course/pics/clock-HHMM.svg (17:00 is clock-1700, a face at five with the
time 17:00 under it), and the course lists each text's times in COURSE["clocks"] for the website and the app.

Flat colours from the site's palette (no gradients), all twelve numbers, the hour hand short and dark, the
minute hand long and green, in Twemoji's 36 x 36 box so it sits like the other word pictures.
"""

import math
import re

NUMBERS = {
    'ein': 1, 'eins': 1, 'zwei': 2, 'zwo': 2, 'drei': 3, 'vier': 4, 'fünf': 5, 'sechs': 6, 'sieben': 7, 'acht': 8,
    'neun': 9, 'zehn': 10, 'elf': 11, 'zwölf': 12, 'dreizehn': 13, 'vierzehn': 14, 'fünfzehn': 15, 'sechzehn': 16,
    'siebzehn': 17, 'achtzehn': 18, 'neunzehn': 19, 'zwanzig': 20, 'einundzwanzig': 21, 'zweiundzwanzig': 22,
    'dreiundzwanzig': 23, 'vierundzwanzig': 24, 'fünfundzwanzig': 25,
}
HOUR = r'(\d{1,2}|' + '|'.join(sorted(NUMBERS, key=len, reverse=True)) + r')'
MINUTES = r'(fünf|zehn|zwanzig|fünfundzwanzig|\d{1,2})'
# The official way: "neun Uhr fünfundzwanzig" = 9:25.
TENS = {'zwanzig': 20, 'dreißig': 30, 'vierzig': 40, 'fünfzig': 50}
UNITS = {'ein': 1, 'zwei': 2, 'drei': 3, 'vier': 4, 'fünf': 5, 'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9}
MINUTE_WORDS = {**{k: v for k, v in NUMBERS.items() if v < 20}, **TENS,
                **{f'{u}und{t}': uv + tv for u, uv in UNITS.items() for t, tv in TENS.items()}}
OFFICIAL_MINUTES = r'(' + '|'.join(sorted(MINUTE_WORDS, key=len, reverse=True)) + r'|\d{1,2})'
# Words after "um acht" that make it something other than a time ("um acht Euro" doesn't occur, but be safe).
NOT_TIME = r'(?!\s+(?:Euro|Jahre|Minuten|Stunden|Prozent|Kilo|Meter|Personen|Leute))'

# Longest forms first: "fünf vor halb zehn" before "halb zehn" before "zehn Uhr".
PATTERNS = [
    ('digits', re.compile(r'\b(\d{1,2}):(\d{2})\b')),
    ('before_half', re.compile(rf'\b{MINUTES} vor halb {HOUR}\b', re.I)),
    ('after_half', re.compile(rf'\b{MINUTES} nach halb {HOUR}\b', re.I)),
    ('quarter_past', re.compile(rf'\bViertel nach {HOUR}\b', re.I)),
    ('quarter_to', re.compile(rf'\bViertel vor {HOUR}\b', re.I)),
    ('half', re.compile(rf'\bhalb {HOUR}\b', re.I)),
    ('past', re.compile(rf'\b{MINUTES} nach {HOUR}\b(?! Hause)', re.I)),
    ('to', re.compile(rf'\b{MINUTES} vor {HOUR}\b', re.I)),
    ('official', re.compile(rf'\b{HOUR} Uhr {OFFICIAL_MINUTES}\b', re.I)),
    ('range', re.compile(rf'\bvon {HOUR} bis {HOUR}\b(?: Uhr)?', re.I)),
    ('oclock', re.compile(rf'\b{HOUR} Uhr\b', re.I)),
    ('at', re.compile(rf'\b(?:um|ab|bis) {HOUR}\b{NOT_TIME}', re.I)),
]


def _number(word):
    return int(word) if word.isdigit() else NUMBERS[word.lower()]


def _hour(hours, minutes=0):
    return f'{hours}:{minutes:02d}'


def times(text):
    """The clock times a German text says, in order: ["9:25"], or ["9:00", "17:00"] for a range."""
    found, taken = [], []
    for kind, pattern in PATTERNS:
        for match in pattern.finditer(text):
            if any(start < match.end() and match.start() < end for start, end in taken):
                continue
            groups = match.groups()
            if kind == 'digits':
                hours, minutes = int(groups[0]), int(groups[1])
                if hours > 24 or minutes > 59:
                    continue
                result = [_hour(hours, minutes)]
            elif kind in ('before_half', 'after_half'):
                minutes, hours = _number(groups[0]), _number(groups[1]) - 1
                result = [_hour(hours or 12, 30 - minutes if kind == 'before_half' else 30 + minutes)]
            elif kind == 'quarter_past':
                result = [_hour(_number(groups[0]), 15)]
            elif kind == 'quarter_to':
                result = [_hour(_number(groups[0]) - 1 or 12, 45)]
            elif kind == 'half':
                result = [_hour(_number(groups[0]) - 1 or 12, 30)]
            elif kind == 'past':
                result = [_hour(_number(groups[1]), _number(groups[0]))]
            elif kind == 'to':
                result = [_hour(_number(groups[1]) - 1 or 12, 60 - _number(groups[0]))]
            elif kind == 'official':
                minutes = groups[1]
                result = [_hour(_number(groups[0]), int(minutes) if minutes.isdigit() else MINUTE_WORDS[minutes.lower()])]
            elif kind == 'range':
                result = [_hour(_number(groups[0])), _hour(_number(groups[1]))]
            else:
                result = [_hour(_number(groups[0]))]
            if any(int(t.split(':')[0]) > 24 for t in result):
                continue
            taken.append((match.start(), match.end()))
            found.append((match.start(), result))
    ordered = [t for _, result in sorted(found) for t in result]
    return list(dict.fromkeys(ordered))  # "9:30 → Es ist halb zehn." is one time


def name(time):
    hours, minutes = time.split(':')
    return f'clock-{int(hours):02d}{int(minutes):02d}'


RIM, FACE, NUMBER, TICK, HOUR_HAND, MINUTE_HAND, DOT = '#046c4e', '#fffdf7', '#0f1f17', '#8a968e', '#0f1f17', '#046c4e', '#d97706'


def _point(angle, radius):
    """A point on the face: angle in degrees clockwise from 12."""
    rad = math.radians(angle)
    return round(18 + radius * math.sin(rad), 2), round(18 - radius * math.cos(rad), 2)


def svg(time):
    """The clock face for a time; a time after 12:00 shows the same face (17:00 at five)."""
    hours, minutes = (int(part) for part in time.split(':'))
    parts = [f'<circle cx="18" cy="18" r="17.6" fill="{RIM}"/>', f'<circle cx="18" cy="18" r="15.6" fill="{FACE}"/>']
    for minute in range(60):  # minute ticks, longer at the hours
        if minute % 5:
            x1, y1 = _point(minute * 6, 14.4)
            x2, y2 = _point(minute * 6, 15)
            parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{TICK}" stroke-width="0.35"/>')
        else:
            x1, y1 = _point(minute * 6, 13.6)
            x2, y2 = _point(minute * 6, 15)
            parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{NUMBER}" stroke-width="0.8" stroke-linecap="round"/>')
    for number in range(1, 13):
        x, y = _point(number * 30, 10.9)
        parts.append(f'<text x="{x}" y="{round(y + 1.45, 2)}" font-family="Arial, Helvetica, sans-serif" font-size="4.1" '
                     f'font-weight="700" fill="{NUMBER}" text-anchor="middle">{number}</text>')
    hx, hy = _point((hours % 12 + minutes / 60) * 30, 7.4)
    mx, my = _point(minutes * 6, 12.4)
    parts.append(f'<line x1="18" y1="18" x2="{hx}" y2="{hy}" stroke="{HOUR_HAND}" stroke-width="2.6" stroke-linecap="round"/>')
    parts.append(f'<line x1="18" y1="18" x2="{mx}" y2="{my}" stroke="{MINUTE_HAND}" stroke-width="1.5" stroke-linecap="round"/>')
    parts.append(f'<circle cx="18" cy="18" r="1.7" fill="{DOT}"/><circle cx="18" cy="18" r="0.6" fill="{FACE}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" role="img" aria-label="{hours}:{minutes:02d}">'
            + ''.join(parts) + '</svg>\n')
