# Failures XLSX — Columns

When exporting failures, include **these columns**:

- `chat_number`
- `name`
- `text` (exactly what was attempted; empty rows imply a single space was sent)
- `user_id`
- `dialog_id`
- `error_code` (number, if any)
- `error_message` (verbatim `description` or transport error)
- `chat_add_id` (if available)
- `row_index` (original 1-based row number from upload)

File format: **.xlsx**