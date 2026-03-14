from typing import Any, Dict, List, Optional, Tuple

import config
import mysql.connector

"""
Story Quiz Seeder
- Lists existing Story:* themes with question counts
- Creates new Story:* themes (if missing)
- Inserts many new, high-quality questions per Story:* theme with many answers
- Idempotent: skips questions that already exist in a theme (by exact text)

Assumptions
- difficultyLevelId: 1=Easy, 2=Medium, 3=Hard (adjust DIFFICULTY_MAP if different)
- points/time_limit chosen consistently by difficulty
- Table columns exist: themes(id,name), questions(id, question_text, difficultyLevelId, points, time_limit, explanation, Url, themeId), answers(id, answer_text, is_correct, questionId)

Usage
- Run directly: python sql_story_questions.py
- Safe to re-run; duplicates are skipped
- Starts with a dry-run summary; apply when you confirm
"""

DIFFICULTY_MAP = {
    "easy": 1,
    "medium": 2,
    "hard": 3,
}

POINTS_BY_DIFFICULTY = {
    1: 10,
    2: 20,
    3: 30,
}

TIME_BY_DIFFICULTY = {
    1: 30,  # seconds
    2: 45,
    3: 60,
}


def get_connection():
    return mysql.connector.connect(**config.db_config)


def get_or_create_theme(cursor, name: str) -> int:
    cursor.execute("SELECT id FROM themes WHERE name = %s", (name,))
    row = cursor.fetchone()
    if row:
        return row[0]
    cursor.execute("INSERT INTO themes (name) VALUES (%s)", (name,))
    return cursor.lastrowid


def get_existing_question_texts(cursor, theme_id: int) -> set:
    cursor.execute(
        "SELECT question_text FROM questions WHERE themeId = %s", (theme_id,)
    )
    return {row[0] for row in cursor.fetchall()}


