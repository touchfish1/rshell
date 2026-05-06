#[derive(Debug, Clone, serde::Serialize)]
pub struct PostgreSqlTableInfo {
    pub schema: String,
    pub name: String,
    pub table_type: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PostgreSqlColumnInfo {
    pub name: String,
    pub column_type: String,
    pub is_nullable: bool,
    pub column_key: String,
    pub extra: String,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PostgreSqlQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Option<String>>>,
    pub affected_rows: u64,
}
