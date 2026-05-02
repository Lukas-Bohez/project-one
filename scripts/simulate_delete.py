# Simulate admin DELETE /api/admin/messages/{id}
import asyncio
import sys
import os

# Ensure project root is on sys.path so we can import backend package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
# Also add backend folder to sys.path so imports like `import database` succeed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

# Import app and repositories
# Set minimal env vars required by backend on import
os.environ.setdefault('SENTLE_ADMIN_PASSWORD', 'testpassword')

from backend import app as backend_app
from backend.database import datarepository as repo


# Monkeypatch repository functions
def fake_get_user_by_id(user_id):
    return {
        'id': int(user_id),
        'first_name': 'Oroka',
        'last_name': 'Conner',
        'userRoleId': 3,
    }


def fake_get_message_by_id(message_id):
    if int(message_id) in range(30, 40):
        return {'id': int(message_id), 'room_id': 1, 'user_id': 123}
    return None


def fake_soft_delete_message(message_id):
    print(f"soft_delete_message called for {message_id}")
    return True


repo.UserRepository.get_user_by_id = staticmethod(fake_get_user_by_id)
repo.SupportMessageRepository.get_message_by_id = staticmethod(fake_get_message_by_id)
repo.SupportMessageRepository.soft_delete_message = staticmethod(fake_soft_delete_message)


# Monkeypatch sio.emit to avoid needing a running Socket.IO server
async def fake_emit(event, data, room=None):
    print(f"sio.emit called: event={event}, data={data}, room={room}")


backend_app.sio.emit = fake_emit


async def run_tests():
    for mid in (33, 32, 31):
        try:
            result = await backend_app.delete_support_message(mid, None, admin_user={'id': 1, 'first_name': 'Oroka', 'last_name': 'Conner'})
            print(mid, 'result', result)
        except Exception as e:
            print(mid, 'exception', repr(e))


if __name__ == '__main__':
    asyncio.run(run_tests())
    sys.exit(0)
