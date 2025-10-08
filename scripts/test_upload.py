import requests
import time

BACKEND_URL = "http://127.0.0.1:8002/api/v1/convert/upload"
FILE_PATH = "/home/student/Project/project-one/backend/test.ogg"

def post_file():
    with open(FILE_PATH, 'rb') as f:
        files = {'file': ("test.ogg", f, 'audio/ogg')}
        data = {'target_format': 'ogg'}
        start = time.time()
        try:
            r = requests.post(BACKEND_URL, files=files, data=data, timeout=180)
            elapsed = time.time() - start
            print(f"Status: {r.status_code}, Time: {elapsed:.2f}s, Size: {len(r.content) if r.content else 0}")
        except Exception as e:
            elapsed = time.time() - start
            print(f"Request failed after {elapsed:.2f}s: {e}")

if __name__ == '__main__':
    for i in range(3):
        print(f"Attempt {i+1}")
        post_file()
        time.sleep(1)
