package app

import "context"

type Worker struct {
	ctx   context.Context
	queue chan int
}
