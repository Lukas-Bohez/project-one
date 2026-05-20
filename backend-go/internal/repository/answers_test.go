package repository

import (
    "context"
    "database/sql"
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

func TestCreate_Update_Delete_Answers(t *testing.T) {
    db, mock, err := sqlmock.New()
    if err != nil {
        t.Fatalf("sqlmock.New: %v", err)
    }
    defer db.Close()

    repo := NewAnswerRepository(db)

    // Create
    questionID := int64(10)
    mock.ExpectExec(regexp.QuoteMeta("INSERT INTO answers (questionId, answer_text, is_correct, created_at, updated_at)\n        VALUES (?, ?, ?, NOW(), NOW())")).
        WithArgs(questionID, "new answer", true).
        WillReturnResult(sqlmock.NewResult(77, 1))

    id, err := repo.Create(context.Background(), models.Answer{QuestionID: questionID, AnswerText: "new answer", IsCorrect: true})
    if err != nil {
        t.Fatalf("Create failed: %v", err)
    }
    if id != 77 {
        t.Fatalf("expected id 77 got %d", id)
    }

    // Update success
    mock.ExpectExec(regexp.QuoteMeta("UPDATE answers\n        SET answer_text = ?, is_correct = ?, updated_at = NOW()\n        WHERE id = ?")).
        WithArgs("updated", false, int64(77)).
        WillReturnResult(sqlmock.NewResult(0, 1))

    if err := repo.Update(context.Background(), models.Answer{ID: 77, AnswerText: "updated", IsCorrect: false}); err != nil {
        t.Fatalf("Update failed: %v", err)
    }

    // Update not found
    mock.ExpectExec(regexp.QuoteMeta("UPDATE answers\n        SET answer_text = ?, is_correct = ?, updated_at = NOW()\n        WHERE id = ?")).
        WithArgs("x", true, int64(9999)).
        WillReturnResult(sqlmock.NewResult(0, 0))

    if err := repo.Update(context.Background(), models.Answer{ID: 9999, AnswerText: "x", IsCorrect: true}); err != sql.ErrNoRows {
        t.Fatalf("expected sql.ErrNoRows got %v", err)
    }

    // Delete success
    mock.ExpectExec(regexp.QuoteMeta("DELETE FROM answers WHERE id = ?")).
        WithArgs(int64(77)).
        WillReturnResult(sqlmock.NewResult(0, 1))

    if err := repo.Delete(context.Background(), 77); err != nil {
        t.Fatalf("Delete failed: %v", err)
    }

    // Delete not found
    mock.ExpectExec(regexp.QuoteMeta("DELETE FROM answers WHERE id = ?")).
        WithArgs(int64(9999)).
        WillReturnResult(sqlmock.NewResult(0, 0))

    if err := repo.Delete(context.Background(), 9999); err != sql.ErrNoRows {
        t.Fatalf("expected sql.ErrNoRows got %v", err)
    }

    if err := mock.ExpectationsWereMet(); err != nil {
        t.Fatalf("unmet expectations: %v", err)
    }
}
