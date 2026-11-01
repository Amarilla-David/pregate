trait Store {
    fn put(&mut self, value: u32);
    fn compact(&mut self);
}

struct Memory(Vec<u32>);

impl Store for Memory {
    fn put(&mut self, value: u32) {
        self.0.push(value);
    }

    fn compact(&mut self) {
        unimplemented!("the memory store keeps no garbage")
    }
}
