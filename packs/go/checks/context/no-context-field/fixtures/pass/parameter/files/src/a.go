package app

import "context"

type Worker struct {
	queue chan int
}

func (w *Worker) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}
