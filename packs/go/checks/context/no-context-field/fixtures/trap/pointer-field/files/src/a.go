package app

import "context"

type Server struct {
	name string
	base /* request scope */ *context.Context
}
