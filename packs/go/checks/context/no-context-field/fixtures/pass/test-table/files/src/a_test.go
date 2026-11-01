package app

import (
	"context"
	"testing"
)

func TestRun(t *testing.T) {
	cases := []struct {
		name string
		ctx  context.Context
	}{{name: "background", ctx: context.Background()}}
	_ = cases
}
