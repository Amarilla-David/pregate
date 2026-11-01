fn label(code: u8) -> &'static str {
    match code {
        0 => "ok",
        _ => todo!("map the other codes"),
    }
}
