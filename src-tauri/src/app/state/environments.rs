use crate::app::state::AppState;

impl AppState {
    pub async fn list_environments(&self) -> Vec<String> {
        let mut envs = self.environments.lock().await.clone();
        if envs.is_empty() {
            envs.push("default".to_string());
        }
        envs.sort();
        envs.dedup();
        envs
    }

    pub async fn get_current_environment(&self) -> String {
        let current = self.current_environment.lock().await.clone();
        if current.trim().is_empty() {
            "default".to_string()
        } else {
            current
        }
    }

    pub async fn create_environment(&self, name: String) -> Result<Vec<String>, String> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err("environment name is empty".to_string());
        }
        let mut envs = self.environments.lock().await;
        if !envs.iter().any(|e| e == &name) {
            envs.push(name.clone());
            envs.sort();
            envs.dedup();
            self.store
                .save_environments(&envs)
                .map_err(|e| e.to_string())?;
        }
        Ok(envs.clone())
    }

    pub async fn rename_current_environment(&self, new_name: String) -> Result<String, String> {
        let new_name = new_name.trim().to_string();
        if new_name.is_empty() {
            return Err("environment name is empty".to_string());
        }
        let old_name = self.get_current_environment().await;
        if old_name == new_name {
            return Ok(new_name);
        }

        {
            let mut sessions = self.sessions.lock().await;
            let mut changed = false;
            for item in sessions.iter_mut() {
                if item.environment == old_name {
                    item.environment = new_name.clone();
                    changed = true;
                }
            }
            if changed {
                self.store.save_all(&sessions).map_err(|e| e.to_string())?;
            }
        }
        {
            let mut items = self.zookeeper_connections.lock().await;
            let mut changed = false;
            for item in items.iter_mut() {
                if item.environment == old_name {
                    item.environment = new_name.clone();
                    changed = true;
                }
            }
            if changed {
                self.store.save_all_zk(&items).map_err(|e| e.to_string())?;
            }
        }
        {
            let mut items = self.redis_connections.lock().await;
            let mut changed = false;
            for item in items.iter_mut() {
                if item.environment == old_name {
                    item.environment = new_name.clone();
                    changed = true;
                }
            }
            if changed {
                self.store
                    .save_all_redis(&items)
                    .map_err(|e| e.to_string())?;
            }
        }
        {
            let mut items = self.mysql_connections.lock().await;
            let mut changed = false;
            for item in items.iter_mut() {
                if item.environment == old_name {
                    item.environment = new_name.clone();
                    changed = true;
                }
            }
            if changed {
                self.store
                    .save_all_mysql(&items)
                    .map_err(|e| e.to_string())?;
            }
        }
        {
            let mut envs = self.environments.lock().await;
            envs.retain(|e| e != &old_name);
            if !envs.iter().any(|e| e == &new_name) {
                envs.push(new_name.clone());
            }
            envs.sort();
            envs.dedup();
            self.store
                .save_environments(&envs)
                .map_err(|e| e.to_string())?;
        }
        self.switch_environment(new_name.clone()).await?;
        Ok(new_name)
    }

    pub async fn switch_environment(&self, name: String) -> Result<String, String> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err("environment name is empty".to_string());
        }
        {
            let mut envs = self.environments.lock().await;
            if !envs.iter().any(|e| e == &name) {
                envs.push(name.clone());
                envs.sort();
                envs.dedup();
                self.store
                    .save_environments(&envs)
                    .map_err(|e| e.to_string())?;
            }
        }
        {
            let mut current = self.current_environment.lock().await;
            *current = name.clone();
        }
        self.store
            .set_current_environment(&name)
            .map_err(|e| e.to_string())?;
        Ok(name)
    }
}