def insert_question_with_answers(
    cursor,
    theme_id: int,
    question_text: str,
    explanation: Optional[str],
    difficulty_keyword: str = "medium",
    url: Optional[str] = None,
    answers: Optional[List[Dict[str, Any]]] = None,
):
    if answers is None or len(answers) < 2:
        raise ValueError("Each question must have at least 2 answers")

    diff_id = DIFFICULTY_MAP.get(difficulty_keyword, 2)
    points = POINTS_BY_DIFFICULTY[diff_id]
    time_limit = TIME_BY_DIFFICULTY[diff_id]

    cursor.execute(
        """
        INSERT INTO questions (question_text, difficultyLevelId, points, time_limit, explanation, Url, themeId)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (question_text, diff_id, points, time_limit, explanation, url, theme_id),
    )
    q_id = cursor.lastrowid

    # Insert answers
    for ans in answers:
        cursor.execute(
            """
            INSERT INTO answers (answer_text, is_correct, questionId)
            VALUES (%s, %s, %s)
            """,
            (ans["text"], bool(ans.get("is_correct", False)), q_id),
        )

    return q_id


def print_existing_stories_theme():
    try:
        conn = get_connection()
        cur = conn.cursor()
        print("=== Existing Story:* themes ===")
        cur.execute("""
            SELECT t.id, t.name, COUNT(q.id) as cnt
            FROM themes t
            LEFT JOIN questions q ON q.themeId = t.id
            WHERE t.name LIKE 'Story:%'
            GROUP BY t.id, t.name
            ORDER BY t.name
            """)
        rows = cur.fetchall()
        if not rows:
            print("No Story:* themes found.\n")
        else:
            for tid, tname, cnt in rows:
                print(f"- {tname} ({cnt})")
            print()
    except mysql.connector.Error as e:
        print(f"Error reading existing stories: {e}")
    finally:
        try:
            cur.close()
            conn.close()
        except Exception:
            pass


def seed_story_questions(dry_run: bool = True) -> Tuple[int, int, int]:
    """
    Returns: (themes_created, questions_inserted, answers_inserted)
    """
    THEMES: Dict[str, List[Dict[str, Any]]] = {
        # Story: Ash Bloods (recap/history theme)
        "Story: Ash Bloods": [
            {
                "q": "What weapons did the resistance fighters primarily use?",
                "difficulty": "easy",
                "exp": "They used crude weaponsclubs, spears tipped with scavenged metal, knuckles wrapped in iron.",
                "answers": [
                    {"text": "Swords and shields from armory"},
                    {"text": "Farming tools adapted for combat"},
                    {"text": "Bows and arrows for distance"},
                    {"text": "Bare hands and martial arts"},
                    {"text": "Weapons stolen from Ash-Bloods"},
                    {
                        "text": "Clubs, metal-tipped spears, iron-wrapped knuckles",
                        "is_correct": True,
                    },
                    {"text": "Magical weapons with special powers"},
                    {"text": "Ceremonial glass blades"},
                    {"text": "Bone flutes that stun enemies"},
                    {"text": "Weighted chains with hooks"},
                    {"text": "Crossbows with silver bolts"},
                    {"text": "Copper tridents from the docks"},
                    {"text": "Mercury-soaked daggers"},
                    {"text": "Obsidian knuckle-dusters"},
                ],
            },
            {
                "q": "What catastrophe originally gave rise to the Ash Bloods?",
                "difficulty": "easy",
                "exp": "A power plant core rupture spread mutagenic ash across the land, transforming people into Ash Bloods.",
                "answers": [
                    {
                        "text": "A power plant core rupture that spewed ash",
                        "is_correct": True,
                    },
                    {"text": "A volcanic eruption that blanketed the realm"},
                    {"text": "A demon ritual in the holy city"},
                    {"text": "A celestial eclipse lasting a year"},
                    {"text": "Comet dust poisoning the rivers"},
                    {"text": "A plague born from ocean spores"},
                    {"text": "Sun flares melting the ice caps"},
                    {"text": "A failed terraforming engine"},
                ],
            },
            {
                "q": "What tragic fate befell Kael Hoff after ending the Ash Bloods' reign?",
                "difficulty": "medium",
                "exp": "Kael Hoff was ultimately claimed by the corruption, becoming what he fought.",
                "answers": [
                    {"text": "He was corrupted and transformed", "is_correct": True},
                    {"text": "He ascended as a saint"},
                    {"text": "He retired peacefully by the sea"},
                    {"text": "He vanished into the clock tower unscathed"},
                    {"text": "He became the first Seraph"},
                    {"text": "He split into seven echoes"},
                ],
            },
            {
                "q": "The clock tower built from Kael Hoff became infamous for what effect?",
                "difficulty": "medium",
                "exp": "Its bells drained life and suffering from those belowtime measured in anguish.",
                "answers": [
                    {
                        "text": "Ringing that drained life from the city",
                        "is_correct": True,
                    },
                    {"text": "Opening portals to safe havens"},
                    {"text": "Granting immortality to listeners"},
                    {"text": "Calling rain to heal the fields"},
                    {"text": "Summoning spectral wolves"},
                    {"text": "Singing lullabies to demons"},
                ],
            },
            {
                "q": "What did Daren and Selene realize about their own lineage at the port town?",
                "difficulty": "hard",
                "exp": "They learned their parents were once Ash Bloods reborn into human fleshechoes in their powers.",
                "answers": [
                    {"text": "They descend from reborn Ash Bloods", "is_correct": True},
                    {"text": "They are unrelated to any curse"},
                    {"text": "They are children of Zerath"},
                    {"text": "They share no blood relation at all"},
                    {"text": "They are clones of Kael Hoff"},
                ],
            },
            {
                "q": "Which city did the siblings leave determined to face Zerath?",
                "difficulty": "easy",
                "exp": "They left the burning island city behind, crossing the causeway east.",
                "answers": [
                    {"text": "A silent island city they saved", "is_correct": True},
                    {"text": "Kaizahara"},
                    {"text": "The Holy Capital"},
                    {"text": "Stormwatch"},
                    {"text": "Noria"},
                    {"text": "Elderglass"},
                ],
            },
        ],
        # Story: Toxic Air (survival under ash skies)
        "Story: Toxic Air": [
            {
                "q": "What immediate danger does the ash-laden air pose to unprotected lungs?",
                "difficulty": "easy",
                "exp": "The ash thickens blood and scars airways; exposure can be rapidly fatal.",
                "answers": [
                    {"text": "Chemical scarring and suffocation", "is_correct": True},
                    {"text": "Instant freezing of lung tissue"},
                    {"text": "Benign irritation only"},
                    {"text": "Temporary sneezing fits"},
                    {"text": "Mild dehydration"},
                    {"text": "Seasonal allergies"},
                ],
            },
            {
                "q": "Which survival gear proved most essential during ash storms?",
                "difficulty": "medium",
                "exp": "Filter masks and ward-stones to deflect particulate curses were crucial.",
                "answers": [
                    {"text": "Filter masks and ward-stones", "is_correct": True},
                    {"text": "Lantern oil and fishing hooks"},
                    {"text": "Water skins and sandals"},
                    {"text": "Silk scarves and copper bells"},
                    {"text": "Bone charms and incense"},
                    {"text": "Mirror shards to signal"},
                ],
            },
            {
                "q": "What long-term symptom marks those who survived repeated exposure?",
                "difficulty": "medium",
                "exp": "Coughs that never fully heal and hair that greys in streaks of ash.",
                "answers": [
                    {"text": "A persistent ash-cough", "is_correct": True},
                    {"text": "Bioluminescent freckles"},
                    {"text": "Webbed fingers"},
                    {"text": "Glowing teeth"},
                    {"text": "Third eyelids"},
                ],
            },
            {
                "q": "What caused the air to become toxic in the first place?",
                "difficulty": "easy",
                "exp": "The power plant's ruptured core cast cursed particulates across the realm.",
                "answers": [
                    {"text": "A ruptured power plant core", "is_correct": True},
                    {"text": "A dragon's dying breath"},
                    {"text": "A plague of moths"},
                    {"text": "Broken moon shards"},
                    {"text": "A witch's festival"},
                ],
            },
            {
                "q": "Which areas were considered most dangerous during low-wind nights?",
                "difficulty": "hard",
                "exp": "Valleys and basements where ash pooled like water were death traps.",
                "answers": [
                    {"text": "Valleys and low basements", "is_correct": True},
                    {"text": "High rooftops"},
                    {"text": "Open deserts"},
                    {"text": "Cliff edges"},
                    {"text": "Sea caves during low tide"},
                ],
            },
        ],
        # Story: Kaizahara Tournament (observation + challenges)
        "Story: Kaizahara Tournament": [
            {
                "q": "During 'Tengoku He Ikou', when does Kazuki's perception field activate?",
                "difficulty": "medium",
                "exp": "He fights normally during 'Tengoku He'; the perception-slowing field manifests during 'Ikou'.",
                "answers": [
                    {"text": "During the 'Ikou' passages", "is_correct": True},
                    {"text": "Only during drum solos"},
                    {"text": "During the 'Tengoku He' crescendos"},
                    {"text": "It is constant with no rhythm"},
                ],
            },
            {
                "q": "What is the true nature of Kazuki Tenshin's 'time stop'?",
                "difficulty": "hard",
                "exp": "It's not time; he slows the perception of time in observers, leaving himself unaffected.",
                "answers": [
                    {
                        "text": "A manipulation of opponents' temporal perception",
                        "is_correct": True,
                    },
                    {"text": "Literal freezing of universal time"},
                    {"text": "Teleportation disguised as time magic"},
                    {"text": "An illusion cast by arena crystals"},
                ],
            },
            {
                "q": "Which counter-strategy did Selene suggest to exploit Kazuki's approach?",
                "difficulty": "hard",
                "exp": "A gravity well placed at the commit point ignores perception and rips through his approach.",
                "answers": [
                    {
                        "text": "Creating a gravity well at the moment of attack",
                        "is_correct": True,
                    },
                    {"text": "Blinding the musicians"},
                    {"text": "Shattering the obsidian walls"},
                    {"text": "Poisoning the arena sands"},
                    {"text": "Jamming the hymn with noise"},
                ],
            },
            {
                "q": "What unique property did the Kaizahara colosseum possess?",
                "difficulty": "easy",
                "exp": "Its obsidian construction bent acoustics and space, carrying whispers and amplifying roars.",
                "answers": [
                    {
                        "text": "Obsidian curves that carried every whisper",
                        "is_correct": True,
                    },
                    {"text": "Walls that absorbed all sound entirely"},
                    {"text": "A floor made of living vines"},
                    {"text": "Shifting gravity every minute"},
                ],
            },
            {
                "q": "Who managed the Tournament of Echoes and recruited Daren?",
                "difficulty": "medium",
                "exp": "Magistra Veloria approached them at the inn and offered the Challenge Path.",
                "answers": [
                    {"text": "Magistra Veloria", "is_correct": True},
                    {"text": "Kael Hoff"},
                    {"text": "Valdris the Eternal"},
                    {"text": "Sister Morwyn"},
                    {"text": "Thane Bloodaxe"},
                ],
            },
            {
                "q": "What was required before facing Kazuki Tenshin?",
                "difficulty": "medium",
                "exp": "Defeat four champions in succession: Thane, Lady Whisper, Viktor, Seraphina.",
                "answers": [
                    {"text": "Defeat four champions in succession", "is_correct": True},
                    {"text": "Donate a king's ransom"},
                    {"text": "Beat a timed obstacle course"},
                    {"text": "Win audience with the Choir"},
                ],
            },
        ],
        # Challenge Path arc themes (prefixed as Story: *)
        "Story: The Challenge Accepted": [
            {
                "q": "What requirement did Magistra Veloria set before facing Kazuki?",
                "difficulty": "medium",
                "exp": "Daren had to defeat four champions in succession: Thane, Lady Whisper, Viktor, Seraphina.",
                "answers": [
                    {
                        "text": "Defeat four current champions in succession",
                        "is_correct": True,
                    },
                    {"text": "Pay a king's ransom to the arena"},
                    {"text": "Win a vote of the scholars"},
                    {"text": "Bring Zerath's sigil"},
                ],
            },
            {
                "q": "Why did Selene initially oppose Daren's challenge?",
                "difficulty": "easy",
                "exp": "Her visions showed Daren broken or deadfutures where the mission failed.",
                "answers": [
                    {"text": "Prophetic visions of Daren's defeat", "is_correct": True},
                    {"text": "Lack of entry fee"},
                    {"text": "Fear of crowds"},
                    {"text": "The innkeeper warned against it"},
                ],
            },
            {
                "q": "What new supplies did the siblings secure in Kaizahara before the challenges?",
                "difficulty": "easy",
                "exp": "Demon-steel rope, ward-stones, and crystallized mana cores were priorities.",
                "answers": [
                    {
                        "text": "Demon-steel rope, ward-stones, crystallized mana cores",
                        "is_correct": True,
                    },
                    {"text": "Phoenix feathers and sun glass"},
                    {"text": "Dragon eggs and moonwater"},
                    {"text": "Clockwork limbs and mercury"},
                ],
            },
        ],
        "Story: The Berserker King": [
            {
                "q": "What was the core of Daren's tactic against Thane Bloodaxe?",
                "difficulty": "medium",
                "exp": "Redirect the berserker's momentum with gravity, wear down healing, then crush at low reserves.",
                "answers": [
                    {
                        "text": "Redirect momentum and exhaust his healing",
                        "is_correct": True,
                    },
                    {"text": "Match rage with greater rage"},
                    {"text": "Use poison darts from distance"},
                    {"text": "Freeze time before each spin"},
                ],
            },
            {
                "q": "Thane's axes were forged from what legendary material?",
                "difficulty": "easy",
                "exp": "They were forged from an ancient dragon's bones.",
                "answers": [
                    {"text": "The bones of an ancient dragon", "is_correct": True},
                    {"text": "Black ice from the void"},
                    {"text": "Sun-tempered sky bronze"},
                    {"text": "Obsidian harvested from storms"},
                ],
            },
            {
                "q": "Which event ended Thane's whirlwind signature attack?",
                "difficulty": "medium",
                "exp": "A gravitational vortex amplified his spin until disarm and impact.",
                "answers": [
                    {"text": "A gravity vortex amplified his spin", "is_correct": True},
                    {"text": "A misstep on loose sand"},
                    {"text": "A blinding flash from the crowd"},
                    {"text": "A sudden rain soaked the axes"},
                ],
            },
            {
                "q": "What attitude did Thane show after defeat?",
                "difficulty": "easy",
                "exp": "He offered grudging respect, warning other champions wouldn't be as straightforward.",
                "answers": [
                    {"text": "Respectful acknowledgment", "is_correct": True},
                    {"text": "Swore eternal vengeance"},
                    {"text": "Collapsed weeping"},
                    {"text": "Offered a bribe mid-fight"},
                ],
            },
        ],
        "Story: Dancing with Shadows": [
            {
                "q": "What made Lady Whisper's attacks ignore Daren's early defenses?",
                "difficulty": "hard",
                "exp": "Her void blade strikes from outside normal 3D space, bypassing planar shields.",
                "answers": [
                    {
                        "text": "Dimensional strikes outside 3D space",
                        "is_correct": True,
                    },
                    {"text": "Poison that seeped through shields"},
                    {"text": "Speed surpassing light"},
                    {"text": "Magnetism against gravity"},
                ],
            },
            {
                "q": "What physics concept did Daren leverage to locate Lady Whisper?",
                "difficulty": "hard",
                "exp": "Gravitational lensing bent light to reveal multi-state positions across dimensions.",
                "answers": [
                    {"text": "Gravitational lensing", "is_correct": True},
                    {"text": "Quantum tunneling"},
                    {"text": "Cherenkov radiation"},
                    {"text": "Electrostatic induction"},
                ],
            },
            {
                "q": "How did Daren force Lady Whisper to yield?",
                "difficulty": "medium",
                "exp": "Overlapping gravity cages pinned split manifestations, fracturing her consciousness until surrender.",
                "answers": [
                    {
                        "text": "Gravity cages trapped her split forms",
                        "is_correct": True,
                    },
                    {"text": "A sealing hymn from the choir"},
                    {"text": "Mirror shattering ritual"},
                    {"text": "Absolute darkness dome"},
                ],
            },
            {
                "q": "Where did their duel take place?",
                "difficulty": "easy",
                "exp": "In the Hall of Mirrors with obsidian reflectors and crystal formations.",
                "answers": [
                    {"text": "Hall of Mirrors", "is_correct": True},
                    {"text": "Forge Arena"},
                    {"text": "Sky Arena"},
                    {"text": "Arena of Bones"},
                ],
            },
        ],
        "Story: Breaking the Unbreakable": [
            {
                "q": "Why did direct crushing fail against Viktor Ironheart initially?",
                "difficulty": "medium",
                "exp": "Living metal redistributed force and adapted density, nullifying straightforward pressure.",
                "answers": [
                    {
                        "text": "His living metal redistributed force",
                        "is_correct": True,
                    },
                    {"text": "He teleported on impact"},
                    {"text": "He absorbed gravity as energy"},
                    {"text": "He phased through stone"},
                ],
            },
            {
                "q": "What vulnerability did Daren exploit to defeat Viktor?",
                "difficulty": "hard",
                "exp": "Thermal imbalancelocalized plasma heating disrupted the alchemical process maintaining the metal.",
                "answers": [
                    {
                        "text": "Thermal disruption of alchemical balance",
                        "is_correct": True,
                    },
                    {"text": "Acid corrosion of outer skin"},
                    {"text": "Sonic resonance at 432 Hz"},
                    {"text": "Magnetic reversal of core"},
                ],
            },
            {
                "q": "Where did this duel take place?",
                "difficulty": "easy",
                "exp": "In the Forge Arenaa working smithy surrounding the battlefield.",
                "answers": [
                    {"text": "The Forge Arena among molten metal", "is_correct": True},
                    {"text": "The Hall of Mirrors"},
                    {"text": "The Sky Arena"},
                    {"text": "The Moonlit Garden"},
                ],
            },
            {
                "q": "What immediate change signaled Viktor's defenses were failing?",
                "difficulty": "medium",
                "exp": "Superheated metal glowed cherry-red and softened, losing perfect force distribution.",
                "answers": [
                    {"text": "Cherry-red glow and softening", "is_correct": True},
                    {"text": "Frost forming over his body"},
                    {"text": "He became transparent"},
                    {"text": "Sparks turned blue"},
                ],
            },
        ],
        "Story: Storm's End": [
            {
                "q": "What fundamental shift let Daren fight Seraphina in her domain?",
                "difficulty": "hard",
                "exp": "He treated gravity as 3D'falling' in any direction to achieve true flight.",
                "answers": [
                    {"text": "3D gravity control enabling flight", "is_correct": True},
                    {"text": "Borrowed wind magic from relics"},
                    {"text": "Turned crystal platform into a magnet"},
                    {"text": "Used mirror clones for misdirection"},
                ],
            },
            {
                "q": "How did Daren neutralize Seraphina's storm mastery at the climax?",
                "difficulty": "hard",
                "exp": "A gravity well created a temporary vacuum, removing air needed for wind and lift.",
                "answers": [
                    {
                        "text": "Creating a vacuum with a gravity well",
                        "is_correct": True,
                    },
                    {"text": "Grounding lightning into the city"},
                    {"text": "Freezing the storm with ice runes"},
                    {"text": "Trapping winds in crystal"},
                ],
            },
            {
                "q": "At what altitude was the Sky Arena suspended?",
                "difficulty": "easy",
                "exp": "About a thousand feet above Kaizahara.",
                "answers": [
                    {"text": "Roughly a thousand feet", "is_correct": True},
                    {"text": "Ten feet"},
                    {"text": "One mile"},
                    {"text": "On the ground"},
                ],
            },
            {
                "q": "What visual phenomenon occurred when lightning met gravity fields?",
                "difficulty": "medium",
                "exp": "Plasma displays painted the sky in unnatural colors as thunder mixed with gravitational waves.",
                "answers": [
                    {"text": "Plasma colors outside nature", "is_correct": True},
                    {"text": "A perfect rainbow ring"},
                    {"text": "Falling stars rained down"},
                    {"text": "The sun briefly set"},
                ],
            },
        ],
        "Story: The Timeless Challenge": [
            {
                "q": "When did the decisive final exchange occur between Daren and Kazuki?",
                "difficulty": "medium",
                "exp": "During 'Tengoku He'without field effects, pure technique met pure technique.",
                "answers": [
                    {
                        "text": "During 'Tengoku He' without enhancement",
                        "is_correct": True,
                    },
                    {"text": "During 'Ikou' with full field"},
                    {"text": "Before the music began"},
                    {"text": "After the crowd left"},
                ],
            },
            {
                "q": "What did both fighters gain from the duel's outcome?",
                "difficulty": "easy",
                "exp": "Mutual respect and evolutionknowledge shared to strengthen the coming war efforts.",
                "answers": [
                    {"text": "Mutual respect and shared knowledge", "is_correct": True},
                    {"text": "A rematch scheduled for next year"},
                    {"text": "A ban from the arena"},
                    {"text": "A joint retirement"},
                ],
            },
            {
                "q": "What analytical method did Daren increasingly rely on mid-fight?",
                "difficulty": "hard",
                "exp": "Spatial analysis via gravitational lensing to locate Kazuki regardless of perception tricks.",
                "answers": [
                    {
                        "text": "Spatial analysis with gravitational lensing",
                        "is_correct": True,
                    },
                    {"text": "Counting footfalls per measure"},
                    {"text": "Watching shadows alone"},
                    {"text": "Matching breath rhythms"},
                ],
            },
            {
                "q": "What forced Kazuki to abandon direct approaches during 'Ikou'?",
                "difficulty": "medium",
                "exp": "Gravity wells appeared at commit points, threatening to tear through his path of attack.",
                "answers": [
                    {
                        "text": "Timed gravity wells at commit points",
                        "is_correct": True,
                    },
                    {"text": "Blinding sand thrown by Daren"},
                    {"text": "Broken strings stopped the hymn"},
                    {"text": "An arena quake"},
                ],
            },
        ],
    }

    themes_created = 0
    questions_inserted = 0
    answers_inserted = 0

    conn = get_connection()
    cur = conn.cursor()
    try:
        # Ensure themes exist and cache existing questions per theme
        theme_ids: Dict[str, int] = {}
        existing_by_theme: Dict[str, set] = {}

        for theme_name in THEMES.keys():
            theme_id = get_or_create_theme(cur, theme_name)
            theme_ids[theme_name] = theme_id
        if not dry_run:
            conn.commit()
        # Count newly created themes by checking how many were missing initially would require extra query;
        # approximate by re-checking existing. Simpler: just report how many unique theme names processed.
        themes_created = len(THEMES)

        # Load existing questions text for duplicate skipping
        for tname, tid in theme_ids.items():
            existing_by_theme[tname] = get_existing_question_texts(cur, tid)

        # Insert questions
        for theme_name, items in THEMES.items():
            t_id = theme_ids[theme_name]
            for item in items:
                q_text = item["q"].strip()
                if q_text in existing_by_theme[theme_name]:
                    # Skip duplicates
                    continue
                if dry_run:
                    # Simulate counts
                    questions_inserted += 1
                    answers_inserted += len(item["answers"])
                    continue

                q_id = insert_question_with_answers(
                    cur,
                    t_id,
                    q_text,
                    item.get("exp"),
                    difficulty_keyword=item.get("difficulty", "medium"),
                    url=None,
                    answers=item["answers"],
                )
                questions_inserted += 1
                answers_inserted += len(item["answers"])

        if not dry_run:
            conn.commit()

        return themes_created, questions_inserted, answers_inserted
    except mysql.connector.Error as e:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"❌ Database error: {e}")
        return 0, 0, 0
    finally:
        try:
            cur.close()
            conn.close()
        except Exception:
            pass


def main():
    print("📚 STORY QUIZ SEEDER\n" + "=" * 60)

    # Show current Story:* themes and counts for context
    print_existing_stories_theme()

    # Dry run first
    print("🧪 Dry run: computing inserts (no DB changes)...")
    t, q, a = seed_story_questions(dry_run=True)
    print(
        f"Would process {t} themes, insert {q} questions and {a} answers if applied.\n"
    )

    resp = input("Apply these changes to the database now? (yes/no): ").strip().lower()
    if resp in ("y", "yes"):
        print("\n🚀 Applying inserts...")
        t2, q2, a2 = seed_story_questions(dry_run=False)
        print(f"✅ Inserted across {t2} themes: {q2} questions, {a2} answers.")
    else:
        print("❌ Aborted. No changes applied.")


if __name__ == "__main__":
    main()
