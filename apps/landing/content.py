"""Everything the landing page says, with the source of every figure.

Only official or primary sources are used (German government, DAAD, IW/KOFA, IMF). When a figure
changes, update it here together with its source; the template never hard-codes a number.
Checked on 30 September 2026.
"""

SOURCES = {
    "daad-students": {
        "title": "High number of international students in Germany again",
        "publisher": "DAAD (German Academic Exchange Service), press release",
        "date": "26 November 2025",
        "url": "https://www.daad.de/en/press-releases/erneut-hohe-zahl-an-internationalen-studierenden-in-deutschland/",
    },
    "daad-costs": {
        "title": "Costs of education and living",
        "publisher": "DAAD",
        "date": "accessed September 2026",
        "url": "https://www.daad.de/en/studying-in-germany/living-in-germany/finances/",
    },
    "daad-german": {
        "title": "The German language",
        "publisher": "DAAD",
        "date": "accessed September 2026",
        "url": "https://www.daad.de/en/studying-in-germany/living-in-germany/german-language/",
    },
    "daad-jobs": {
        "title": "Side jobs",
        "publisher": "DAAD",
        "date": "accessed September 2026",
        "url": "https://www.daad.de/en/studying-in-germany/work-career/side-jobs/",
    },
    "kofa": {
        "title": "Jahresrückblick 2025: Schwacher Arbeitsmarkt (skilled-worker gap 2025)",
        "publisher": "KOFA, German Economic Institute (IW)",
        "date": "25 March 2026",
        "url": "https://www.kofa.de/daten-und-fakten/studien/jahresrueckblick-2025/",
    },
    "imf": {
        "title": "World Economic Outlook, April 2026: Statistical Appendix",
        "publisher": "International Monetary Fund",
        "date": "April 2026",
        "url": "https://www.imf.org/-/media/files/publications/weo/2026/april/english/statsappendix.pdf",
    },
    "aa-language": {
        "title": "Deutsch als Fremdsprache: Sprachförderung weltweit",
        "publisher": "German Federal Foreign Office",
        "date": "28 July 2025",
        "url": "https://www.auswaertiges-amt.de/de/aussenpolitik/kultur-und-gesellschaft/deutschesprache-200988",
    },
    "aa-learners": {
        "title": "Deutsch als Fremdsprache: In Afrika und Asien lernen immer mehr Menschen Deutsch",
        "publisher": "German Federal Foreign Office",
        "date": "4 June 2020",
        "url": "https://www.auswaertiges-amt.de/de/newsroom/deutsch-als-fremdsprache-2346756",
    },
    "mig-bluecard": {
        "title": "EU Blue Card",
        "publisher": "Make it in Germany, the German government's portal for skilled workers",
        "date": "salary thresholds for 2026",
        "url": "https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card",
    },
    "mig-opportunity": {
        "title": "Opportunity Card (Chancenkarte)",
        "publisher": "Make it in Germany",
        "date": "accessed September 2026",
        "url": "https://www.make-it-in-germany.com/en/visa-residence/opportunity-card/job-search",
    },
    "mig-language": {
        "title": "Required German language skills depending on the type of visa",
        "publisher": "Make it in Germany / Federal Ministry for Economic Affairs",
        "date": "accessed September 2026",
        "url": "https://www.make-it-in-germany.com/fileadmin/1_Rebrush_2022/a_Fachkraefte/PDF-Dateien/3_Visum_u_Aufenthalt/Visagrafik_EN/Visum_erforderliche_Deutschkenntnisse_EN.pdf",
    },
    "mig-graduates": {
        "title": "Prospects after graduation",
        "publisher": "Make it in Germany",
        "date": "accessed September 2026",
        "url": "https://www.make-it-in-germany.com/en/study-training/study/prospects/seeking-employment",
    },
    "mig-nursing": {
        "title": "Nursing professionals",
        "publisher": "Make it in Germany",
        "date": "accessed September 2026",
        "url": "https://www.make-it-in-germany.com/en/working-in-germany/professions-in-demand/nursing",
    },
    "goethe-addis": {
        "title": "German courses in Addis Ababa: contact and enrolment",
        "publisher": "Goethe-Institut Ethiopia",
        "date": "accessed September 2026",
        "url": "https://www.goethe.de/ins/et/en/spr/kur/kue.html",
    },
}

# The order here is the order of the numbered notes at the foot of the page.
SOURCE_ORDER = list(SOURCES)

