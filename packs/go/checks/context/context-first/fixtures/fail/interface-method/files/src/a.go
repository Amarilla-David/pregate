package app

import "context"

type Loader interface {
	Load(id string, ctx context.Context) error
}
