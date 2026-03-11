import sqlite3
import json
import os

DB_NAME = "hub.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password TEXT NOT NULL
    )
    ''')
    
    # Create meetings table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        date TEXT NOT NULL,
        filename TEXT,
        word_count INTEGER,
        speaker_count INTEGER,
        overview TEXT,
        decisions TEXT, -- JSON string
        action_items TEXT, -- JSON string
        sentiment TEXT -- JSON string
    )
    ''')
    
    conn.commit()
    conn.close()
    
    # Optional: Migrate existing data
    migrate_from_json()

def migrate_from_json():
    USERS_FILE = "users.json"
    MEETINGS_FILE = "meetings.json"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Migrate Users
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, 'r') as f:
                users = json.load(f)
                for user in users:
                    cursor.execute('INSERT OR IGNORE INTO users (email, name, password) VALUES (?, ?, ?)',
                                 (user['email'], user['name'], user['password']))
            # After migration, we might want to rename or delete the file, but let's keep it for safety for now
            # os.rename(USERS_FILE, USERS_FILE + ".bak")
        except Exception as e:
            print(f"Migration error for users: {e}")

    # Migrate Meetings
    if os.path.exists(MEETINGS_FILE):
        try:
            with open(MEETINGS_FILE, 'r') as f:
                meetings = json.load(f)
                for m in meetings:
                    cursor.execute('''
                    INSERT OR IGNORE INTO meetings 
                    (id, user_email, date, filename, word_count, speaker_count, overview, decisions, action_items, sentiment)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        m['id'],
                        m['user_email'],
                        m['date'],
                        m.get('basic_info', {}).get('filename'),
                        m.get('basic_info', {}).get('word_count'),
                        m.get('basic_info', {}).get('speaker_count'),
                        m['overview'],
                        json.dumps(m['decisions']),
                        json.dumps(m['action_items']),
                        json.dumps(m['sentiment'])
                    ))
            # os.rename(MEETINGS_FILE, MEETINGS_FILE + ".bak")
        except Exception as e:
            print(f"Migration error for meetings: {e}")

    conn.commit()
    conn.close()

# User Operations
def add_user(name, email, password):
    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', (name, email, password))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def get_user(email):
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()
    return dict(user) if user else None

# Meeting Operations
def add_meeting(m):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO meetings 
    (id, user_email, date, filename, word_count, speaker_count, overview, decisions, action_items, sentiment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        m['id'],
        m['user_email'],
        m['date'],
        m.get('basic_info', {}).get('filename'),
        m.get('basic_info', {}).get('word_count'),
        m.get('basic_info', {}).get('speaker_count'),
        m['overview'],
        json.dumps(m['decisions']),
        json.dumps(m['action_items']),
        json.dumps(m['sentiment'])
    ))
    conn.commit()
    conn.close()

def get_user_meetings(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute('SELECT * FROM meetings WHERE user_email = ? ORDER BY date DESC', (email,)).fetchall()
    conn.close()
    
    meetings = []
    for row in rows:
        m = dict(row)
        # Reconstruct the original structure
        meeting = {
            "id": m['id'],
            "user_email": m['user_email'],
            "date": m['date'],
            "basic_info": {
                "filename": m['filename'],
                "word_count": m['word_count'],
                "speaker_count": m['speaker_count']
            },
            "overview": m['overview'],
            "decisions": json.loads(m['decisions']),
            "action_items": json.loads(m['action_items']),
            "sentiment": json.loads(m['sentiment'])
        }
        meetings.append(meeting)
    return meetings
