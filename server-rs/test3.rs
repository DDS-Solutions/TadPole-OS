use regex::Regex;

fn main() {
    let error_text = r#"{"error":{"message":"Failed to call a function. Please adjust your prompt. See 'failed_generation' for more details.","type":"invalid_request_error","code":"tool_use_failed","failed_generation":"\u003cfunction=share_finding{\"topic\": \"Current Date\", \"finding\": \"Today's date is February 26, 2026\"}\u003c/function\u003e"}}"#;
    let err_json: serde_json::Value = serde_json::from_str(error_text).unwrap();
    let failed_gen = err_json["error"]["failed_generation"].as_str().unwrap();
    println!("Failed gen:\n{}", failed_gen);
    
    let regex = Regex::new(r"(?s)<function=([a-zA-Z0-9_-]+)(?:>)?(.*?)</function>").unwrap();
    if let Some(caps) = regex.captures(failed_gen) {
        println!("Matched!");
        println!("Name: {}", caps.get(1).unwrap().as_str());
        let args_str = caps.get(2).unwrap().as_str();
        println!("Args: {}", args_str);
        
        let mut json_str = args_str.trim().to_string();
        if !json_str.starts_with('{') {
            json_str.insert(0, '{');
        }
        if !json_str.ends_with('}') {
            json_str.push('}');
        }
        println!("Sanitized Args: {}", json_str);
        
        let args: serde_json::Value = serde_json::from_str(&json_str)
            .unwrap_or_else(|_| serde_json::json!({}));
            
        println!("Parsed Args: {}", args);
    } else {
        println!("Did not match!");
    }
}
