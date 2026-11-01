package app

import (
	"context"
	"testing"
)

var handle = func(id string,
	ctx context.Context) error {
	return ctx.Err()
}

func seed(t *testing.T, name string,
	ctx context.Context) {
	t.Helper()
}
