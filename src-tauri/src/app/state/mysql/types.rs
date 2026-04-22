#[derive(Debug, Clone, serde::Serialize)]
pub struct MySqlTableInfo {
    pub schema: String,
    pub name: String,
    pub table_type: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MySqlColumnInfo {
    pub name: String,
    pub column_type: String,
    pub is_nullable: bool,
    pub column_key: String,
    pub extra: String,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MySqlQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Option<String>>>,
    pub affected_rows: u64,
}
