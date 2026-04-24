use serde::{Deserialize, Serialize};
use uuid::Uuid;

fn default_environment() -> String {
    "default".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MySqlConnection {
    pub id: Uuid,
    #[serde(default = "default_environment")]
    pub environment: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub database: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MySqlConnectionInput {
    pub name: String,
    pub host: String,
    pub port: Option<u16>,
    pub username: String,
    pub database: Option<String>,
}

impl MySqlConnectionInput {
    pub fn into_connection(self) -> MySqlConnection {
        MySqlConnection {
            id: Uuid::new_v4(),
            environment: default_environment(),
            name: self.name,
            host: self.host,
            port: self.port.unwrap_or(3306),
            username: self.username,
            database: self.database,
        }
    }
}
