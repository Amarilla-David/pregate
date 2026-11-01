package app

import "context"

func Load(id string, ctx context.Context) error { return ctx.Err() }
