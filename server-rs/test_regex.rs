use regex::Regex;

fn main() {
    let error_text = r#"{"error":{"message":"Failed to call a function. Please adjust your prompt. See 'failed_generation' for more details.","type":"invalid_request_error","code":"tool_use_failed","failed_generation":"\u003cfunction=brave_search\u003e\"query\": \"today's date\"}\u003c/function\u003e"}}"#;
    let err_json: serde_json::Value = serde_json::from_str(error_text).unwrap();
    let failed_gen = err_json["error"]["failed_generation"].as_str().unwrap();
    println!("Failed gen:\n{}", failed_gen);
    
    let regex = Regex::new(r"(?s)<function=([a-zA-Z0-9_-]+)(?:>)?(.*?)</function>").unwrap();
    if let Some(caps) = regex.captures(failed_gen) {
        println!("Matched!");
        println!("Name: {}", caps.get(1).unwrap().as_str());
        let args_str = caps.get(2).unwrap().as_str();
        println!("Args: {}", args_str);
        
        let args: serde_json::Value = serde_json::from_str(args_str)
            .or_else(|_| {
                let wrapped = format!("{{{}}}", args_str);
                println!("Trying wrapped: {}", wrapped);
                serde_json::from_str(&wrapped)
            })
            .unwrap_or(serde_json::json!({}));
            
        println!("Parsed Args: {}", args);
    } else {
        println!("Did not match!");
    }
}
