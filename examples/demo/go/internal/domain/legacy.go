package domain

import "example.invalid/pregate-demo/internal/infra"

func Legacy() int { return infra.Load() }
