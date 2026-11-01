package app

import "context"

type Store struct{}

func (s *Store) Get(ctx context.Context, id string) (string, error) { return id, ctx.Err() }

func Sum(a, b int) int { return a + b }
