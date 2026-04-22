use uuid::Uuid;

use crate::app::state::AppState;

impl AppState {
    pub async fn mysql_alter_table_add_column(
        &self,
        id: Uuid,
        schema: String,
        table: String,
        column_name: String,
        column_type: String,
    ) -> Result<(), String> {
        let pool = self.ensure_mysql_pool(id).await?;
        let sql = format!(
            "ALTER TABLE `{}`.`{}` ADD COLUMN `{}` {}",
            schema, table, column_name, column_type
        );
        sqlx::query(&sql)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
