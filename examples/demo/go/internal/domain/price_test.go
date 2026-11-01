package domain

import (
	"os"
	"testing"
)

func TestExistingBehavior(t *testing.T) {
	expected := 10
	if os.Getenv("PREGATE_DEMO_EXPECTED_TOTAL") == "11" {
		expected = 11
	}
	if Legacy() != 10 || Total(10) != expected {
		t.Fatal("existing behavior changed")
	}
}
