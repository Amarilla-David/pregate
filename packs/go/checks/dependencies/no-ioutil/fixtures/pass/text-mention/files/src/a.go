package app

import "io/fs"

// io/ioutil was replaced by io and os.
const note = "io/ioutil"

var _ fs.FS
