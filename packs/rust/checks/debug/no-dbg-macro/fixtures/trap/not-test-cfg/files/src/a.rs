#[cfg(not(test))]
mod live {
    pub fn rate() -> f64 {
        ::std::dbg!(0.2)
    }
}