STATS = [
    {
        "value": 402000,
        "display": "402,000",
        "label": "international students at German universities",
        "detail": "Winter semester 2024/25, including a record 116,600 first-year students from abroad.",
        "source": "daad-students",
    },
    {
        "value": 0,
        "display": "€0",
        "label": "tuition at most public universities",
        "detail": (
            "Most programmes charge no tuition. You pay a semester contribution of about €70–430. "
            "Baden-Württemberg charges non-EU students €1,500 per semester."
        ),
        "source": "daad-costs",
    },
    {
        "value": 369516,
        "display": "369,516",
        "label": "skilled jobs Germany could not fill in 2025",
        "detail": "One in three openings for qualified workers. Nursing, elderly care and building trades had some of the largest gaps.",
        "source": "kofa",
    },
    {
        "value": 3,
        "display": "No. 3",
        "label": "largest economy in the world",
        "detail": "Only the United States and China are larger by nominal GDP.",
        "source": "imf",
    },
    {
        "value": 100,
        "display": "100 million",
        "label": "native speakers of German",
        "detail": "German is the most widely spoken native language in Europe.",
        "source": "aa-language",
    },
    {
        "value": 15.4,
        "display": "15.4 million",
        "label": "people learning German worldwide",
        "detail": "Africa saw almost 50% growth in German learners between 2015 and 2020.",
        "source": "aa-learners",
    },
]

PATHS = [
    {
        "key": "study",
        "title": "Study at a German university",
        "image": "library",
        "alt": "Students reading at long desks in the reading room of the Saxon State and University Library in Dresden",
        "body": (
            "Most public universities charge no tuition. German-taught degrees usually ask for an advanced "
            "certificate such as TestDaF or DSH, and in English-taught programmes German is still what gets "
            "you a student job (up to 140 full days a year) and friends outside class."
        ),
        "needs": "German-taught degrees: usually B2–C1",
        "sources": ["daad-costs", "daad-german", "daad-jobs"],
    },
    {
        "key": "career",
        "title": "Build a career where skills are needed",
        "image": "hamburg",
        "alt": "Container cranes loading ships at the port of Hamburg",
        "body": (
            "The EU Blue Card needs a salary of at least €50,700 in 2026 (€45,934 in shortage jobs and for "
            "recent graduates) and has no legal German requirement. But vocational training requires German "
            "at B1, and nurses need B1 or B2 depending on the federal state."
        ),
        "needs": "Vocational training: B1 · Nursing: B1–B2",
        "sources": ["mig-bluecard", "mig-language", "mig-nursing"],
    },
    {
        "key": "life",
        "title": "Feel at home, not just visit",
        "image": "heidelberg",
        "alt": "Aerial view of Heidelberg's old town and castle beside the Neckar river",
        "body": (
            "“German language skills will significantly affect how comfortable you feel in Germany,” says the "
            "DAAD. The Opportunity Card lets qualified people spend up to a year in Germany looking for work, "
            "with German at A1 (or English at B2) as the minimum."
        ),
        "needs": "Opportunity Card: A1 minimum",
        "sources": ["daad-german", "mig-opportunity"],
    },
    {
        "key": "stay",
        "title": "Stay after you graduate",
        "icon": "key",
        "body": (
            "International graduates can get a residence permit of up to 18 months to look for qualified "
            "work, and may take any job while they search."
        ),
        "sources": ["mig-graduates"],
    },
    {
        "key": "world",
        "title": "Use it beyond Germany",
        "icon": "globe",
        "body": "German is spoken in Germany, Austria and Switzerland, and it is the most widely spoken native language in Europe.",
        "sources": ["aa-language"],
    },
    {
        "key": "growth",
        "title": "A skill that stays with you",
        "icon": "spark",
        "body": (
            "Every word you learn is yours for life. A few focused minutes a day build the habit that exams, "
            "interviews and a new city will ask of you."
        ),
        "sources": [],
    },
]

REASONS_NOW = [
    {
        "title": "German comes before the visa",
        "body": (
            "Many routes ask for proof of German when you apply: B1 for vocational training, and usually "
            "B2–C1 for German-taught degrees. Certificates take time to earn, so the clock starts with your "
            "first lesson."
        ),
        "sources": ["mig-language", "daad-german"],
    },
    {
        "title": "Courses fill up",
        "body": (
            "The Goethe-Institut in Addis Ababa reports very high demand for its courses and exams, with "
            "enrolment through a waiting list. Build your foundation now, so you are ready when your place comes."
        ),
        "sources": ["goethe-addis"],
    },
    {
        "title": "Small steps add up",
        "body": "A few words a day is enough to finish the first course sooner than you might think. Try it:",
        "sources": [],
        "calculator": True,
    },
]

FEATURES = [
    {
        "icon": "book",
        "title": "Feels familiar",
        "body": "A design inspired by Ethiopian manuscripts, with Ge'ez numerals and two friendly coaches, Selam and Dawit.",
    },
    {
        "icon": "sound",
        "title": "Hear real German",
        "body": "Natural recordings of every word and example, in two voices and at three speeds.",
    },
    {
        "icon": "mic",
        "title": "Speak from day one",
        "body": "Your coach says each word three times, then listens while you say it back.",
    },
    {
        "icon": "pen",
        "title": "Grammar that makes sense",
        "body": "21 short lessons with tables, examples and exercises, each linked to the words you are learning.",
    },
    {
        "icon": "cards",
        "title": "Practise your way",
        "body": "Flashcards in both directions, drag-and-drop matching and typed translations.",
    },
    {
        "icon": "phone",
        "title": "Free, on your phone",
        "body": "Nothing to install. A free account saves your progress on every device.",
    },
]

