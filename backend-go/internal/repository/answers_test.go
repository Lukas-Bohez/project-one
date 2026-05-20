package repository

import (
    "context"
    "regexp"
    "testing"
    "time"

    "github.com/DATA-DOG/go-sqlmock"
)

func TestListByQuestionID_ReturnsAnswersAndTotal(t *testing.T) {
    db, mock, err := sqlmock.New()
    if err != nil {
        t.Fatalf("sqlmock.New: %v", err)
    }
    defer db.Close()

    repo := NewAnswerRepository(db)

    questionID := int64(123)
    limit := 2
    offset := 0

    mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(1) FROM answers WHERE questionId = ?")).
        WithArgs(questionID).
        WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

    rows := sqlmock.NewRows([]string{"id", "questionId", "answer_text", "is_correct", "created_at", "updated_at"}).
        AddRow(1, questionID, "Answer A", true, time.Now(), time.Now()).
        AddRow(2, questionID, "Answer B", false, time.Now(), time.Now())

    mock.ExpectQuery(regexp.QuoteMeta("SELECT id, questionId, answer_text, is_correct, created_at, updated_at")).
        WithArgs(questionID, limit, offset).
        WillReturnRows(rows)

    answers, total, err := repo.ListByQuestionID(context.Background(), questionID, limit, offset)
    if err != nil {
        t.Fatalf("ListByQuestionID failed: %v", err)
    }
    if total != 3 {
        t.Fatalf("expected total 3, got %d", total)
    }
    if len(answers) != 2 {
        t.Fatalf("expected 2 answers, got %d", len(answers))
    }

    if err := mock.ExpectationsWereMet(); err != nil {
        t.Fatalf("unmet expectations: %v", err)
    }
}

func TestGetByID_FoundAndNotFound(t *testing.T) {
    db, mock, err := sqlmock.New()
    if err != nil {
        t.Fatalf("sqlmock.New: %v", err)
    }
    defer db.Close()

    repo := NewAnswerRepository(db)

    // Found
    id := int64(42)
    now := time.Now()
    rows := sqlmock.NewRows([]string{"id", "questionId", "answer_text", "is_correct", "created_at", "updated_at"}).
        AddRow(id, int64(1), "Answer", true, now, now)

    mock.ExpectQuery(regexp.QuoteMeta("SELECT id, questionId, answer_text, is_correct, created_at, updated_at")).
        WithArgs(id).
        WillReturnRows(rows)

    item, err := repo.GetByID(context.Background(), id)
    if err != nil {
        t.Fatalf("GetByID failed: %v", err)
    }
    if item == nil || item.ID != id {
        t.Fatalf("expected id %d got %+v", id, item)
    }

    // Not found
    notFoundID := int64(9999)
    mock.ExpectQuery(regexp.QuoteMeta("SELECT id, questionId, answer_text, is_correct, created_at, updated_at")).
        WithArgs(notFoundID).
        WillReturnRows(sqlmock.NewRows([]string{"id", "questionId", "answer_text", "is_correct", "created_at", "updated_at"}))

    item2, err := repo.GetByID(context.Background(), notFoundID)
    if err != nil {
        t.Fatalf("GetByID notFound failed: %v", err)
    }
    if item2 != nil {
        t.Fatalf("expected nil for not found, got %+v", item2)
    }

    if err := mock.ExpectationsWereMet(); err != nil {
        t.Fatalf("unmet expectations: %v", err)
    }
}
