fn total(items: &[u32]) -> u32 {
    let sum = items.iter().sum();
    log::debug!("total = {sum}");
    sum
}
