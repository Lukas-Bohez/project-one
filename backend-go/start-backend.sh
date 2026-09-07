#!/bin/bash
# Start the quizthespire Go backend
# Usage: ./start-backend.sh

export PATH=$HOME/.local/go-toolchain/go/bin:$PATH
cd /home/student/Project/project-one/backend-go

# Load environment
export PORT=8081
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=quiz_user
export DB_PASSWORD=secure_password_not_here
export DB_NAME=quizTheSpire
export CORS_ALLOWED_ORIGINS=https://quizthespire.com,https://www.quizthespire.com

# Start
exec ./bin/quizthespire-server