package app

import "context"

type RequestContext interface {
	context.Context
	UserID() string
}
