use crate::services::clipboard_parser::parse_clipboard;
use crate::types::ParsedClipboard;

#[tauri::command]
pub fn parse_clipboard_text(text: String) -> ParsedClipboard {
    parse_clipboard(&text)
}

