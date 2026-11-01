package app

import "io/ioutil"

func load(path string) ([]byte, error) { return ioutil.ReadFile(path) }
