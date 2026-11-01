package app

import (
	files `io/ioutil`
)

func load(path string) ([]byte, error) { return files.ReadFile(path) }
