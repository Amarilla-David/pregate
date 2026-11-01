package app

import (
	"fmt"
	"io/ioutil"
)

func dump(path string) {
	data, _ := ioutil.ReadFile(path)
	fmt.Println(len(data))
}
