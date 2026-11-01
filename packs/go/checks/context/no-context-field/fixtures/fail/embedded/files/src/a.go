package app

import "context"

type Request struct {
	context.Context
	ID string
}
