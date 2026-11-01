pub mod domain;
pub mod infra;

#[cfg(test)]
mod tests {
    #[test]
    fn existing_behavior() {
        assert_eq!(crate::domain::legacy::legacy(), 10);
        let expected = if cfg!(demo_repair) { 11 } else { 10 };
        assert_eq!(crate::domain::price::total(10), expected);
    }
}
