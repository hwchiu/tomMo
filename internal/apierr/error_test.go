package apierr

import (
	"errors"
	"testing"
)

func TestError(t *testing.T) {
	err := New(403, "使用者只能閱讀")
	if err.Error() != "使用者只能閱讀" || err.Status != 403 {
		t.Fatalf("%+v", err)
	}
	var target *Error
	if !errors.As(err, &target) || target.Message != "使用者只能閱讀" {
		t.Fatal("as")
	}
}
