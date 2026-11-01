pub fn double(x: u32) -> u32 {
    x * 2
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::double;

    #[test]
    fn doubles() {
        assert_eq!(dbg!(double(2)), 4);
    }
}
