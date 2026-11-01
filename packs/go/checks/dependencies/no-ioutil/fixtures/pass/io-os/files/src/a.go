package app

import (
	"io"
	"os"
)

func read(r io.Reader) ([]byte, error) { return io.ReadAll(r) }

func load(path string) ([]byte, error) { return os.ReadFile(path) }
