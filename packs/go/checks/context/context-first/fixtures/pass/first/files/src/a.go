package app

import "context"

func Load(ctx context.Context, id string) error { return ctx.Err() }
