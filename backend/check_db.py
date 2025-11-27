import sys
sys.path.append('.')
from database.database import Database
from database.datarepository import UserRepository

# Check user count
users = UserRepository.get_all_users()
print(f'Total users: {len(users) if users else 0}')

# Check player answers count
answers = Database.get_rows('SELECT COUNT(*) as count FROM playerAnswers')
if answers:
    print(f'Total player answers: {answers[0]["count"]}')

# Check session players count
session_players = Database.get_rows('SELECT COUNT(*) as count FROM sessionPlayers')
if session_players:
    print(f'Total session players: {session_players[0]["count"]}')