# What each CEFR level lets you do, and which German requirements it meets (sources as above).
LEVELS = [
    {
        "code": "A1",
        "name": "Beginner",
        "can": "Introduce yourself, greet people, ask and answer simple questions.",
        "opens": "The minimum for the Opportunity Card (or English at B2).",
        "sources": ["mig-opportunity"],
        "status": "now",
        "status_label": "A1.1 available now · Units 1–7",
    },
    {
        "code": "A2",
        "name": "Elementary",
        "can": "Handle everyday situations: shopping, directions, work routines.",
        "opens": "Everyday life in Germany gets much easier.",
        "sources": [],
        "status": "next",
        "status_label": "Coming next",
    },
    {
        "code": "B1",
        "name": "Intermediate",
        "can": "Get by in most situations, talk about work, plans and experiences.",
        "opens": "Required for a vocational training visa; nursing in some federal states.",
        "sources": ["mig-language", "mig-nursing"],
        "status": "planned",
        "status_label": "Planned",
    },
    {
        "code": "B2",
        "name": "Upper intermediate",
        "can": "Discuss a wide range of topics fluently and understand complex texts.",
        "opens": "Nursing recognition in many states; some university programmes.",
        "sources": ["mig-nursing", "daad-german"],
        "status": "planned",
        "status_label": "Planned",
    },
    {
        "code": "C1",
        "name": "Advanced",
        "can": "Use German flexibly for study and work, including academic texts.",
        "opens": "Most German-taught degree programmes (TestDaF or DSH).",
        "sources": ["daad-german"],
        "status": "planned",
        "status_label": "Planned",
    },
]

COURSE_FACTS = {"words": 770, "lessons": 21, "units": 7}

FAQ = [
    {
        "q": "Is ZemaLearn free?",
        "a": (
            "Yes. The whole A1.1 course (Units 1–7) is free to use. A free account saves your progress so you "
            "can continue on any device."
        ),
    },
    {
        "q": "Do I need German to work in Germany?",
        "a": (
            "It depends on the route. The EU Blue Card has no legal German requirement, but vocational training "
            "requires B1, nursing requires B1 or B2 depending on the state, and most workplaces and daily life "
            "run in German."
        ),
    },
    {
        "q": "How long does it take to learn German?",
        "a": (
            "It depends on how much time you practise. The levels build on each other, and university programmes "
            "often ask for B2 or C1, so starting early gives you time. In this course, learning 10 words a day "
            "covers all 770 words of A1.1 in about 11 weeks."
        ),
    },
    {
        "q": "Will ZemaLearn give me a certificate or a visa?",
        "a": (
            "No. ZemaLearn helps you learn; official certificates come from exams such as the Goethe-Zertifikat, "
            "telc, ÖSD or TestDaF, and visas from the German embassy. ZemaLearn is independent and not "
            "affiliated with the German government, the DAAD or the Goethe-Institut."
        ),
    },
    {
        "q": "Do I need to install an app?",
        "a": "No. ZemaLearn runs in your web browser on a phone, tablet or computer.",
    },
]

IMAGES = {
    "scribes": {
        "title": "Ethiopian scribes (illuminated manuscript, 18th century)",
        "author": "Unknown artist",
        "license": "Public domain",
        "license_url": "",
        "page": "https://commons.wikimedia.org/wiki/File:Ethiopian_scribes.jpg",
        "width": 1312,
        "height": 1128,
    },
    "berlin": {
        "title": "The Brandenburg Gate in Berlin at dusk",
        "author": "Thomas Wolf, www.foto-tw.de",
        "license": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/",
        "page": "https://commons.wikimedia.org/wiki/File:Brandenburger_Tor_abends.jpg",
        "width": 1400,
        "height": 933,
    },
    "addis": {
        "title": "Addis Ababa skyline from Sheger Park",
        "author": "DaneyWiki",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "page": "https://commons.wikimedia.org/wiki/File:AddisView.jpg",
        "width": 1400,
        "height": 933,
    },
    "library": {
        "title": "Reading room of the Saxon State and University Library, Dresden",
        "author": "Stephan Herz",
        "license": "CC BY 2.5",
        "license_url": "https://creativecommons.org/licenses/by/2.5/",
        "page": "https://commons.wikimedia.org/wiki/File:Slub-dresden-reading-room-1.JPG",
        "width": 1400,
        "height": 929,
    },
    "hamburg": {
        "title": "Container terminal Tollerort, port of Hamburg",
        "author": "Raimond Spekking",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "page": "https://commons.wikimedia.org/wiki/File:Hamburg_Hafen_Containerterminal.jpg",
        "width": 1400,
        "height": 952,
    },
    "heidelberg": {
        "title": "Heidelberg old town and castle from the air",
        "author": "Schlurcher",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "page": "https://commons.wikimedia.org/wiki/File:Heidelberg_Altstadt_Schloss_Luftbild.JPG",
        "width": 1400,
        "height": 974,
    },
    "aau": {
        "title": "University campus in Addis Ababa",
        "author": "Ninaras",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "page": "https://commons.wikimedia.org/wiki/File:University_Campus_in_Addis_Ababa.jpg",
        "width": 1400,
        "height": 933,
    },
}
