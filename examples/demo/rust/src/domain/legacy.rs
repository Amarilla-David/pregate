use crate::infra::Adapter;

pub fn legacy() -> i32 {
    Adapter::load()
}
